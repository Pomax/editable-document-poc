const currentRoot = document.body;
currentRoot.contentEditable = true;
currentRoot.spellcheck = true;

// TODO: listening for diffs, so that we can roll/play them back.
currentRoot.addEventListener(`input`, () => {
  // ...
});

let currentElement = undefined;
let currentTextNode = undefined;
let prevCursor = { index: -1, caret: -1 };

const Keys = {
  up: `ArrowUp`,
  down: `ArrowDown`,
  left: `ArrowLeft`,
  right: `ArrowRight`,
  backspace: `Backspace`,
  delete: `Delete`,
  enter: `Enter`,
};

// Directly editable elements "root" elements.
const Editable = [`pre`, `p`, `h1`, `h2`, `h3`, `h4`, `ul`, `ol`, `img`];

// Alements where leading and trailing white space can be safely removed.
const Trimmable = [`main`, `header`, `div`, `section`, `li`];

// Cosmetic markup that may be nested in any order
const Cosmetic = [`strong`, `em`, `b`, `i`, `s`, `code`, `a`];

// Clear out problematic whitespace before we begin.
for (const tag of Editable.concat(Trimmable)) {
  document
    .querySelectorAll(tag)
    .forEach((e) => (e.innerHTML = e.innerHTML.trim()));
}

// Set up our block and letter marker overlays
const letterMatch = document.createElement(`div`);
letterMatch.classList.add(`letter-matcher`, `ignore-for-diffing`);
document.body.append(letterMatch);

// Set up our edit options container
const options = document.createElement(`div`);
options.classList.add(`edit-options`, `ignore-for-diffing`);
document.body.append(options);

document.addEventListener(`click`, (evt) => {
  if (currentRoot.contentEditable !== `true`) return;
  findCursor();
});

document.addEventListener(`touchstart`, (evt) => {
  if (currentRoot.contentEditable !== `true`) return;
  findCursor();
});

document.addEventListener(`keydown`, (evt) => {
  if (currentRoot.contentEditable !== `true`) return;

  const { key, metaKey, ctrlKey } = evt;

  // "Select all" should not select the entire document.
  if ((metaKey || ctrlKey) && key === `a`) {
    evt.preventDefault();
    selectEntireElement(currentElement.closest(Editable.join(`,`)));
  }

  findCursor();
});

document.addEventListener(`keyup`, ({ key, metaKey, ctrlKey }) => {
  if (currentRoot.contentEditable !== `true`) return;
  findCursor();

  if (key === Keys.backspace || key === Keys.delete) {
    // check that next sibling is not a text node
    const next = currentTextNode.nextSibling;
    if (next?.nodeType === 3) {
      const offset = mergeForward(currentTextNode, next);
      setCursor(offset);
    }
  }

  if (key === Keys.enter) {
    // did we just create a <div>? If so, no we didn't, we made a <p>
    if (currentElement.tagName.toLowerCase() === `div`) {
      const p = document.createElement(`p`);
      p.textContent = ` `;
      currentElement.parentNode.replaceChild(p, currentElement);
      currentElement = p;
      currentTextNode = currentElement.childNodes[0];
      currentTextNode.textContent = ``;
      setCursor();
    }
  }
});

// ----------------------------------------------------------

function mergeForward(textNode, next) {
  const offset = textNode.textContent.length;
  textNode.textContent += next.textContent;
  currentElement.removeChild(next);
  return offset;
}

function setCursor(pos = 0) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(currentTextNode, pos);
  selection.removeAllRanges();
  selection.addRange(range);
  highLight(currentTextNode, pos);
}

function selectEntireElement(element = currentElement) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNode(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function findCursor() {
  // Get the "global" caret position
  const selection = window.getSelection();
  if (!selection.anchorNode) return;

  const index = selection.anchorOffset;
  let node = selection.anchorNode;

  // If a node has no text content, then we
  // need to create one before we move on:
  if (node.nodeType === 1) {
    if (node.textContent === ``) {
      node.innerHTML = ` `;
      node.childNodes[0].textContent = ``;
      node = node.childNodes[0];
    }
  }

  // And while this check should now be a noop,
  // let's just keep it in here, just in case.
  if (node.nodeType === 3) {
    currentTextNode = node;
    currentElement = currentTextNode.parentNode;
    highLight(currentTextNode, index);
  }
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
    document.querySelectorAll(`div.matcher`).forEach((d) => d.remove());
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const { x, y, width: w, height: h } = rects[i];
      const div = document.createElement(`div`);
      div.classList.add(`matcher`, `ignore-for-diffing`);
      setDims(div, x, y, w, h);
      document.body.appendChild(div);
    }
  }

  setLetterMatch: {
    try {
      range.setStart(textNode, s === first ? 0 : s - 1);
      range.setEnd(textNode, s === last ? s : s + 1);
      const { x, y, width: w, height: h } = range.getBoundingClientRect();
      setDims(letterMatch, x, y, w, h);
    } catch (e) {
      // cool
    }
  }

  setContextMenu: {
    const editable = textNode.parentNode.closest(Editable.join(`,`));
    setContextMenu(editable);
  }
}

function setDims(e, x = 0, y = 0, w = 0, h = 0) {
  const val = (v) => (typeof v === `number` ? v + `px` : v);
  Object.assign(e.style, {
    top: `calc(${window.scrollY}px + ${val(y)})`,
    left: `calc(${window.scrollX}px + ${val(x)})`,
    width: val(w),
    height: val(h),
  });
}

// --------------------------------------------------------

function changeTag(newtag, e = currentElement) {
  const selection = window.getSelection();
  const { anchorOffset: pos } = selection;
  e = e.closest(Editable.join(`,`));
  if (!e) return;
  const newElement = document.createElement(newtag);
  const nodes = Array.from(e.childNodes);
  do {
    newElement.appendChild(nodes.shift());
  } while (nodes.length);
  if (e === currentElement) currentElement = newElement;
  e.parentNode.replaceChild(newElement, e);
  setCursor(pos);
  options.element = undefined;
  highLight(currentTextNode);
}

function wrapTextIn(tag) {
  const selection = window.getSelection();
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  let start = { offset: anchorOffset, node: anchorNode };
  let end = { offset: focusOffset, node: focusNode };

  // If we don't have a selection, select whatever word
  // the cursor is currently on.
  if (start.offset === end.offset && start.node === end.node) {
    console.log(`single cursor, let's expand it`);

    selection?.modify("move", "backward", "word");
    selection?.modify("extend", "forward", "word");
    const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
    start = { offset: anchorOffset, node: anchorNode };
    end = { offset: focusOffset, node: focusNode };
  }

  // correct for backwardness?
  const { direction } = selection;
  if (direction === `backward`) [start, end] = [end, start];

  // correct for the super weird behaviour where a double-click
  // text select on, e.g. a <strong> element will instead create
  // a text seleciton that starts "at the end of the text before"
  // and ends at "the start of the text after"... because of course.
  if (
    end.offset === 0 &&
    start.node.textContent.length === start.offset &&
    start.node.nextSibling.nextSibling === end.node
  ) {
    start = { offset: 0, node: start.node.nextSibling };
    end = { offset: start.node.textContent.length, node: start.node };
  }

  const currentTag = currentElement.tagName.toLowerCase();

  if (start.node === end.node) {
    // simple case, where we're wrapping text inside a single text node,
    // but we do need to make sure that "bolding bold unbolds", rather
    // than blindly nesting the same tag inside itself.
    if (tag === currentTag) {
      // "untag" the content
      const parent = currentElement.parentNode;
      const textNode = currentElement.childNodes[0];
      parent.replaceChild(textNode, currentElement);
      currentElement = parent;
      currentTextNode = textNode;
      let cursorPos = textNode.textContent.length;

      // Do we need to stitch a bunch of text nodes together again now?
      const prev = currentTextNode.previousSibling;
      if (prev?.nodeType === 3) {
        cursorPos += mergeForward(prev, currentTextNode);
        currentTextNode = prev;
      }

      const next = currentTextNode.nextSibling;
      if (next?.nodeType === 3) {
        mergeForward(currentTextNode, next);
      }

      setCursor(cursorPos);
    }

    // embedded change, e.g. <strong><em>...</em></strong> and we're un-strong-ing
    else if (currentElement.closest(tag)) {
      const wrapper = currentElement.closest(tag);
      wrapper.parentNode.replaceChild(currentElement, wrapper);
    }

    // "tag" the selection
    else {
      // Note that we need to trim our wrap text, because we don't want
      // spurious spaces at the start or end of the wrapping tags.
      // spurious spaces at the start or end of the wrapping tags.
      let wrapText = currentTextNode.textContent.substring(
        start.offset,
        end.offset
      );

      const prefix = wrapText.match(/^\s+/);
      const suffix = wrapText.match(/\s+$/);

      if (prefix ?? suffix) {
        wrapText = wrapText.trim();
        start.offset += prefix?.[0].length ?? 0;
        end.offset -= suffix?.[0].length ?? 0;
      }

      const before = document.createTextNode(
        currentTextNode.textContent.substring(0, start.offset)
      );

      const wrapped = document.createElement(tag);
      wrapped.textContent = wrapText;

      currentElement.insertBefore(wrapped, currentTextNode);
      currentElement.insertBefore(before, wrapped);
      currentTextNode.textContent = currentTextNode.textContent.substring(
        end.offset
      );

      // Make sure to put the cursor back
      setCursor();
    }
  }
}

// --------------------------------------------------------

const handleEdit = {
  h1: () => changeTag(`h1`),
  h2: () => changeTag(`h2`),
  h3: () => changeTag(`h3`),
  h4: () => changeTag(`h4`),
  p: () => changeTag(`p`),
  pre: () => changeTag(`pre`),
  ol: () => changeTag(`ol`),
  ul: () => changeTag(`ul`),
  code: () => wrapTextIn(`code`),
  strong: () => wrapTextIn(`strong`),
  em: () => wrapTextIn(`em`),
  a: () => wrapTextIn(`a`),
  img: () => pickImage(),
};

const labels = Object.keys(handleEdit);

options.innerHTML = labels
  .map((label) => `<button id="btn-${label}">${label}</button>`)
  .join(`\n`);

labels.forEach((name) => {
  const btn = options.querySelector(`#btn-${name}`);
  btn.addEventListener(`pointerdown`, (evt) => {
    evt.preventDefault();
    handleEdit[name]();
  });
});

function setContextMenu(blockElement) {
  if (!currentElement) return;
  if (!blockElement) return;

  let { x, y, width: w, height: h } = blockElement.getBoundingClientRect();
  if (y < 30) y = h + y + 30;

  if (options.element === currentElement) return;
  options.element = currentElement;
  setDims(options, x, `${y}px - 2.5em`, w, `2em`);

  document
    .querySelectorAll(`div.edit-options button.active`)
    .forEach((e) => e.classList.remove(`active`));

  // do we need to highlight anything?
  Cosmetic.forEach((tag) => {
    if (currentElement.closest(tag)) {
      options.querySelector(`#btn-${tag}`)?.classList.add(`active`);
    }
  });

  Editable.forEach((tag) => {
    if (currentElement.closest(tag)) {
      options.querySelector(`#btn-${tag}`)?.classList.add(`active`);
    }
  });
}
