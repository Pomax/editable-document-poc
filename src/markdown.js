import { Editable } from "./constants.js";
import { setDims } from "./utils.js";

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

export function convertToMarkdown(node, anchorNode, anchorOffset) {
  let chunks = [];

  const addChunk = (text, fromNode = undefined) => {
    chunks.push({ text, node: fromNode });
  };

  __convertToMarkdown(node, addChunk);

  let caret = 0;
  for (const c of chunks) {
    if (c.node === anchorNode) {
      caret += anchorOffset;
      break;
    }
    caret += c.text.length;
  }

  const text = chunks.map((c) => c.text).join(``);

  return { text, caret };
}

function __convertToMarkdown(node, addChunk) {
  // Text node
  if (node.nodeType === 3) {
    if (!node.parentNode.closest(`pre`)) {
      addChunk(node.textContent.replace(/\n?\s+/g, ` `), node);
    } else {
      addChunk(node.textContent, node);
    }
  }

  // DOM node
  else if (node.nodeType === 1) {
    const tag = node.tagName.toLowerCase();

    // prefix chunks
    if (tag === `h1`) {
      addChunk(`# `);
    }
    if (tag === `h2`) {
      addChunk(`## `);
    }
    if (tag === `h3`) {
      addChunk(`### `);
    }
    if (tag === `h4`) {
      addChunk(`#### `);
    }
    if (tag === `strong`) {
      addChunk(`**`);
    }
    if (tag === `em`) {
      addChunk(`_`);
    }
    if (tag === `del`) {
      addChunk(`~`);
    }
    if (tag === `sub`) {
      addChunk(`<sub>`);
    }
    if (tag === `sup`) {
      addChunk(`<sup>`);
    }
    if (tag === `a`) {
      addChunk(`[`);
    }
    if (tag === `code`) {
      if (node.textContent.includes("`")) addChunk("``");
      else addChunk("`");
    }
    if (tag === `li`) {
      const type = node.parentNode.tagName.toLowerCase();
      if (type === `ol`) {
        addChunk(`1. `);
        // returnText = `1. ${returnText}\n`;
      }
      if (type === `ul`) {
        addChunk(`* `);
        // returnText = `* ${returnText}\n`;
      }
    }

    // child chunks
    for (const c of node.childNodes) {
      __convertToMarkdown(c, addChunk);
    }

    // suffix chunks
    if ([`h1`, `h2`, `h3`, `h4`, `li`].includes(tag)) {
      addChunk(`\n`);
    }
    if (tag === `strong`) {
      addChunk(`**`);
    }
    if (tag === `em`) {
      addChunk(`_`);
    }
    if (tag === `del`) {
      addChunk(`~`);
    }
    if (tag === `sub`) {
      addChunk(`</sub>`);
    }
    if (tag === `sup`) {
      addChunk(`</sup>`);
    }
    if (tag === `a`) {
      addChunk(`](${node.href})`);
    }
    if (tag === `code`) {
      if (node.textContent.includes("`")) addChunk("``");
      else addChunk("`");
    }
  }
}

export function convertFromMarkDown({ textContent }, caret = 0) {
  const caretMarker = `CARETMARKETCARETMARKER`;
  const textLen = textContent.length;

  // TODO: it's possible for the caret to be "in" a tag rather than text,
  //       in which case I don't care enough to fix that in this PoC, the
  //       real solution there is to (obviously) not use RegExp replacement
  //       and have a proper tokenizer/converter track where the caret
  //       should end up in the conversion result =P
  const good = (c, v = 1) => textContent.substring(c, c + v).match(/\w/);
  if (!good(caret)) {
    if (caret > 0 && !good(caret, -1)) {
      while (caret < textLen && !good(caret)) {
        caret++;
      }
    }
  }

  const text =
    textContent.substring(0, caret) +
    caretMarker +
    textContent.substring(caret);

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
    // This one's obviously weird: backticks inside double backticks need to be
    // safified so we don't turn ``th`i`s`` into <code>th<code>i</code>s</code>
    // and instead turn it into <code>th`i`s</code>...
    .replace(/``(.+)`(.+)``/g, `\`\`$1⁜$2\`\``)
    .replace(/``([^<]+)``/g, `<code>$1</code>`)
    .replace(/`([^<]+)`/g, `<code>$1</code>`)
    .replace(/⁜/, "`")
    // links aren't super special
    .replace(/\[([^<]+)\]\(([^<]+)\)/g, `<a href="$2">$1</a>`);

  const div = document.createElement(`div`);
  div.innerHTML = html.trim();
  const nodes = Array.from(div.childNodes);

  let anchorNode, anchorOffset;
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

  return { nodes, anchorNode, anchorOffset };
}

window.getMarkdownVersion = () => {
  return convertToMarkdown(document.body).text;
};
