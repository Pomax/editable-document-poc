/**
 * ...
 */

import { Editable, OS } from "../constants.js";
import { getFirstTextNode } from "../utils.js";
import { convertFromMarkDown, convertToMarkdown } from "../markdown.js";

const blocks = [`h1`, `h2`, `h3`, `h4`, `p`, `ol`, `ul`, `pre`];
const cosmeticsMaster = [`strong`, `em`, `code`, `s`, `sup`, `sub`];

document.body.contentEditable = true;
document.body.spellcheck = true;

const todo = (...args) => console.warn(...args);
const fixme = (...args) => console.error(...args);
const create = (tag) => document.createElement(tag.toLowerCase());
const range = (sn, so, en, eo) => {
  const r = document.createRange();
  if (sn) r.setStart(sn, so);
  if (en) r.setEnd(en, eo);
  return r;
};

const handlers = {
  // cosmetic handlers
  b: (evt) => toggleSelection(`strong`, evt),
  c: (evt) => toggleSelection(`code`, evt),
  i: (evt) => toggleSelection(`em`, evt),
  s: (evt) => toggleSelection(`s`, evt),
  ArrowUp: (evt) => toggleSelection(`sup`, evt),
  ArrowDown: (evt) => toggleSelection(`sub`, evt),
  // block handlers
  1: (evt) => changeBlock(`h1`, evt),
  2: (evt) => changeBlock(`h2`, evt),
  3: (evt) => changeBlock(`h3`, evt),
  4: (evt) => changeBlock(`h4`, evt),
  p: (evt) => changeBlock(`p`, evt),
  u: (evt) => changeBlock(`ul`, evt),
  o: (evt) => changeBlock(`ol`, evt),
  e: (evt) => changeBlock(`pre`, evt),
  // markdown toggle
  "/": (evt) => toggleMarkdown(evt),
};

const lastDown = {};

/**
 * ...
 */
document.addEventListener(`pointerup`, (evt) => {
  const s = window.getSelection();
  highlight(s);
  const e = s.anchorNode.parentNode.closest(Editable.join(`,`));
  todo(`show the block button bar`, e);
});

/**
 * ...
 */
document.addEventListener(`keydown`, (evt) => {
  const { key, ctrlKey, metaKey } = evt;
  const special = OS === `mac` ? metaKey : ctrlKey;
  if (special) {
    handlers[key]?.(evt);
  } else {
    const s = window.getSelection();
    highlight(s);
    lastDown.markdown = s.anchorNode.parentNode.closest(`.live-markdown`);
  }
});

/**
 * ...
 */
document.addEventListener(`keyup`, (evt) => {
  const { key } = evt;
  const { markdown } = lastDown;
  const s = window.getSelection();
  highlight(s);

  let e = s.anchorNode;
  if (e.nodeType === 3) e = e.parentNode;

  if (markdown) {
    const b = e.closest(`.live-markdown`);
    if (!b) toggleMarkdown(undefined, markdown);
    lastDown.markdown = false;
  }

  // Enter may create a new div, and we want paragraphs instead.
  if (key === `Enter`) {
    const div = s.anchorNode;
    if (div.tagName.toLowerCase() === `div`) {
      const p = document.createElement(`p`);
      p.textContent = ` `;
      p.childNodes[0].textContent = ``;
      div.parentNode.replaceChild(p, div);
      const r = range(p.childNodes[0], 0);
      s.removeAllRanges();
      s.addRange(r);
    }
  }
});

function highlight(s) {
  let e = s.anchorNode;
  if (!e) return;
  if (e.nodeType === 3) e = e.parentNode;
  const p = e.closest(Editable.join(`,`));
  document
    .querySelectorAll(`.highlight`)
    .forEach((e) => e.classList.remove(`highlight`));
  if (p && !p.classList.contains(`live-markdown`)) {
    p.classList.add(`highlight`);
    e.classList.add(`highlight`);
  }
}

/**
 * ...
 */
function changeBlock(tag, evt) {
  evt.preventDefault();
  const s = window.getSelection();
  const {
    anchorNode: sn,
    anchorOffset: so,
    focusNode: en,
    focusOffset: eo,
  } = s;
  const b = s.anchorNode.parentNode.closest(blocks.join(`,`));

  if (b.closest(`.live-markdown`)) return;

  const replacement = create(tag);
  const nodes = Array.from(b.childNodes);
  for (const c of nodes) replacement.appendChild(c);
  b.parentNode.replaceChild(replacement, b);
  s.removeAllRanges();
  s.addRange(range(sn, so, en, eo));
  return replacement;
}

/**
 * ...
 */
function toggleSelection(tag, evt) {
  evt?.preventDefault();

  const s = window.getSelection();
  let offset = s.direction === `backwards` ? s.anchorOffset : s.focusOffset;
  let e = s.direction === `backwards` ? s.anchorNode : s.focusNode;
  e = e.parentNode;

  if (e.closest(`.live-markdown`)) return;

  // Are we in a {{tag}} element already?
  const f = e.closest(tag);
  let contained = false;
  if (f && e !== f) {
    e = f;
    contained = true;
  }

  const cosmetics = cosmeticsMaster.filter((v) => v !== tag);

  if (s.toString() === ``) {
    toggleEmptySelection(tag, s, offset, e, contained, cosmetics);
  } else {
    toggleRealSelection(tag, s, offset, e, contained, cosmetics);
  }

  let block = e.closest(Editable.join(`,`));
  if (!block) {
    block = s.anchorNode.parentNode.closest(Editable.join(`,`));
  }
  if (block) {
    const markdown = convertToMarkdown(block).text.trim();
    console.log(markdown);
  }
}

/**
 * ...
 */
function toggleEmptySelection(tag, s, offset, e, contained, cosmetics) {
  if (e.tagName.toLowerCase() !== tag) {
    addMarkup(tag, s, offset, e, contained, cosmetics);
  } else {
    removeMarkup(tag, s, offset, e, contained, cosmetics);
  }
}

/**
 * ...
 */
function toggleRealSelection(tag, s, offset, e, contained, cosmetics) {
  console.log(`deal with selection`);

  const overlap = s.anchorNode !== s.focusNode;

  // The simple case is if we're not dealing with markup overlap
  if (!overlap) {
    // And wrap that in a <strong> element.
    const n = create(tag);
    const r = s.getRangeAt(0);
    r.surroundContents(n);

    // Then set the caret position inside that element based on
    // what the offset was, minute the length of the content
    // up to the newly created element
    const p = n.previousSibling;
    const m = p.textContent.length;
    const c = offset - m;
    const tn = n.childNodes[0];
    r.setStart(tn, c);
    r.setEnd(tn, c);
    s.removeAllRanges();
    s.addRange(r);
  }

  // Things get surgery-annoying if there *is* overlap.
  else {
    console.warn(`this is not advised. Why are you overlapping markup?`);
  }
}

/**
 * ...
 */
function addMarkup(tag, s, offset, e, contained, cosmetics) {
  const f = e.closest(cosmetics.join(`,`));
  let nested = !!f;

  if (f) {
    // special case: are we sub'ing a sup or sup'ing a sub?
    if (f.tagName.toLowerCase() === `sub` && tag === `sup`) {
      return toggleSelection(`sub`);
    } else if (f.tagName.toLowerCase() === `sup` && tag === `sub`) {
      return toggleSelection(`sup`);
    }
    s.getRangeAt(0).selectNode(f);
  } else {
    s.modify("move", "backward", "word");
    s.modify("extend", "forward", "word");
  }

  const r = s.getRangeAt(0);
  console.log(r);

  // And wrap that in a <strong> element.
  const n = create(tag);
  r.surroundContents(n);

  // Then set the caret position inside that element based on
  // what the offset was, minute the length of the content
  // up to the newly created element
  if (!nested) {
    const p = n.previousSibling;
    const m = p.textContent.length;
    const c = offset - m;
    const tn = n.childNodes[0];
    r.setStart(tn, c);
    r.setEnd(tn, c);
  } else {
    const tn = getFirstTextNode(f);
    r.setStart(tn, offset);
    r.setEnd(tn, offset);
  }
  s.removeAllRanges();
  s.addRange(r);
}

/**
 * ...
 */
function removeMarkup(tag, s, offset, e, contained, cosmetics) {
  let c = offset;
  const p = e.parentNode;
  const n = Array.from(e.childNodes);

  console.log(`removing markup`, e);
  if (!contained) {
    // first, find the caret offset to the element we clicked
    let v = 0;
    for (const c of p.childNodes) {
      if (c === e) break;
      v += c.textContent.length;
    }
    // Paired with the seleciton offset, this gives us the caret
    // position that we need to restore the cursor to post-unwrap
    console.log(`chars to element: ${v}, offset in element: ${offset}`);
    c = offset + v;
  }

  // Migrate all the element's children out, in order (but in
  // reversed because there is only insertBefore, not insertAfter)
  let last = n.pop();
  p.replaceChild(last, e);
  while (n.length) {
    const m = n.pop();
    p.insertBefore(m, last);
    last = m;
  }

  // Merge all text nodes, because obviously, and then put the
  // caret back to where it was before we performed surgery.
  const r = s.getRangeAt(0);
  let tn;
  if (contained) {
    tn = getFirstTextNode(last);
  } else {
    p.normalize();
    let v = 0;
    for (const h of p.childNodes) {
      let u = h.textContent.length;
      if (v <= c && c <= v + u) {
        c -= v;
        tn = h;
        break;
      }
      v += u;
    }
  }

  console.log(`using`, { tn, c });

  r.setStart(tn, c);
  r.setEnd(tn, c);
  s.removeAllRanges();
  s.addRange(r);
}

function toggleMarkdown(evt, element) {
  evt?.preventDefault?.();
  let target;
  const s = window.getSelection();
  const b = element ?? s.anchorNode.parentNode.closest(blocks.join(`,`));

  // convert from markdown to HTML
  if (b.classList.contains(`live-markdown`)) {
    const original = b.__cached;
    const nodes = convertFromMarkDown(b);
    for (const c of nodes) original.appendChild(c);
    b.parentNode.replaceChild(original, b);
    target = getFirstTextNode(original);
  }

  // convert from HTML to markdown
  else {
    const markdown = convertToMarkdown(b);
    const pre = create(`pre`);
    pre.__cached = create(b.tagName);
    pre.textContent = markdown.text.trim();
    pre.classList.add(`live-markdown`);
    pre.style.whiteSpace = `pre-wrap`;
    b.parentNode.replaceChild(pre, b);
    target = getFirstTextNode(pre);
  }

  todo(`figure out where the heck to put the cursor`); // TODO

  if (!element) {
    const r = range(target, 0);
    s.removeAllRanges();
    s.addRange(r);
  }
}
