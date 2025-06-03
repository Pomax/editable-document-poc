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
  backspace: `Backspace`,
  delete: `Delete`,
};

// Directly editable elements "root" elements.
const Editable = [`p`, `h1`, `h2`, `h3`, `h4`, `ul`, `ol`];

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

// Set up our edit options container
const options = document.createElement(`div`);
options.classList.add(`edit-options`);
document.body.append(options);

document.addEventListener(`click`, (evt) => {
  findCursor();
});

document.addEventListener(`touchstart`, (evt) => {
  findCursor();
});

document.addEventListener(`keydown`, ({ key }) => {
  findCursor();
});

document.addEventListener(`keyup`, ({ key }) => {
  findCursor();

  if (key === Keys.backspace || key === Keys.delete) {
    // check that next sibling is not a text node
    const next = currentTextNode.nextSibling;
    if (next?.nodeType === 3) {
      console.log(`we need to merge forward`);
      const L = currentTextNode.textContent.length;
      currentTextNode.textContent += next.textContent;
      currentElement.removeChild(next);
      setCursor(currentTextNode, L);
    }
  }
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
  }

  setLetterMatch: {
    range.setStart(textNode, s === first ? 0 : s - 1);
    range.setEnd(textNode, s === last ? s : s + 1);
    const { x, y, width: w, height: h } = range.getBoundingClientRect();
    setDims(letterMatch, x, y, w, h);
  }

  setContextMenu: {
    setContextMenu(currentElement.closest(Editable.join(`,`)));
  }
}

function setContextMenu(blockElement) {
  if (!currentElement) return;
  let { x, y, width: w, height: h } = blockElement.getBoundingClientRect();
  if (y < 30) y = h + y + 30;

  if (options.element === currentElement) return;

  options.element = currentElement;
  options.innerHTML = ``;
  setDims(options);

  const tag = currentElement.tagName.toLowerCase();
  const blockTag = blockElement.tagName.toLowerCase();

  if (tag.match(/h\d/)) {
    setDims(options, x, `${y}px - 2em`, w, `2em`);
    options.innerHTML = `
      <button id="h1">h1</button>
      <button id="h2">h2</button>
      <button id="h3">h3</button>
      <button id="h4">h4</button>
      <button id="p">p</button>
    `;
    const changeTag = (e, newtag) => {
      const tag = e.tagName.toLowerCase();
      currentElement.outerHTML = currentElement.outerHTML
        .replace(`<${tag}`, `<${newtag}`)
        .replace(`</${tag}`, `</${newtag}`);
    };
    [`h1`, `h2`, `h3`, `h4`, `p`].forEach((tag) => {
      options.querySelector(`#${tag}`).addEventListener(`click`, () => {
        changeTag(currentElement, tag);
        blockElement = currentElement.closest(Editable.join(`,`));
        findCursor();
      });
    });
  } else if ([`p`, `ul`, `ol`].includes(blockTag)) {
    setDims(options, x, `${y}px - 2em`, w, `2em`);
    options.innerHTML = `
      <button id="btn-strong">strong</button>
      <button disabled>emphasis</button>
      <button disabled>code</button>
      <button disabled>link</button>
    `;
    options.querySelector(`#btn-strong`).addEventListener(`click`, (evt) => {
      evt.preventDefault();
      makeSelection(`strong`, tag);
    });
  } else {
    console.log(`not heading: ${blockTag} > ${tag}`);
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

function makeSelection(tag, currentTag) {
  const selection = window.getSelection();
  console.log(selection);
  const { anchorOffset: pos } = selection;
  const find = selection.toString();

  // are we bolding text?
  if (currentTag !== tag) {
    const before = document.createTextNode(
      currentTextNode.textContent.substring(0, pos)
    );

    const element = document.createElement(tag);
    element.textContent = currentTextNode.textContent.substring(
      pos,
      pos + find.length
    );

    currentElement.insertBefore(element, currentTextNode);
    currentElement.insertBefore(before, element);
    currentTextNode.textContent = currentTextNode.textContent.substring(
      pos + find.length
    );

    // make sure to put the cursor back
    const range = document.createRange();
    range.setStart(element.childNodes[0], 0);
    range.setEnd(element.childNodes[0], find.length);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // if not, unbold and merge the text nodes
}

function setCursor(element = currentTextNode, pos = 0) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(element, pos);
  selection.removeAllRanges();
  selection.addRange(range);
  findCursor();
}

// TODO: merge consecutive text elements during edits (e.g. we backspace an element out of existence)
