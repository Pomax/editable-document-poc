/**
 * I, Pomax, dedicate this work to the public domain.
 * Where all code like this belongs.
 * You slap an MIT license on this, you've already added too much license.
 */

import { Editable, OS } from "../constants.js";
import {
  getFirstTextNode,
  getLastTextNode,
  replaceWith,
  setDims,
} from "../utils.js";
import { convertFromMarkDown, convertToMarkdown } from "../markdown.js";

const blocks = [`h1`, `h2`, `h3`, `h4`, `p`, `ol`, `ul`, `pre`];
const cosmeticsMaster = [`strong`, `em`, `code`, `del`, `sup`, `sub`];

const todo = (...args) => console.warn(...args);
const fixme = (...args) => console.error(...args);
const create = (tag) => document.createElement(tag.toLowerCase());
const range = (sn, so, en, eo) => {
  const r = document.createRange();
  if (sn) r.setStart(sn, so);
  if (en) r.setEnd(en, eo);
  return r;
};

// In order to make sure caret positions are sequential,
// we need to force-collapse white space in all text nodes!
const tree = document.createTreeWalker(document.body, 4, () => 1); // "text node" + "accepted"
for (let tn = tree.nextNode(); tn; tn = tree.nextNode()) {
  tn.textContent = tn.textContent.replace(/\n?\s+/g, ` `);
}

// Also remove any leading and trailing white space from
// block level elements, because that's going to cause dumb
// problems wrt caret placement, too.
document.querySelectorAll(Editable.join(`,`)).forEach((e) => {
  const first = getFirstTextNode(e);
  first.textContent = first.textContent.replace(/^\s+/, ``);
  const last = getLastTextNode(e);
  last.textContent = last.textContent.replace(/\s+$/, ``);
});

document.body.contentEditable = true;
document.body.spellcheck = true;

const handlers = {
  // block handlers
  h1: (evt) => changeBlock(`h1`, evt),
  h2: (evt) => changeBlock(`h2`, evt),
  h3: (evt) => changeBlock(`h3`, evt),
  h4: (evt) => changeBlock(`h4`, evt),
  p: (evt) => changeBlock(`p`, evt),
  ul: (evt) => changeBlock(`ul`, evt),
  ol: (evt) => changeBlock(`ol`, evt),
  pre: (evt) => changeBlock(`pre`, evt),
  // cosmetic handlers
  strong: (evt) => toggleSelection(`strong`, evt),
  code: (evt) => toggleSelection(`code`, evt),
  del: (evt) => toggleSelection(`del`, evt),
  em: (evt) => toggleSelection(`em`, evt),
  // unusual cosmetic handlers
  sup: (evt) => toggleSelection(`sup`, evt),
  sub: (evt) => toggleSelection(`sub`, evt),
  // markdown toggle
  markdown: (evt) => toggleMarkdown(evt),
  // select-all
  all: (evt) => selectBlock(evt),
};

const keyHandlers = {
  1: (evt) => handlers.h1(evt),
  2: (evt) => handlers.h2(evt),
  3: (evt) => handlers.h3(evt),
  4: (evt) => handlers.h4(evt),
  p: (evt) => handlers.p(evt),
  u: (evt) => handlers.ul(evt),
  o: (evt) => handlers.ol(evt),
  e: (evt) => handlers.pre(evt),
  b: (evt) => handlers.strong(evt),
  c: (evt) => handlers.code(evt),
  d: (evt) => handlers.del(evt),
  i: (evt) => handlers.em(evt),
  ArrowUp: (evt) => handlers.sup(evt),
  ArrowDown: (evt) => handlers.sub(evt),
  "/": (evt) => handlers.markdown(evt),
  a: (evt) => handlers.all(evt),
};

const lastDown = {};

const options = document.createElement(`div`);
options.setAttribute(`hidden`, `hidden`);
options.classList.add(`edit-options`, `ignore-for-diffing`);
document.body.append(options);

const labels = Object.keys(handlers);
options.innerHTML = labels
  .map((label) => `<button id="btn-${label}">${label}</button>`)
  .join(`\n`);

function updateEditBar(s = window.getSelection()) {
  let e = s.anchorNode;
  if (!e) return;
  if (e.nodeType === 3) e = e.parentNode;
  const liveMarkdown = !!e.closest(`.live-markdown`);
  if (e) {
    let block = e.closest(Editable.join(`,`));
    if (block) {
      const bTag = block.tagName.toLowerCase();
      const { x, y, height: h } = block.getBoundingClientRect();
      options.removeAttribute(`hidden`);
      fixme(`Magic constants abound here, and there should be exactly zero`);
      if (y < 50) {
        setDims(options, x, y + h + 10);
      } else setDims(options, x, y - 40);
      options.querySelectorAll(`button`).forEach((b) => {
        const label = b.textContent;
        b.disabled = !(
          !liveMarkdown ||
          label === `markdown` ||
          label === `all`
        );
      });
      options
        .querySelectorAll(`.active`)
        .forEach((e) => e.classList.remove(`active`));
      options.querySelector(`#btn-${bTag}`).classList.add(`active`);
      cosmeticsMaster.forEach((tag) => {
        if (e.closest(tag)) {
          options.querySelector(`#btn-${tag}`).classList.add(`active`);
        }
      });
      return;
    }
  }
  options.setAttribute(`hidden`, `hidden`);
}

options.addEventListener(`pointerdown`, (evt) => {
  const { id } = evt.target;
  let name = id.replace(`btn-`, ``);
  if (id !== name) {
    evt.preventDefault();
    evt.stopPropagation();
    if (options.querySelector(`#btn-${name}`).disabled) return;
    handlers[name]();
  }
});

/**
 * ...
 */
document.addEventListener(`pointerup`, (evt) => {
  const { target } = evt;
  const tag = target.tagName.toLowerCase();
  if (tag === `html` || tag === `body`) {
    document
      .querySelectorAll(`.highlight`)
      .forEach((e) => e.classList.remove(`highlight`));
    return options.setAttribute(`hidden`, `hidden`);
  }

  const s = window.getSelection();
  highlight(s);
  updateEditBar(s);
});

/**
 * ...
 */
document.addEventListener(`keydown`, (evt) => {
  const { key, ctrlKey, metaKey } = evt;
  const special = OS === `mac` ? metaKey : ctrlKey;
  if (special) {
    keyHandlers[key]?.(evt);
    updateEditBar();
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
  updateEditBar(s);

  let e = s.anchorNode;
  if (e?.nodeType === 3) e = e.parentNode;

  const b = e?.closest(`.live-markdown`);

  if (markdown) {
    if (e && !b) toggleMarkdown(undefined, markdown);
    lastDown.markdown = false;
  }

  // Did we just type markdown, outside of markdown
  // context? If so, we need to insta-convert that.
  if (e && !b) {
    const n = s.anchorNode;
    const { nodes } = convertFromMarkDown(n);
    if (nodes.length > 1) {
      fixme(`Cursor placement after substitution is 100% wonky`);
      replaceWith(n, nodes);
      s.removeAllRanges();
      s.addRange(range(caret, 1));
    }
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
      updateEditBar(s);
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
  evt?.preventDefault();
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

/**
 * ...
 */
function toggleMarkdown(evt, element) {
  evt?.preventDefault?.();
  let target;
  const s = window.getSelection();
  const n = s.anchorNode;
  const o = s.anchorOffset;
  const b = element ?? n.parentNode.closest(blocks.join(`,`));
  const isMarkDownBlock = b.classList.contains(`live-markdown`);

  todo(
    `we still need to make sure to update the cursor when this toggle happens`
  );

  // convert from markdown to HTML
  if (isMarkDownBlock) {
    const original = create(b.__cached_tag);
    const { nodes, anchorNode, anchorOffset } = convertFromMarkDown(b, o);
    for (const c of nodes) original.appendChild(c);
    b.parentNode.replaceChild(original, b);
    s.removeAllRanges();
    s.addRange(range(anchorNode, anchorOffset));
  }

  // convert from HTML to markdown
  else {
    const markdown = convertToMarkdown(b, n, o);
    const pre = create(`pre`);
    pre.__cached_tag = b.tagName.toLowerCase();
    pre.textContent = markdown.text;
    pre.classList.add(`live-markdown`);
    pre.style.whiteSpace = `pre-wrap`;
    b.parentNode.replaceChild(pre, b);
    target = pre.childNodes[0];
    s.removeAllRanges();
    s.addRange(range(target, markdown.caret));
  }
}

/**
 * ...
 */
function selectBlock(evt) {
  evt?.preventDefault();
  const s = window.getSelection();
  const a = s.anchorNode;
  const block = a.parentNode.closest(Editable.join(`,`));
  const first = getFirstTextNode(block);
  const last = getLastTextNode(block);
  s.removeAllRanges();
  s.addRange(range(first, 0, last, last.textContent.length));
}

fixme(`We can sometimes get spans. We never want spans.`);
fixme(`Missing <a> support on the HTML side`);
fixme(`Missing <figure><img><caption> support on the HTML side`);
