import { options } from "./edit-options.js";
import { cursor } from "./cursor.js";
import { OS, Keys, Editable, Trimmable } from "./constants.js";
import { mergeForward } from "./utils.js";

// Clear out problematic whitespace before we begin.
for (const tag of Editable.concat(Trimmable)) {
  document
    .querySelectorAll(tag)
    .forEach((e) => (e.innerHTML = e.innerHTML.trim()));
}

[`click`, `touchstart`].forEach((type) => {
  document.addEventListener(type, (evt) => {
    if (!cursor.active) return;
    cursor.find();
  });
});

document.addEventListener(`keydown`, (evt) => {
  if (!cursor.active) return;

  console.log(evt);

  if (evt.repeat) {
    cursor.find();
  }

  // "Select all" should not select the entire document,
  // but only the current "editable" element block.
  const { key, metaKey, ctrlKey } = evt;
  const controlled = OS === `mac` ? metaKey : ctrlKey;

  if (key === `a` && controlled) {
    evt.preventDefault();
    cursor.select();
  }

  const boop = (tag) => {
    evt.preventDefault();
    const btn = options.querySelector(`#btn-${tag}`);
    const boop = new PointerEvent(`pointerdown`);
    Object.defineProperty(boop, `target`, { writable: false, value: btn });
    document.dispatchEvent(boop);
  };

  // custom bold/italic/code handling
  if (key === `1` && controlled) boop(`h1`);
  if (key === `2` && controlled) boop(`h2`);
  if (key === `3` && controlled) boop(`h3`);
  if (key === `4` && controlled) boop(`h4`);
  if (key === `p` && controlled) boop(`p`);
  if (key === "`" && controlled) boop(`pre`);
  if (key === `b` && controlled) boop(`strong`);
  if (key === `i` && controlled) boop(`em`);
  if (key === `c` && controlled) boop(`code`);
});

document.addEventListener(`keyup`, ({ key }) => {
  if (!cursor.active) return;
  cursor.find();

  // Text removal may need to merge adjacent text nodes
  if (key === Keys.backspace || key === Keys.delete) {
    const next = cursor.textNode.nextSibling;
    if (next?.nodeType === 3) {
      const offset = mergeForward(cursor.textNode, next);
      cursor.set(offset);
    }
  }

  // Enter may create a new div, and we want paragraphs instead.
  if (key === Keys.enter) {
    if (cursor.element.tagName.toLowerCase() === `div`) {
      const p = document.createElement(`p`);
      p.textContent = ` `;
      cursor.element.parentNode.replaceChild(p, cursor.element);
      cursor.update(p, p.childNodes[0]);
      cursor.textNode.textContent = ``;
      cursor.set();
    }
  }
});

// TODO: listening for diffs, so that we can roll/play them back.

// TODO: add in an undo history for "not handled by the browser edits",
//       i.e. swapping tags, wrapping/unwrapping, etc. If the stack has
//       operations,
