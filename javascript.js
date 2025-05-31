const px = `px`;
const cursor = document.getElementById(`cursor`);
const p = document.querySelector(`main p`);
p.innerHTML = p.innerHTML.replace(/\s+/g, ` `).trim();
const text = p.childNodes[0];

let currentElement = text;
let cursorPosition = 0;
let cursorCoordinate = { x: 0, y: 0 };

function updateCursor() {
  const { textContent: text } = currentElement;
  const atEnd = cursorPosition >= text.length;
  const start = atEnd ? text.length - 1 : cursorPosition;
  const end = start + 1;

  const range = document.createRange();
  range.setStart(currentElement, start);
  range.setEnd(currentElement, end);

  const { x, y, width: w, height: h } = range.getBoundingClientRect() || {};
  const m = y + h / 2;
  const left = atEnd ? x + w : x - 1;
  cursorCoordinate = { x: atEnd ? left : left + w / 2, y: m };

  Object.assign(cursor.style, {
    top: y + px,
    left: left + px,
  });

  document.getAnimations().forEach((a) => {
    if (a.animationName === `cursor-blink`) {
      a.cancel();
      a.play();
    }
  });

  return true;
}

function incrementCursor(v = 1) {
  cursorPosition += v;
  if (cursorPosition > currentElement.textContent.length) {
    cursorPosition = currentElement.textContent.length;
  }
  updateCursor();
}

function decrementCursor(v = 1) {
  cursorPosition -= v;
  if (cursorPosition < 0) {
    cursorPosition = 0;
  }
  updateCursor();
}

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

function backspace() {
  const s = currentElement.textContent;
  currentElement.textContent =
    s.substring(0, cursorPosition - 1) + s.substring(cursorPosition);
  decrementCursor();
}

function del() {
  const s = currentElement.textContent;
  currentElement.textContent =
    s.substring(0, cursorPosition) + s.substring(cursorPosition + 1);
}

document.addEventListener(`keydown`, (evt) => {
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
    // FIXME: we need the real line height here, not an assumed 16 px
    placeCursor(p, cursorCoordinate.x, cursorCoordinate.y - 16);
  }

  // down
  else if (key === `ArrowDown` && !shiftKey) {
    // FIXME: we need the real line height here, not an assumed 16 px
    placeCursor(p, cursorCoordinate.x, cursorCoordinate.y + 16);
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
    const s = currentElement.textContent;
    currentElement.textContent =
      s.substring(0, cursorPosition) + key + s.substring(cursorPosition);
    incrementCursor();
  }
});

document.addEventListener(`click`, ({ target, clientX: ox, clientY: oy }) => {
  placeCursor(target, ox, oy);
});

cursorPosition = 0;
updateCursor();
