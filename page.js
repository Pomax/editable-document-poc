const currentRoot = document.body;
currentRoot.contentEditable = true;
currentRoot.spellcheck = true;

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
const letterMatch = document.createElement(`div`);
letterMatch.classList.add(`letter-matcher`);
document.body.append(letterMatch);

// Set up our edit options container
const options = document.createElement(`div`);
options.classList.add(`edit-options`);
document.body.append(options);

document.addEventListener(`click`, (evt) => {
  if (currentRoot.contentEditable !== `true`) return;
  findCursor();
});

document.addEventListener(`touchstart`, (evt) => {
  if (currentRoot.contentEditable !== `true`) return;
  findCursor();
});

document.addEventListener(`keydown`, ({ key }) => {
  if (currentRoot.contentEditable !== `true`) return;
  findCursor();
});

document.addEventListener(`keyup`, ({ key }) => {
  if (currentRoot.contentEditable !== `true`) return;
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
    document.querySelectorAll(`div.matcher`).forEach((d) => d.remove());
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const { x, y, width: w, height: h } = rects[i];
      const div = document.createElement(`div`);
      div.classList.add(`matcher`);
      setDims(div, x, y, w, h);
      document.body.appendChild(div);
    }
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
  if (!blockElement) return;
  let { x, y, width: w, height: h } = blockElement.getBoundingClientRect();
  if (y < 30) y = h + y + 30;

  if (options.element === currentElement) return;
  options.element = currentElement;
  setDims(options, x, `${y}px - 2.5em`, w, `2em`);
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

function changeTag(newtag, e = currentElement) {
  e = e.closest(Editable.join(`,`));
  if (!e) return;
  const tag = e.tagName.toLowerCase();
  console.log(tag, `->`, newtag);
  e.outerHTML = e.outerHTML
    .replace(`<${tag}`, `<${newtag}`)
    .replace(`</${tag}`, `</${newtag}`);
}

function wrapTextIn(tag) {
  const selection = window.getSelection();
  const { anchorNode, anchorOffset, focusNode, focusOffset, direction } =
    selection;
  let start = { offset: anchorOffset, node: anchorNode };
  let end = { offset: focusOffset, node: focusNode };
  if (direction === `backward`) {
    [start, end] = [end, start];
  }
  const text = selection.toString();
  console.log(start, end, text);

  const currentTag = currentElement.tagName.toLowerCase();

  if (start.node === end.node) {
    // simple case, where we're wrapping text inside a single text node,
    // but we do need to make sure that "bolding bold unbolds", rather
    // than blindly nesting the same tag inside itself.
    if (tag === currentTag) {
      console.log(`we should remove ${tag}`);
    } else {
      // Note that we need to trim our wrap text, because we don't want
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
      const range = document.createRange();
      range.setStart(currentTextNode, 0);
      range.setEnd(currentTextNode, 0);
      selection.removeAllRanges();
      selection.addRange(range);
      findCursor();
    }
  }

  const textNodes = getTextNodes();

  /*
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
  */
}

function setCursor(element = currentTextNode, pos = 0) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(element, pos);
  selection.removeAllRanges();
  selection.addRange(range);
  findCursor();
}

const labels =
  `h1, h2, h3, h4, p, ul, ol, code, strong, emphasis, link, img`.split(`, `);

options.innerHTML = labels
  .map((label) => `<button id="btn-${label}">${label}</button>`)
  .join(`\n`);

const handleEdit = {
  h1: () => changeTag(`h1`),
  h2: () => changeTag(`h2`),
  h3: () => changeTag(`h3`),
  h4: () => changeTag(`h4`),
  p: () => changeTag(`p`),
  ol: () => changeTag(`ol`),
  ul: () => changeTag(`ul`),
  code: () => wrapTextIn(`code`),
  strong: () => wrapTextIn(`strong`),
  emphasis: () => wrapTextIn(`em`),
  link: () => wrapTextIn(`a`),
  image: () => pickImage(),
};

labels.forEach((name) => {
  options.querySelector(`#btn-${name}`).addEventListener(`pointerdown`, (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    handleEdit[name]();
  });
});
