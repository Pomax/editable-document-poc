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

export function convertToMarkdown(node, offset = 0) {
  let returnText = ``;

  if (node.nodeType === 3) {
    returnText = node.textContent.replace(/\n/g, ` `);
  } else if (node.nodeType === 1) {
    const tag = node.tagName.toLowerCase();
    returnText = Array.from(node.childNodes)
      .map((c) => {
        const { text, offset: o } = convertToMarkdown(c);
        offset += o;
        return text;
      })
      .join(``);
    if (tag === `strong`) {
      returnText = `**${returnText}**`;
      offset += 2;
    }
    if (tag === `em`) {
      returnText = `*${returnText}*`;
      offset += 1;
    }
    if (tag === `a`) {
      returnText = `[${returnText}](${node.href})`;
      offset += 1;
    }
    if (tag === `code`) {
      if (returnText.includes("`")) {
        returnText = `\`\`${returnText}\`\``;
        offset += 2;
      } else {
        returnText = `\`${returnText}\``;
        offset += 1;
      }
    }
    if (tag === `li`) {
      const type = node.parentNode.tagName.toLowerCase();
      if (type === `ol`) {
        returnText = `1. ${returnText}\n`;
        offset += 3;
      }
      if (type === `ul`) {
        returnText = `* ${returnText}\n`;
        offset += 3;
      }
    }
  }
  return { text: returnText, offset };
}

export function convertFromMarkDown({ textContent }) {
  const html = textContent
    // good old "hot mess of bold and italics"
    .replace(/(^|[^*])\*\*\*([^<*]+)\*\*\*/g, `$1<strong><em>$2</em></strong>`)
    .replace(/(^|[^*])\*\*([^<*]+)\*\*/g, `$1<strong>$2</strong>`)
    .replace(/(^|[^*])\*([^<*]+)\*/g, `$1<em>$2</em>`)
    .replace(/(^|[^_])_([^<]+)_/g, `$1<em>$2</em>`)
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
  div.innerHTML = html;
  return Array.from(div.childNodes);
}
