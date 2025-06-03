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

// ------------------------------------------------------

function moveToNext() {
  const target = findNextDOMElement();
  if (!target) return;
  currentTextNode = getTextNode(0);
  currentElement = currentTextNode.parentNode;
  console.log(`move to next`, {
    currentRoot,
    currentElement,
    currentTextNode,
  });
  makeEditable(target);
}

function findNextDOMElement(parent = currentRoot) {
  let target = parent.nextElementSibling;
  if (target) return target;
  while (!target && parent !== document.body) {
    parent = parent.parentNode;
    target = parent.nextElementSibling;
  }
  return target;
}

function moveToPrevious() {
  const target = findPreviousDOMElement();
  if (!target) return;
  currentRoot = target;
  currentTextNode = getTextNode(-1);
  currentElement = currentTextNode.parentNode;
  console.log(`move to previous`, {
    currentRoot,
    currentElement,
    currentTextNode,
  });
  makeEditable(target, true);
}

function findPreviousDOMElement(parent = currentRoot) {
  let target = parent.previousElementSibling;
  if (target) return target;
  while (!target && parent !== document.body) {
    parent = parent.parentNode;
    target = parent.previousElementSibling;
  }
  return target;
}

function makeEditable(target = currentRoot, cursorAtEnd = false) {
  target.setAttribute(`contenteditable`, `true`);
  if (cursorAtEnd) moveCursorToEnd(target);
  target.focus();
  const onBlur = () => {
    target.removeAttribute(`contenteditable`);
    target.removeEventListener(`blur`, onBlur);
    for (const e of [blockMatch, letterMatch]) setDims(e, 0, 0, 0, 0);
  };
  target.addEventListener(`blur`, onBlur);
  findCursor();
}

function moveCursorToEnd(element) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStart(element, element.childNodes.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Find all text nodes contained by some element
 */
function getTextNodes(nodes = [], node = {}) {
  const walker = document.createTreeWalker(currentRoot, 4, null, false);
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

function getTextNode(idx) {
  return getTextNodes().at(idx);
}

/**
 *
 * @returns
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
  let index = -1;
  let tracked = 0;
  for (const node of getTextNodes()) {
    const L = node.textContent.length;
    if (tracked + L >= caret) {
      currentTextNode = node;
      currentElement = node.parentNode;
      index = caret - tracked;
      break;
    } else tracked += L;
  }

  /*
  // what did we find?
  console.log({
    caret,
    tracked,
    index,
    currentRoot,
    currentElement,
    currentTextNode,
  });
  */

  // highlight the cursor
  highLight(currentTextNode, index);

  return { caret, index };
}

/**
 *
 * @param {*} textNode
 * @param {*} s
 * @param {*} first
 * @param {*} last
 * @param {*} range
 */
function highLight(textNode, s, first, last, range) {
  first ??= 0;
  last ??= textNode.textContent.length;
  range ??= document.createRange();

  setBlockMatch: {
    range.setStart(textNode, first);
    range.setEnd(textNode, last);
    const { x, y, width: w, height: h } = range.getBoundingClientRect();
    setDims(blockMatch, x, y, w, h);
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
