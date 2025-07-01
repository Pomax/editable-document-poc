import { Editable } from "./constants.js";
import { updateEditBar } from "./edit-options.js";

/**
 * ...
 */
export function setSelection(s, r) {
  if (r) {
    s.removeAllRanges();
    s.addRange(r);
  }
  highlight(s);
  updateEditBar(s);
}

/**
 * ...
 */
export function highlight(s) {
  let e = s.anchorNode;
  if (!e) return;
  if (e.nodeType === 3) e = e.parentNode;
  const block = e.closest(Editable.join(`,`));
  document
    .querySelectorAll(`.highlight`)
    .forEach((e) => e.classList.remove(`highlight`));
  if (block && !block.classList.contains(`live-markdown`)) {
    block.classList.add(`highlight`);
    e.classList.add(`highlight`);
  }
}
