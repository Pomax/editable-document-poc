import { caretMarker, Editable } from "./constants.js";
import { getFirstTextNode, setDims } from "./utils.js";

export function toggleMarkdown(element) {
  element = element.closest(Editable.join(`,`));
  const parent = element.parentNode;
  const { x, y, width, height } = element.getBoundingClientRect();
  console.log(parent, element);

  const textArea = document.createElement(`textarea`);
  setDims(textArea, x, y, width, height);
  textArea.setAttribute(`tabindex`, 0);

  const text = convertToMarkdown(element)
    .replace(/\n\n/g, `\n`)
    .replace(/ +/g, ` `)
    .replace(/\n +/g, `\n`);
  console.log(text);
  textArea.textContent = text;

  parent.replaceChild(textArea, element);

  textArea.focus();
  const revert = ({ target }) => {
    if (target !== textArea) {
      parent.replaceChild(element, textArea);
      document.removeEventListener(`pointerdown`, revert);
    }
  };
  document.addEventListener(`pointerdown`, revert);
}

export function convertFromMarkDown({ textContent }, caret = 0) {
  const textLen = textContent.length;
  let text = textContent;

  // FIXME: move the caret into the nearest text, if it's inside syntax
  const good = (c, v = 1) => textContent.substring(c, c + v).match(/\w/);
  if (!good(caret)) {
    if (caret > 0 && !good(caret, -1)) {
      while (caret < textLen && !good(caret)) {
        caret++;
      }
    }
  }

  let anchorOffset = 0;

  if (caret > 0) {
    text =
      textContent.substring(0, caret) +
      caretMarker +
      textContent.substring(caret);
  }

  const safify = (d) =>
    d.replaceAll(`<`, `&lt;`).replaceAll(`>`, `&gt;`).replaceAll("`", `&#x60;`);

  // Convert text to HTML while tracking where to place
  // the caret based on where it was in the original text.
  const html = text
    // ...obviously this is PoC code...
    .replace(/(^|\n)#### (.+)(\n|$)/gm, `<h4>$2</h4>`)
    .replace(/(^|\n)### (.+)(\n|$)/gm, `<h3>$2</h3>`)
    .replace(/(^|\n)## (.+)(\n|$)/gm, `<h2>$2</h2>`)
    .replace(/(^|\n)# (.+)(\n|$)/gm, `<h1>$2</h1>`)
    .replace(/(^|\n)\s*\* (.+)(\n|$)/gm, `<li>$2</li>`)
    // good old "hot mess of bold and italics"
    .replace(/(^|[^*])\*\*\*([^<*]+)\*\*\*/g, `$1<strong><em>$2</em></strong>`)
    .replace(/(^|[^*])\*\*([^<*]+)\*\*/g, `$1<strong>$2</strong>`)
    .replace(/(^|[^*])\*([^<*]+)\*/g, `$1<em>$2</em>`)
    .replace(/(^|[^_])_([^<]+)_/g, `$1<em>$2</em>`)
    .replace(/(^|[^~])~([^<]+)~/g, `$1<del>$2</del>`)
    // code replacement need uri encoding
    .replace(/``(.+)``/g, (_, d) => `<code>${safify(d)}</code>`)
    .replace(/`([^`]+)`/g, (_, d) => `<code>${safify(d)}</code>`)
    .replace(/⁜/, "`")
    // links aren't super special
    .replace(/\[([^<()\]]+)\]\(([^<()]+)\)/g, `<a href="$2">$1</a>`)
    // tables are ... more work
    .replace(/((\|[^\n]+\|\n?)+)/gm, (_, lines) => {
      const set = lines.split(`\n`);
      for (let i = 0, e = set.length; i < e; i++) {
        set[i] = set[i].substring(1, set[i].length - 1);
      }
      const headers = set.shift().split(`|`);
      const colCount = headers.length;
      set.shift(); // header split line
      const data = set
        .map((line) => line.split(`|`))
        .filter((l) => l.length === colCount);
      return `<table><thead><tr>${headers
        .map((e) => `<th>${e}</th>`)
        .join(``)}</tr></thead><tbody>${data
        .map((row) => `<tr>${row.map((td) => `<td>${td}</td>`).join(``)}</tr>`)
        .join(``)}</tbody></table>`;
    });

  const div = document.createElement(`div`);
  div.innerHTML = html.trim();
  const nodes = Array.from(div.childNodes);

  let anchorNode = getFirstTextNode(div);

  if (caret > 0) {
    const tree = document.createTreeWalker(div, 4, () => 1);
    for (let tn = tree.nextNode(); tn; tn = tree.nextNode()) {
      const pos = tn.textContent.indexOf(caretMarker);
      if (pos >= 0) {
        tn.textContent = tn.textContent.replace(caretMarker, ``);
        anchorNode = tn;
        anchorOffset = pos;
        break;
      }
    }
  }

  return { nodes, anchorNode, anchorOffset };
}

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

  // Special "cosmetics"
  if (tag === `a`) return linkToMarkdown(node);

  // "...don't know? You figure it out"
  return HTMLToMarkdown(...node.childNodes);
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
  return `${ordered ? `1.` : `*`} ${HTMLToMarkdown(...childNodes)}`;
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
