import { cursor, highlight, setContextMenu } from "./cursor.js";
import { mergeForward } from "./utils.js";
import { toggleMarkdown } from "./markdown.js";

export const options = document.createElement(`div`);
options.classList.add(`edit-options`, `ignore-for-diffing`);
document.body.append(options);

setContextMenu(options);

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
  markdown: () => toggleMarkdown(cursor.element),
};

const labels = Object.keys(handleEdit);

options.innerHTML =
  labels
    .map((label) => `<button id="btn-${label}">${label}</button>`)
    .join(`\n`) + `<span class="extras"></span>`;

document.addEventListener(`pointerdown`, ({ target }) => {
  const { id } = target;
  const name = id.replace(`btn-`, ``);
  if (id !== name) {
    handleEdit[name]();
  }
});

options.setAttribute(`hidden`, `hidden`);

/**
 * ...
 */
function changeTag(newTag) {
  const selection = window.getSelection();
  console.log(selection);
  const { anchorOffset: pos } = selection;
  const e = cursor.getEditable();
  if (!e) return;

  const newElement = document.createElement(newTag);
  const nodes = Array.from(e.childNodes);
  do {
    newElement.appendChild(nodes.shift());
  } while (nodes.length);

  if (e === cursor.element) {
    cursor.update(newElement);
  }
  e.parentNode.replaceChild(newElement, e);
  cursor.set(pos);
  options.element = undefined;
  highlight(cursor.textNode);
}

/**
 * ...
 */
function wrapTextIn(tag) {
  const selection = window.getSelection();
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  let start = { offset: anchorOffset, node: anchorNode };
  let end = { offset: focusOffset, node: focusNode };

  // FIXME: TODO: if this is a markdown span, we should unspan it.

  // If we don't have a selection, either select whatever word
  // the cursor is currently on, or if we're in a cosmetic element
  // already, select that entire element.
  if (start.offset === end.offset && start.node === end.node) {
    const chained = cursor.textNode.parentNode.closest(tag);
    if (chained) {
      cursor.select(chained);
    } else {
      selection.modify("move", "backward", "word");
      selection.modify("extend", "forward", "word");
    }
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

  const currentTag = cursor.element.tagName.toLowerCase();

  if (start.node === end.node) {
    // simple case, where we're wrapping text inside a single text node,
    // but we do need to make sure that "bolding bold unbolds", rather
    // than blindly nesting the same tag inside itself.
    if (tag === currentTag) {
      // "untag" the content
      const parent = cursor.element.parentNode;
      const textNode = cursor.element.childNodes[0];
      parent.replaceChild(textNode, cursor.element);
      cursor.update(parent, textNode);
      let cursorPos = textNode.textContent.length;

      // Do we need to stitch a bunch of text nodes together again now?
      const prev = cursor.textNode.previousSibling;
      if (prev?.nodeType === 3) {
        cursorPos += mergeForward(prev, cursor.textNode);
        cursor.update(cursor.element, prev);
      }

      const next = cursor.textNode.nextSibling;
      if (next?.nodeType === 3) {
        mergeForward(cursor.textNode, next);
      }

      cursor.set(cursorPos);
    }

    // embedded change, e.g. <strong><em>...</em></strong> and we're un-strong-ing
    else if (cursor.element.closest(tag)) {
      const wrapper = cursor.element.closest(tag);
      wrapper.parentNode.replaceChild(cursor.element, wrapper);
    }

    // "tag" the selection
    else {
      // Note that we need to trim our wrap text, because we don't want
      // spurious spaces at the start or end of the wrapping tags.
      // spurious spaces at the start or end of the wrapping tags.
      let wrapText = cursor.textNode.textContent.substring(
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
        cursor.textNode.textContent.substring(0, start.offset)
      );

      const wrapped = document.createElement(tag);
      wrapped.textContent = wrapText;

      cursor.element.insertBefore(wrapped, cursor.textNode);
      cursor.element.insertBefore(before, wrapped);
      cursor.textNode.textContent = cursor.textNode.textContent.substring(
        end.offset
      );
    }
  }

  // TODO make sure the cursor's "back" in the "same" place
}

function pickImage() {
  // TODO: actually do what this says - also make this figure based, not just "image". It's 2025.
}
