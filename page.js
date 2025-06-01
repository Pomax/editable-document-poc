const blockMatch = document.createElement(`div`);
blockMatch.classList.add(`matcher`);
document.body.append(blockMatch);

const letterMatch = document.createElement(`div`);
letterMatch.classList.add(`matcher`);
document.body.append(letterMatch);

const p = document.querySelector(`main p`);
p.innerHTML = p.innerHTML.replace(/\s+/g, ` `).trim();

let atStart = false;
let atEnd = false;
let currentRoot = undefined;
let currentElement = undefined;
let currentTextNode = undefined;

const Keys = {
  up: `ArrowUp`,
  down: `ArrowDown`,
  left: `ArrowLeft`,
  right: `ArrowRight`,
};

const Editable = [`p`, `h1`, `h2`, `h3`, `ul`, `ol`];

for (const tag of Editable) {
  document
    .querySelectorAll(tag)
    .forEach((e) => (e.innerHTML = e.innerHTML.trim()));
}

document.addEventListener(`click`, (evt) => {
  const local = (currentRoot = evt.target.closest(Editable.join(`,`)));
  if (!local) return;
  switchTo(local);
});

function switchTo(local, cursorAtEnd = false) {
  local.setAttribute(`contenteditable`, `true`);
  if (cursorAtEnd) moveCursorToEnd(local);
  local.focus();
  const onBlur = () => {
    local.removeAttribute(`contenteditable`);
    local.removeEventListener(`blur`, onBlur);
    for (const e of [blockMatch, letterMatch]) setDims(e, 0, 0, 0, 0);
  };
  local.addEventListener(`blur`, onBlur);
  findCursor({ target: local });
}

let prevZeroes = false;

document.addEventListener(`keydown`, (evt) => {
  const found = findCursor({ target: currentRoot });
  if (!found) return;

  const { key } = evt;
  const { caret, index } = found;
  console.log(`keydown`, caret, index, prevZeroes);

  if ((key === Keys.left || key === Keys.up) && caret === 0 && index === 0) {
    if (prevZeroes === false) prevZeroes = true;
    else {
      atEnd = true;
      moveToPrevious();
    }
  } else {
    prevZeroes = false;
  }

  if ((key === Keys.right || key === Keys.down) && caret > 0 && index === -1) {
    moveToNext();
  }
});

document.addEventListener(`keyup`, (evt) => {
  const found = findCursor({ target: currentRoot });
  if (!found) return;

  const { key } = evt;
  const { caret, index } = found;

  console.log(`keyup`, caret, index, prevZeroes);

  if (key === Keys.down || key === Keys.right) {
    if (caret > 0 && index === -1) {
      moveToNext();
    }
  }

  if (key === Keys.up || key === Keys.left) {
    if (caret === 0 && index === 0 && prevZeroes) {
      moveToPrevious();
    }
  }
});

function findNextRelativeTo(parent) {
  let target = parent.nextElementSibling;
  if (target) return target;
  while (!target && parent !== document.body) {
    parent = parent.parentNode;
    target = parent.nextElementSibling;
  }
  return target;
}

function findPreviousRelativeTo(parent) {
  let target = parent.previousElementSibling;
  if (target) return target;
  while (!target && parent !== document.body) {
    parent = parent.parentNode;
    target = parent.previousElementSibling;
  }
  return target;
}

function moveToPrevious() {
  const target = findPreviousRelativeTo(currentRoot);
  if (target) {
    console.log(`moving focus to`, target);
    currentRoot = target;
    const textNodes = getTextNodesFor(target);
    currentTextNode = textNodes.at(-1);
    currentElement = currentTextNode.parentNode;
    switchTo(target, true);
  }
}

function moveToNext() {
  const target = findNextRelativeTo(currentRoot);
  if (target) {
    console.log(`moving focus to`, target);
    currentRoot = target;
    const textNodes = getTextNodesFor(target);
    currentTextNode = textNodes[0];
    currentElement = currentTextNode.parentNode;
    switchTo(target);
  }
}
function moveCursorToEnd(element) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStart(element, element.childNodes.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getTextNodesFor(e, nodes = [], node = {}) {
  const walker = document.createTreeWalker(e, 4, null, false);
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

function findCursor({ target, clientX: ox, clientY: oy }) {
  // FIXME: the only way to make sure we highlight the
  // right thing is to make sure we track "where we just
  // were" and "where we are now", so that we can tell
  // whether or not we're transitioning to a different
  // element or not.

  // Get the "global" caret position
  const selection = window.getSelection();
  if (!selection.anchorNode) return;

  const range = selection.getRangeAt(0);
  const clonedRange = range.cloneRange();
  clonedRange.selectNodeContents(currentRoot);
  clonedRange.setEnd(range.endContainer, range.endOffset);
  const caret = clonedRange.toString().length;

  let index = -1;
  let tracked = 0;

  for (let node of getTextNodesFor(target)) {
    const L = node.textContent.length;
    if (tracked + L > caret) {
      currentTextNode = node;
      currentElement = node.parentNode;
      index = caret - tracked;
      break;
    } else tracked += L;
  }

  if (index >= 0) highLight(currentTextNode, index);

  return { caret, index };
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
