export { convertFromMarkDown } from "./markdown-to-html.js";
export { convertToMarkdown } from "./html-to-markdown.js";

import { HTMLToMarkdown } from "./html-to-markdown.js";

// Then, for funsies, add a toMarkDown to the document
document.__proto__.toMarkDown =
  document.__proto__.toMarkDown ??
  function () {
    const nodes = Array.from(document.body.children);
    const text = nodes.map((node) => HTMLToMarkdown(node)).join(`\n`);
    return text.replaceAll(/\n\n+/g, `\n\n`).trim();
  };
