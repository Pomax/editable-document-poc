const currentRoot = document.body;
currentRoot.setAttribute(`contenteditable`, `true`);

let currentElement = undefined;
let currentTextNode = undefined;
let prevCursor = { index: -1, caret: -1 };

const Keys = {
  up: `ArrowUp`,
  down: `ArrowDown`,
  left: `ArrowLeft`,
  right: `ArrowRight`,
};

// Directly editable elements "root" elements.
const Editable = [`p`, `h1`, `h2`, `h3`, `ul`, `ol`];

// Alements where leading and trailing white can be safely removed.
const Trimmable = [`main`, `header`, `div`, `section`, `li`];

// Clear out problematic whitespace before we begin.
for (const tag of Editable.concat(Trimmable)) {
  document
    .querySelectorAll(tag)
    .forEach((e) => (e.innerHTML = e.innerHTML.trim()));
}

// Set up our block and letter marker overlays
[`blockMatch`, `letterMatch`].forEach((name) => {
  const div = (globalThis[name] = document.createElement(`div`));
  div.classList.add(`matcher`);
  document.body.append(div);
});

document.addEventListener(`click`, (evt) => {
  findCursor();
});

document.addEventListener(`touchstart`, (evt) => {
  findCursor();
});

document.addEventListener(`keydown`, (evt) => {
  findCursor();
});

document.addEventListener(`keyup`, (evt) => {
  findCursor();
});

/**
 * ...
 */
function findCursor() {
  // Get the "global" caret position
  const selection = window.getSelection();
  if (!selection.anchorNode) return;

  // Convert that into a local caret position relative
  // the the currentRoot element:
  const range = selection.getRangeAt(0);
  const clonedRange = range.cloneRange();
  clonedRange.selectNodeContents(currentRoot);
  clonedRange.setEnd(range.endContainer, range.endOffset);
  const caret = clonedRange.toString().length;

  // Now that we have the caret in terms of its position
  // inside the currentRoot element, find the text node
  // the caret is actually in.
  let textNodes = getTextNodes();
  let index = -1;
  let tracked = 0;
  for (const node of textNodes) {
    const L = node.textContent.length;
    if (tracked + L >= caret) {
      currentTextNode = node;
      index = caret - tracked;
      break;
    } else tracked += L;
  }

  // Do we need to "fast forward" to real text because
  // we landed on some interstitial whitespace instead?
  if (currentTextNode) {
    let pos = textNodes.indexOf(currentTextNode);
    while (currentTextNode && currentTextNode.textContent.trim() === ``) {
      index -= currentTextNode.textContent.length;
      currentTextNode = textNodes[++pos];
    }
    if (currentTextNode) {
      currentElement = currentTextNode.parentNode;
      highLight(currentTextNode, index);
    }
  }

  return { caret, index };
}

function getTextNodes(nodes = [], node = {}) {
  const walker = document.createTreeWalker(currentRoot, 4, null, false);
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

function getTextNode(idx) {
  return getTextNodes().at(idx);
}

function highLight(textNode, s, first, last, range) {
  first ??= 0;
  last ??= textNode.textContent.length;
  range ??= document.createRange();

  setBlockMatch: {
    range.setStart(textNode, first);
    range.setEnd(textNode, last);
    const { x, y, width: w, height: h } = range.getBoundingClientRect();
    setDims(blockMatch, x, y, w, h);

    setContextMenu(x, y, w, h);
  }

  setLetterMatch: {
    range.setStart(textNode, s === first ? 0 : s - 1);
    range.setEnd(textNode, s === last ? s : s + 1);
    const { x, y, width: w, height: h } = range.getBoundingClientRect();
    setDims(letterMatch, x, y, w, h);
  }
}

function setDims(e, x, y, w, h, px = `px`) {
  Object.assign(e.style, {
    top: window.scrollY + y + px,
    left: window.scrollX + x + px,
    width: w + px,
    height: h + px,
  });
}

// ----------------------------

function setContextMenu(x, y, w, h) {
  // TODO: FIXME: continue here
  options.innerHTML = ``;
  if (currentElement.tagName.match(/H\d/)) {
    console.log(`heading`);
    setDims(options, x, y - 30, innerWidth, 25);
    options.innerHTML = `
    <button>h1</button>
    <button>h2</button>
    <button>h3</button>
    <button>h4</button>
    `;
  }
}
