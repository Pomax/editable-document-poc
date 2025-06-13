import { Editable, Cosmetic } from "./constants.js";
import { convertToMarkdown, convertFromMarkDown } from "./markdown.js";
import {
  setDims,
  selectElement,
  getFirstTextNode,
  mergeForward,
} from "./utils.js";

// recyclable range
const range = document.createRange();

// Set up our block and letter marker overlays
const letterMatch = document.createElement(`div`);
letterMatch.classList.add(`letter-matcher`, `ignore-for-diffing`);
document.body.append(letterMatch);

// And set up our master "cursor" tracker
class Cursor {
  root = undefined;
  element = undefined;
  textNode = undefined;

  constructor() {
    this.root = document.body;
    this.root.spellcheck = true;
    this.root.contentEditable = true;
  }

  /**
   * ...
   */
  get active() {
    return this.root.contentEditable === `true`;
  }

  /**
   * ...
   */
  getEditable() {
    return this.element.closest(Editable.join(`,`));
  }

  /**
   * ...
   */
  update(element, textNode = this.textNode) {
    this.element = element;
    this.textNode = textNode;
  }

  /**
   * ...
   */
  find() {
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
      } else {
        node = getFirstTextNode(node);
      }
    }

    if (!node) return;

    // And while this check should now be a noop,
    // and always be true, let's just keep it in
    // here, just in case.
    if (node.nodeType === 3) {
      this.update(node.parentNode, node);
    } else if (node !== document.body) {
      console.warn(`well this is embarrassing...`, node.nodeType, node);
    }

    highlight(this.textNode, index);

    // TEST: live-replacement during edits
    let e = this.element;
    let tag = e.tagName.toLowerCase();

    if (Cosmetic.includes(tag)) {
      // Turn tag into editable markdown
      const span = document.createElement(`span`);
      span.classList.add(`markdown`);

      let parent, pTag;
      while (e) {
        parent = e.parentNode;
        pTag = parent.tagName.toLowerCase();
        if (Cosmetic.includes(pTag)) {
          e = parent;
          tag = pTag;
        } else {
          break;
        }
      }

      const { text, offset } = convertToMarkdown(e);
      span.textContent = text;
      e.parentNode.replaceChild(span, e);
      const editable = span.childNodes[0];
      this.update(e, editable);
      this.set(index + offset, editable);
    }

    // Did we just "get out" of an editable markdown span?
    // If so, replace it with its proper HTML equivalent.
    const editable = document.querySelector(`span.markdown`);
    if (editable && this.textNode !== editable.childNodes[0]) {
      const content = convertFromMarkDown(editable);
      const parent = editable.parentNode;
      let e = content.pop();
      parent.replaceChild(e, editable);
      while (content.length) {
        let before = content.pop();
        parent.insertBefore(before, e);
        e = before;
      }

      if (e.nodeType === 3) {
        this.update(e.parentNode, e);

        // TODO: and then we may need to merge some text nodes.
        const next = this.textNode.nextSibling;
        if (next?.nodeType === 3) {
          mergeForward(this.textNode, next);
          highlight(this.textNode);
        }

        const prev = this.textNode.previousSibling;
        if (prev?.nodeType === 3) {
          mergeForward(prev, this.textNode);
          this.update(this.element, prev);
          highlight(this.textNode);
        }

        // TODO: place the cursor...
      }
    }

    // Did we just get out of a regular text node with markdown?
    const nodes = convertFromMarkDown(this.textNode);
    if (nodes.length > 1) {
      console.log(`yeah probably`);

      // TODO: actually do this...
    }
  }

  /**
   * ...
   */
  set(pos = 0, element = this.textNode) {
    const selection = window.getSelection();
    range.setStart(element, pos);
    range.setEnd(element, pos);
    selection.removeAllRanges();
    selection.addRange(range);
    highlight(element, pos);
  }

  /**
   * ...
   */
  select(element = this.getEditable()) {
    selectElement(element);
  }
}

export const cursor = new Cursor();

export function highlight(textNode, s, first, last, range) {
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
    updateContextMenu(editable);
  }
}

let contextMenu;

export function setContextMenu(element) {
  contextMenu = element;
}

// FIXME: this should live in edit-options, but we don't want a circular dependency
function updateContextMenu(blockElement) {
  if (!contextMenu) return;
  if (!cursor.element) return;
  if (!blockElement) return;

  contextMenu.removeAttribute(`hidden`);
  let { x, y, width: w, height: h } = blockElement.getBoundingClientRect();
  if (y < 30) y = h + y + 30;

  if (contextMenu.element === cursor.element) return;
  contextMenu.element = cursor.element;
  setDims(contextMenu, x, `${y}px - 2.5em`, w, `2em`);

  document
    .querySelectorAll(`div.edit-options button.active`)
    .forEach((e) => e.classList.remove(`active`));

  // do we need to highlight anything?
  Cosmetic.forEach((tag) => {
    if (cursor.element.closest(tag)) {
      contextMenu.querySelector(`#btn-${tag}`)?.classList.add(`active`);
    }
  });

  Editable.forEach((tag) => {
    if (cursor.element.closest(tag)) {
      contextMenu.querySelector(`#btn-${tag}`)?.classList.add(`active`);
    }
  });

  contextMenu.querySelectorAll(`input`).forEach((e) => e.remove());

  const extras = contextMenu.querySelector(`.extras`);
  extras.innerHTML = ``;

  if (cursor.element.tagName.toLowerCase() === `a`) {
    console.log(`show link UI here`);
    const label = document.createElement(`label`);
    label.textContent = `Link URL:`;
    extras.appendChild(label);
    const input = document.createElement(`input`);
    input.type = `url`;
    input.value = cursor.element.href;
    extras.appendChild(input);
    input.addEventListener(`input`, (evt) => {
      cursor.element.href = input.value;
    });
  }

  if (cursor.element.tagName.toLowerCase() === `img`) {
    console.log(`show link UI here`);
    const label = document.createElement(`label`);
    label.textContent = `Image source:`;
    extras.appendChild(label);
    const input = document.createElement(`input`);
    input.type = `url`;
    input.value = cursor.element.href;
    extras.appendChild(input);
    input.addEventListener(`input`, (evt) => {
      cursor.element.src = input.value;
    });
  }
}
