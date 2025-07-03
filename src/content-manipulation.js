import { Editable, cosmeticsMaster } from "./constants.js";
import { getFirstTextNode, getLastTextNode, create, range } from "./utils.js";
import { setSelection } from "./selection.js";
import { convertToMarkdown, convertFromMarkDown } from "./markdown/index.js";

export const handlers = {
  // block handlers
  blockquote: (evt) => changeBlock(`blockquote`, evt),
  h1: (evt) => changeBlock(`h1`, evt),
  h2: (evt) => changeBlock(`h2`, evt),
  h3: (evt) => changeBlock(`h3`, evt),
  h4: (evt) => changeBlock(`h4`, evt),
  p: (evt) => changeBlock(`p`, evt),
  ul: (evt) => changeBlock(`ul`, evt),
  ol: (evt) => changeBlock(`ol`, evt),
  pre: (evt) => changeBlock(`pre`, evt),
  table: (evt) => formTable(evt),
  // cosmetic handlers
  strong: (evt) => toggleSelection(`strong`, evt),
  code: (evt) => toggleSelection(`code`, evt),
  del: (evt) => toggleSelection(`del`, evt),
  em: (evt) => toggleSelection(`em`, evt),
  a: (evt) =>
    toggleSelection(`a`, evt, (a) => {
      if (a) a.href = ``;
    }),
  // unusual cosmetic handlers
  sup: (evt) => toggleSelection(`sup`, evt),
  sub: (evt) => toggleSelection(`sub`, evt),
  img: (evt) => addImage(`img`, evt),
  // markdown toggle
  markdown: (evt) => toggleMarkdown(evt),
};

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
  const b = s.anchorNode.parentNode.closest(Editable.join(`,`));

  if (b.closest(`.live-markdown`)) return;

  const replacement = create(tag);
  const nodes = Array.from(b.childNodes);
  for (const c of nodes) replacement.appendChild(c);
  b.parentNode.replaceChild(replacement, b);
  setSelection(s, range(sn, so, en, eo));
  return replacement;
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
  setSelection(s, range(first, 0, last, last.textContent.length));
}

/**
 * ...
 */
function toggleSelection(tag, evt, afterCreating) {
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
    const n = toggleEmptySelection(tag, s, offset, e, contained, cosmetics);
    afterCreating?.(n);
  } else {
    const n = toggleRealSelection(tag, s, offset, e, contained, cosmetics);
    afterCreating?.(n);
  }

  let block = e.closest(Editable.join(`,`));
  if (!block) {
    block = s.anchorNode.parentNode.closest(Editable.join(`,`));
  }
}

/**
 * ...
 */
function toggleEmptySelection(tag, s, offset, e, contained, cosmetics) {
  if (e.tagName.toLowerCase() !== tag) {
    return addMarkup(tag, s, offset, e, contained, cosmetics);
  } else {
    return removeMarkup(tag, s, offset, e, contained, cosmetics);
  }
}

/**
 * ...
 */
function toggleRealSelection(tag, s, offset, e, contained, cosmetics) {
  console.log(`deal with selection`);

  let node = undefined;
  const overlap = s.anchorNode !== s.focusNode;

  // The simple case is if we're not dealing with markup overlap
  if (!overlap) {
    const n = create(tag);
    const r = s.getRangeAt(0);
    r.surroundContents(n);
    node = n.parentNode;

    // Then set the caret position inside that element based on
    // what the offset was, minus the length of the content up
    // to the newly created element
    const p = n.previousSibling;
    const m = p.textContent.length;
    const c = offset - m;
    const tn = n.childNodes[0];
    r.setStart(tn, c);
    r.setEnd(tn, c);
    setSelection(s, r);
  }

  // Things get surgery-annoying if there *is* overlap.
  else {
    console.warn(`this is not advised. Why are you overlapping markup?`);
  }

  return node;
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

  setSelection(s, r);
  return n;
}

/**
 * ...
 */
function removeMarkup(tag, s, offset, e, contained, cosmetics) {
  let c = offset;
  const p = e.parentNode;
  const n = Array.from(e.childNodes);

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

  r.setStart(tn, c);
  r.setEnd(tn, c);
  setSelection(s, r);
}

/**
 * ...
 */
function toggleMarkdown(evt, element) {
  evt?.preventDefault?.();
  let target;
  const s = window.getSelection();
  let n = s.anchorNode;
  // figures can have ... weird behaviour, due to the img element
  // not having a text node as child (it's a void element)
  if (n.tagName?.toLowerCase() === `figure`) {
    n = n.querySelector(`figcaption`).childNodes[0];
  }
  const o = s.anchorOffset;
  const b = element ?? n.parentNode.closest(Editable.join(`,`));
  const isMarkDownBlock = b.classList.contains(`live-markdown`);

  // convert from markdown to HTML
  if (isMarkDownBlock) {
    const { nodes, anchorNode, anchorOffset } = convertFromMarkDown(b, o);
    let last = nodes.pop();
    b.parentNode.replaceChild(last, b);
    while (nodes.length) {
      const _ = nodes.pop();
      last.parentNode.insertBefore(_, last);
      last = _;
    }
    setSelection(s, range(anchorNode, anchorOffset));
    anchorNode.parentNode.normalize();
  }

  // convert from HTML to markdown
  else {
    const { text, caret } = convertToMarkdown(b, n, o);
    const pre = create(`pre`);
    pre.__cached_tag = b.tagName.toLowerCase();
    pre.textContent = text;
    pre.classList.add(`live-markdown`);
    pre.style.whiteSpace = `pre-wrap`;
    b.parentNode.replaceChild(pre, b);
    target = pre.childNodes[0];
    setSelection(s, range(target, caret));
  }
}

/**
 * ...
 */
function addImage(evt) {
  evt?.preventDefault?.();
  let target;
  const s = window.getSelection();
  const n = s.focusNode;
  const o = s.focusOffset;

  console.log(n);

  const e = n.parentNode.closest(Editable.join(`,`));

  const f = create(`figure`);
  const i = create(`img`);
  i.src = `https://placehold.co/600x400/EEE/31343C`;
  i.alt = `please indicate a source`;
  f.appendChild(i);
  const c = create(`figcaption`);
  c.textContent = `placeholder text`;
  f.appendChild(c);

  if (o === 0) {
    e.parentNode.insertBefore(f, e);
  } else {
    const s = e.nextSibling;
    if (s) {
      e.parentNode.insertBefore(f, s);
    } else {
      e.parentNode.appendChild(f);
    }
  }

  setSelection(s, range(c.childNodes[0], 0));
}
