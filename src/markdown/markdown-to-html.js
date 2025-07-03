import { caretMarker } from "../constants.js";
import { getFirstTextNode } from "../utils.js";

export function convertFromMarkDown(node, caret = 0) {
  const { textContent } = node;
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

  const safeuri = (d) => d.replaceAll(`_`, `%5F`).replaceAll(`*`, `%2A`);

  // Convert text to HTML while tracking where to place
  // the caret based on where it was in the original text.
  let html = text
    // links aren't super special
    .replace(
      /!\[([^\]]+)\]\(([^<()]+)\)/g,
      (_, a, b) =>
        `<figure><img src="${safeuri(
          b
        )}"><figcaption>${a}</figcaption></figure>`
    )
    .replace(
      /[^!]\[([^\]]+)\]\(([^<()]+)\)/g,
      (_, a, b) => `<a href="${safeuri(b)}">${a}</a>`
    )
    // ...and obviously, this is PoC code...
    .replace(
      /(^|\n)(#+) (.+)(\n|$)/gm,
      (_, a, b, c) => `<h${b.length}>${c}</h${b.length}>`
    )
    // list items and wrappers
    .replace(/(^|\n)\s*\* (.+)(\n|$)/gm, `<uli>$2</uli>`)
    .replace(/(^|\n)\s*1. (.+)(\n|$)/gm, `<oli>$2</oli>`)
    .replace(/(.{0,6})<((.)li)>/gm, (_, prefix, tag, type) => {
      if (!prefix || !prefix.includes(`/${tag}>`)) {
        return prefix + `<${type}l><li>`;
      }
      return _;
    })
    .replace(/<\/((.)li)>(.{0,6})/gm, (_, tag, type, suffix) => {
      if (!suffix || !suffix.includes(`${tag}>`)) {
        return `</li></${type}l>` + suffix;
      }
      return _;
    })
    .replaceAll(/<(\/?)[ou]li>/gm, `<$1li>`)
    // quotes?
    .replace(/(^|\n)> (.+)(\n|$)/gm, `$1<blockquote>$2</blockquote>`)
    // good old "hot mess of bold and italics"
    .replace(/(^|[^*])\*\*\*([^<*]+)\*\*\*/g, `$1<strong><em>$2</em></strong>`)
    .replace(/(^|[^*])\*\*([^<*]+)\*\*/g, `$1<strong>$2</strong>`)
    .replace(/(^|[^*])\*([^<*]+)\*/g, `$1<em>$2</em>`)
    .replace(/(^|[^_])_([^<]+)_/g, `$1<em>$2</em>`)
    .replace(/(^|[^~])~([^<]+)~/g, `$1<del>$2</del>`)
    // code replacements need uri encoding
    .replace(/```([^\n]*)\n([\w\W]+)\n```/gm, (_, a, b) => {
      console.log(`code block`, _, a, b);
      return `<pre><code data-lang="${a}">${safify(b)}</code></pre>`;
    })
    .replace(/``([^`].+[^`])``/g, (_, d) => `<code>${safify(d)}</code>`)
    .replace(/`([^`]+)`/g, (_, d) => `<code>${safify(d)}</code>`)
    // tables are ... quite a bit more work
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
    })
    // then finally, we need to wrap paragraphs in `<p>` tags...
    .replace(/(^|\n)(\w[^|\n]+)(\n|$)/gm, (_, a, b) => `<p>${b}</p>`);

  const div = document.createElement(`div`);
  div.innerHTML = html.trim();

  let anchorNode;
  const mark = div.querySelector(`mark`);
  if (mark) {
    anchorNode = document.createTextNode(``);
    anchorOffset = 0;
    mark.parentNode.replaceChild(anchorNode, mark);
  }

  const nodes = Array.from(div.childNodes);

  if (nodes.length === 0) {
    div.textContent = ` `;
    const tn = div.childNodes[0];
    nodes.push(tn);
    tn.textContent = ``;
    anchorNode = tn;
  } else if (!anchorNode) {
    anchorNode = getFirstTextNode(div);
  }

  return { nodes, anchorNode, anchorOffset };
}
