import { caretMarker } from "../constants.js";
import { getFirstTextNode } from "../utils.js";

export function convertFromMarkDown({ textContent }, caret = 0) {
  const textLen = textContent.length;
  let text = textContent;

  console.log(text);

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
    .replace(/(^|\n)> (.+)(\n|$)/gm, `$1<blockquote>$2</blockquote>`)
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

  console.log(html);

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

  console.log(nodes);

  return { nodes, anchorNode, anchorOffset };
}
