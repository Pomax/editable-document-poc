export { convertFromMarkDown } from "./markdown-to-html.js";
export { convertToMarkdown } from "./html-to-markdown.js";

import { Editable } from "../constants.js";
import { findAll } from "../utils.js";
import { HTMLToMarkdown } from "./html-to-markdown.js";

document.toMarkdown = () =>
  findAll(Editable.join(`,`))
    .map((node) => HTMLToMarkdown(node))
    .join(`\n`);
