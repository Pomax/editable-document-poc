export const Editable = [`pre`, `p`, `h1`, `h2`, `h3`, `h4`, `ul`, `ol`, `img`];

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
  if (tag === `h1`) return headingToMarkdown(1, node);
  if (tag === `h2`) return headingToMarkdown(2, node);
  if (tag === `h3`) return headingToMarkdown(3, node);
  if (tag === `h4`) return headingToMarkdown(4, node);
  if (tag === `p`) return paragraphToMarkdown(node);
  if (tag === `ul`) return listToMarkdown(node, false);
  if (tag === `ol`) return listToMarkdown(node, true);
  if (tag === `pre`) return preformattedToMarkdown(node);

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

function headingToMarkdown(n, { childNodes }) {
  return `${`#`.repeat(n)} ${HTMLToMarkdown(...childNodes)}\n\n`;
}

function paragraphToMarkdown({ childNodes }) {
  return `${HTMLToMarkdown(...childNodes)}\n\n`;
}

function listToMarkdown({ childNodes }, ordered = false) {
  // FIXME: note that this does not support nested lists right now
  return (
    Array.from(childNodes)
      .filter((e) => e?.tagName?.toLowerCase() === `li`)
      .map((li) => listItemToMarkdown(li, ordered))
      .join(`\n`) + `\n\n`
  );
}

function listItemToMarkdown({ childNodes }, ordered = false) {
  return `${ordered ? `1.` : `*`} ${HTMLToMarkdown(...childNodes)}`;
}

function preformattedToMarkdown({ childNodes }, language = ``) {
  return "```" + language + "\n" + HTMLToMarkdown(...childNodes) + "\n```\n\n";
}

function cosmeticMarkdown({ childNodes }, opener, closer = opener) {
  return `${opener}${HTMLToMarkdown(...childNodes)}${closer}`;
}

function codeToMarkdown(node) {
  markup = node.textContent.includes("`") ? "``" : "`";
  return cosmeticMarkdown(node, markup);
}

function linkToMarkdown({ href, childNodes }) {
  return `[${HTMLToMarkdown(...childNodes)}](${href})`;
}
