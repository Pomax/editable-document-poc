import { caretMarker, Editable } from "../constants.js";

/**
 * ...
 */
export function convertToMarkdown(block, textNode, offset) {
  textNode.textContent =
    textNode.textContent.substring(0, offset) +
    caretMarker +
    textNode.textContent.substring(offset);

  const markdown = HTMLToMarkdown(block);
  const caret = markdown.indexOf(caretMarker);

  return {
    text: markdown.replace(caretMarker, ``),
    caret,
  };
}

/**
 * ...
 */
export function HTMLToMarkdown(...nodes) {
  const markdown = nodes
    .map((node) => (node.nodeType === 3 ? getText(node) : nodeToMarkdown(node)))
    .join(``);
  return markdown;
}

function getText(node) {
  const nextTag = node.nextSibling?.tagName?.toLowerCase();
  if (Editable.includes(nextTag) && !node.textContent.trim()) return ``;
  return node.textContent;
}

function nodeToMarkdown(node) {
  if (node.classList?.contains(`ignore-for-diffing`)) return ``;

  // What is this thing?
  const tag = node.tagName.toLowerCase();

  // Block elements
  if (tag === `h1`) return headingToMarkdown(node, 1);
  if (tag === `h2`) return headingToMarkdown(node, 2);
  if (tag === `h3`) return headingToMarkdown(node, 3);
  if (tag === `h4`) return headingToMarkdown(node, 4);
  if (tag === `p`) return paragraphToMarkdown(node);
  if (tag === `ol`) return listToMarkdown(node, true);
  if (tag === `ul`) return listToMarkdown(node, false);
  if (tag === `pre`) return preformattedToMarkdown(node);
  if (tag === `blockquote`) return paragraphToMarkdown(node, `> `);

  // tables are pretty special
  if (tag === `table`) return tableToMarkdown(node);

  // Cosmetic elements
  if (tag === `strong`) return cosmeticMarkdown(node, `**`);
  if (tag === `em`) return cosmeticMarkdown(node, `*`);
  if (tag === `del`) return cosmeticMarkdown(node, `~`);
  if (tag === `code`) return codeToMarkdown(node);
  if (tag === `blockquote`) return cosmeticMarkdown(node, `> `, ``);

  // Special "cosmetics"
  if (tag === `a`) return linkToMarkdown(node);

  // "...don't know? You figure it out"
  return passThrough(node);
}

function headingToMarkdown({ childNodes }, n = 1) {
  return `${`#`.repeat(n)} ${HTMLToMarkdown(...childNodes)}\n`;
}

function paragraphToMarkdown({ childNodes }, prefix = ``) {
  return `${prefix}${HTMLToMarkdown(...childNodes)}\n`;
}

function listToMarkdown({ childNodes }, ordered = false) {
  // FIXME: note that this does not support nested lists right now
  return (
    Array.from(childNodes)
      .filter((e) => e?.tagName?.toLowerCase() === `li`)
      .map((li) => listItemToMarkdown(li, ordered))
      .join(`\n`) + `\n`
  );
}

function listItemToMarkdown({ childNodes }, ordered = false) {
  return `${ordered ? `1.` : `*`} ${HTMLToMarkdown(...childNodes).trim()}`;
}

function preformattedToMarkdown({ childNodes }, language = ``) {
  return "```" + language + "\n" + HTMLToMarkdown(...childNodes) + "\n```\n";
}

function cosmeticMarkdown({ childNodes }, opener, closer = opener) {
  return `${opener}${HTMLToMarkdown(...childNodes)}${closer}`;
}

function codeToMarkdown(node) {
  const markup = node.textContent.includes("`") ? "``" : "`";
  return cosmeticMarkdown(node, markup);
}

function linkToMarkdown({ childNodes, href }) {
  return `[${HTMLToMarkdown(...childNodes)}](${href})`;
}

function tableToMarkdown(node) {
  let header = ``;

  const rows = Array.from(node.querySelectorAll(`tbody tr`));
  const colCount = rows[0].querySelectorAll(`td`).length;

  // we only accept tables with thead/tbody
  const headings = Array.from(node.querySelectorAll(`thead tr th`));
  if (headings.length) {
    header =
      `| ${headings.map((e) => e.textContent).join(` | `)} |\n` +
      `|-${`|-`.repeat(colCount - 1)}|\n`;
  }

  const convertCell = (cell) => HTMLToMarkdown(...cell.childNodes);
  const convertRow = (row) =>
    `| ${Array.from(row.querySelectorAll(`td`))
      .map(convertCell)
      .join(` | `)} |`;
  const data = rows.map(convertRow).join(`\n`) + `\n`;

  return header + data;
}

function passThrough(node) {
  const tag = node.tagName.toLowerCase();
  const attr = Array.from(node.attributes)
    .map((v) => `${v.name}="${v.value}"`)
    .join(` `);
  return `<${tag}${attr.length ? ` ${attr}` : ``}>${HTMLToMarkdown(
    ...node.childNodes
  )}</${tag}>`;
}
