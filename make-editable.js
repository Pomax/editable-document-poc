const px = `px`;
const cursor = document.getElementById(`cursor`);
const textArea = document.querySelector(`textarea[name="mobile"]`);
let currentElement, currentTextElement, cursorPosition, cursorCoordinate;

function addOverlay(element) {
  element.addEventListener(`click`, ({ target, clientX: ox, clientY: oy }) => {
    placeCursor(target, ox, oy);
  });
  textArea.addEventListener(`click`, (evt) => {
    currentElement.dispatchEvent(new evt.constructor(evt.type, evt));
  });
  const { left: x, top: y } = element.getBoundingClientRect();
  setDims(textArea, x, y, element.clientWidth, element.clientHeight);
}

function setDims(e, x, y, w, h) {
  Object.assign(e.style, {
    top: y + px,
    left: x + px,
    width: w + px,
    height: h + px,
  });
}

export function makeEditable(element) {
  currentElement = element;
  currentTextElement = Array.from(element.childNodes).find(
    (n) => n.nodeType === 3
  );
  addOverlay(element);
  updateCursor(0);
}

/**
 * ...
 * @param {*} pos
 * @returns
 */
function updateCursor(pos = cursorPosition) {
  cursorPosition = pos;

  const { textContent: text } = currentTextElement;
  const atEnd = cursorPosition >= text.length;
  const start = atEnd ? text.length - 1 : cursorPosition;
  const end = start + 1;

  const range = document.createRange();
  range.setStart(currentTextElement, start);
  range.setEnd(currentTextElement, end);

  const { x, y, width: w, height: h } = range.getBoundingClientRect() || {};
  const m = y + h / 2;
  const left = atEnd ? x + w : x - 1;

  cursorCoordinate = {
    x: atEnd ? left : left + w / 2,
    y: m,
  };

  Object.assign(cursor.style, {
    top: window.scrollY + y + px,
    left: window.scrollX + left + px,
  });

  document.getAnimations().forEach((a) => {
    if (a.animationName === `cursor-blink`) {
      a.cancel();
      a.play();
    }
  });

  return true;
}

/**
 * ...
 * @param {*} pos
 * @returns
 */
function incrementCursor(v = 1) {
  cursorPosition += v;
  if (cursorPosition > currentTextElement.textContent.length) {
    // TODO: if we reach the end of the text, we should see
    //       if we can "hop" into another element or not.
    cursorPosition = currentTextElement.textContent.length;
  }
  updateCursor();
}

/**
 * ...
 * @param {*} pos
 * @returns
 */
function decrementCursor(v = 1) {
  cursorPosition -= v;
  if (cursorPosition < 0) {
    // TODO: if we reach the start of the text, we should see
    //       if we can "hop" into another element or not.
    cursorPosition = 0;
  }
  updateCursor();
}

/**
 * ...
 * @param {*} pos
 * @returns
 */
function placeCursor(target, ox, oy) {
  for (const node of target.childNodes) {
    if (node.nodeType === 3) {
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, node.textContent.length);
      const { x, y, width: w, height: h } = range.getBoundingClientRect();
      if (ox < x || ox > x + w || oy < y || oy > y + h) continue;
      cursorPosition = findIndex(node, range, ox, oy);
      return updateCursor();
    }
  }
  return false;
}

/**
 * ...
 * @param {*} pos
 * @returns
 */
function findIndex(
  textNode,
  range,
  ox,
  oy,
  distance = Number.MAX_SAFE_INTEGER
) {
  const text = textNode.textContent;
  let letterIndex = -1;
  for (let s = 0; s < text.length - 1; s++) {
    range.setStart(textNode, s);
    range.setEnd(textNode, s + 1);
    const { x, y, width: w, height: h } = range.getBoundingClientRect();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const d = ((ox - cx) ** 2 + (oy - cy) ** 2) ** 0.5;
    if (d < distance + 3) {
      distance = d;
      letterIndex = s;
    }
  }
  return letterIndex;
}

/**
 * ...
 * @param {*} pos
 * @returns
 */
function backspace() {
  const s = currentTextElement.textContent;
  currentTextElement.textContent =
    s.substring(0, cursorPosition - 1) + s.substring(cursorPosition);
  decrementCursor();
}

/**
 * ...
 * @param {*} pos
 * @returns
 */
function del() {
  const s = currentTextElement.textContent;
  currentTextElement.textContent =
    s.substring(0, cursorPosition) + s.substring(cursorPosition + 1);
}

/**
 * The most important function
 */
function handleKey(evt) {
  const { key, shiftKey, altKey, ctrlKey, metaKey } = evt;
  const special = altKey || ctrlKey || metaKey;

  // right
  if (key === `ArrowRight` && !shiftKey) {
    evt.preventDefault();
    incrementCursor();
  }

  // left
  else if (key === `ArrowLeft` && !shiftKey) {
    evt.preventDefault();
    decrementCursor();
  }

  // up
  else if (key === `ArrowUp` && !shiftKey) {
    const moved = placeCursor(
      currentElement,
      cursorCoordinate.x,
      cursorCoordinate.y - 16 // FIXME: we need the real line height here, not an assumed 16 px
    );
    if (moved) evt.preventDefault();
  }

  // down
  else if (key === `ArrowDown` && !shiftKey) {
    const moved = placeCursor(
      currentElement,
      cursorCoordinate.x,
      cursorCoordinate.y + 16 // FIXME: we need the real line height here, not an assumed 16 px
    );
    if (moved) evt.preventDefault();
  }

  // backspace
  else if (key === `Backspace`) {
    backspace();
  }

  // del
  else if (key === `Delete`) {
    del();
  }

  // normal letters
  else if (!special && key.length === 1 && key.codePointAt(0) > 0x19) {
    evt.preventDefault();
    const s = currentTextElement.textContent;
    currentTextElement.textContent =
      s.substring(0, cursorPosition) + key + s.substring(cursorPosition);
    incrementCursor();
  }

  const { left: x, top: y } = currentElement.getBoundingClientRect();
  setDims(
    textArea,
    x,
    y,
    currentElement.clientWidth,
    currentElement.clientHeight
  );
}

document.addEventListener(`keydown`, handleKey);
