/**
 * I, Pomax, dedicate this work to the public domain.
 * Where all code like this belongs.
 * You slap an MIT license on this, you've already added too much license.
 */

import { OS } from "./constants.js";
import {
  getFirstTextNode,
  getLastTextNode,
  replaceWith,
  setDims,
  clean,
} from "./utils.js";
import { convertToMarkdown, convertFromMarkDown } from "./markdown.js";

const blocks = [
  `h1`,
  `h2`,
  `h3`,
  `h4`,
  `p`,
  `ol`,
  `ul`,
  `pre`,
  `blockquote`,
  `table`,
];
const cosmeticsMaster = [`strong`, `em`, `code`, `del`, `sup`, `sub`, `a`];

const Editable = blocks;

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

// Also, kill off any nonsense whitespace between tags where it can't do anything anyway.
clean(document.body);

// Also remove any leading and trailing white space from
// block level elements, because that's going to cause dumb
// problems wrt caret placement, too.
document.querySelectorAll(Editable.join(`,`)).forEach((e) => {
  try {
    const first = getFirstTextNode(e);
    first.textContent = first.textContent.replace(/^\s+/, ``);
    const last = getLastTextNode(e);
    last.textContent = last.textContent.replace(/\s+$/, ``);
  } catch (e) {}
});

// we could use designMode on the document, but we
// also want spell check enabled, so might as well
// keep everything local to the document body.
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
  table: (evt) => formTable(evt),
  // cosmetic handlers
  strong: (evt) => toggleSelection(`strong`, evt),
  code: (evt) => toggleSelection(`code`, evt),
  del: (evt) => toggleSelection(`del`, evt),
  em: (evt) => toggleSelection(`em`, evt),
  a: (evt) =>
    toggleSelection(`a`, evt, (a) => {
      console.log(`after`, a);
      if (a) a.href = ``;
    }),
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
  t: (evt) => handlers.table(evt),
  b: (evt) => handlers.strong(evt),
  c: (evt) => handlers.code(evt),
  d: (evt) => handlers.del(evt),
  i: (evt) => handlers.em(evt),
  l: (evt) => handlers.a(evt),
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
options.innerHTML =
  labels
    .map((label) => `<button id="btn-${label}">${label}</button>`)
    .join(`\n`) +
  `<span style="flex-basis: 100%; height: 0"></span>` +
  `<span class="extra"></span>`;

function updateEditBar(s = window.getSelection()) {
  let e = s.anchorNode;
  if (!e) return;
  if (e.nodeType === 3) e = e.parentNode;
  const liveMarkdown = !!e.closest(`.live-markdown`);
  if (e) {
    const eTag = e.tagName.toLowerCase();
    let block = e.closest(Editable.join(`,`));
    if (block) {
      let extraHeight = 0;
      const bTag = block.tagName.toLowerCase();
      const { x, y, height: h } = block.getBoundingClientRect();
      options.removeAttribute(`hidden`);
      fixme(`Magic constants abound here, and there should be exactly zero`);
      if (y < 50) {
        extraHeight = -(h + 10);
      } else {
        extraHeight = 40;
      }
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
      const extras = options.querySelector(`.extra`);
      extras.innerHTML = ``;
      // link extras: the href attribute
      if (eTag === `a`) {
        extras.innerHTML = `
        <div>
          <label>URL:</label>
          <input type="url" value="${e.href}" style="width: 40em">
        </div>
        `;
        extras
          .querySelector(`[type="url"]`)
          .addEventListener(`input`, (evt) => {
            e.href = evt.target.value;
          });
        extraHeight += 25;
      }
      // table extras: row x col x "headers or plain"
      if (bTag === `table`) {
        let rows, rc, cols, cc;
        const tbody = block.querySelector(`tbody`);
        const update = () => {
          rows = Array.from(block.querySelectorAll(`tr`));
          rc = rows.length;
          cols = rows[0].querySelectorAll(`td,th`);
          cc = cols.length;
        };
        update();

        extras.innerHTML = `
          <div>
            <label>rows:</label>
            <input name="rows" type="number" value="${rc}" min="2" step="1"> 
            <label>columns:</label>
            <input name="cols" type="number" value="${cc}" min="1" step="1"> 
          </div>
        `;

        // Pretty inefficient, but it gets the job done for now.
        extras
          .querySelector(`input[name="rows"]`)
          .addEventListener(`change`, (evt) => {
            let rowCount = parseFloat(evt.target.value);
            while (rowCount < rc) {
              const rem = rows.pop();
              rem.parentNode.removeChild(rem);
              update();
            }
            while (rowCount > rc) {
              const row = create(`tr`);
              for (let cell of cols) {
                cell = create(`td`);
                cell.textContent = `-`;
                row.appendChild(cell);
              }
              tbody.appendChild(row);
              update();
            }
          });

        // especially this one. Super silly.
        extras
          .querySelector(`input[name="cols"]`)
          .addEventListener(`change`, (evt) => {
            let colCount = parseFloat(evt.target.value);
            while (colCount < cc) {
              rows.forEach((row) => {
                const cols = Array.from(row.querySelectorAll(`th,td`));
                cols.at(-1).remove();
              });
              update();
            }
            while (colCount > cc) {
              rows.forEach((row, i) => {
                const tag = i === 0 ? `th` : `td`;
                const cell = create(tag);
                cell.textContent = `-`;
                row.appendChild(cell);
              });
              update();
            }
          });

        extraHeight += 25;
      }
      setDims(options, x, y - extraHeight);
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

  if (target.closest(`.edit-options`)) {
    return;
  }

  const s = window.getSelection();
  highlight(s);
  updateEditBar(s);
});

/**
 * ...
 */
document.addEventListener(`keydown`, (evt) => {
  if (evt.target.closest(`.edit-options`)) return;

  const { key, ctrlKey, metaKey } = evt;
  const special = OS === `mac` ? metaKey : ctrlKey;
  if (special) {
    keyHandlers[key]?.(evt);
    updateEditBar();
  } else {
    const s = window.getSelection();
    highlight(s);
    lastDown.element = s.anchorNode.parentNode;
    lastDown.markdown = lastDown.element.closest(`.live-markdown`);
  }
});

/**
 * ...
 */
document.addEventListener(`keyup`, (evt) => {
  if (evt.target.closest(`.edit-options`)) return;

  const { key } = evt;
  const { markdown, element } = lastDown;
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

  // the table head does some weird things, stealing the focus
  // for the entire table, as if there is no tbody to work with.
  // So: check if we're leaving a <th> and if so, do the right
  // thing instead.
  if (element?.tagName.toLowerCase() === `th`) {
    // Are we exiting a table heading cell?
    if (key === `ArrowDown`) {
      const table = element.closest(`table`);
      const index = Array.from(table.querySelectorAll(`thead tr th`)).findIndex(
        (n) => n === element
      );
      const qs = `tbody tr td:nth-child(${1 + index})`;
      const target = table.querySelector(qs);
      s.removeAllRanges();
      s.addRange(range(target, 0));
      highlight(s);
      updateEditBar(s);
      return;
    }
  }
  // if we're entering a table header cell, did we just skip the entire tbody?
  else if (e?.tagName.toLowerCase() === `th`) {
    const { y: y1 } = element.getBoundingClientRect();
    const { y: y2 } = e.getBoundingClientRect();
    if (y1 > y2) {
      // we did. Go to the last (corresponding) element in tbody, instead.
      const table = e.closest(`table`);
      const index = Array.from(table.querySelectorAll(`thead tr th`)).findIndex(
        (n) => n === e
      );
      const qs = `tbody tr:last-child td:nth-child(${1 + index})`;
      const target = table.querySelector(qs);
      s.removeAllRanges();
      s.addRange(range(target, 0));
      highlight(s);
      updateEditBar(s);
      return;
    }
  }
  // or, did we just skip up past our heading? Get back here.
  else if (element?.tagName.toLowerCase() === `td`) {
    const eTag = e.tagName.toLowerCase();
    if (eTag !== `td` && eTag !== `th` && key === `ArrowUp`) {
      const table = element.closest(`table`);
      const index = Array.from(
        table.querySelectorAll(`tbody tr:nth-child(1) td`)
      ).findIndex((n) => n === element);
      const qs = `thead tr th:nth-child(${1 + index})`;
      const target = table.querySelector(qs);
      s.removeAllRanges();
      s.addRange(range(target, 0));
      highlight(s);
      updateEditBar(s);
      return;
    }
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

/**
 * ...
 */
function highlight(s) {
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
    block.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "center",
    });
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
    s.removeAllRanges();
    s.addRange(r);
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
  s.removeAllRanges();
  s.addRange(r);

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
    // const original = create(b.__cached_tag);
    // const { nodes, anchorNode, anchorOffset } = convertFromMarkDown(b, o);
    // for (const c of nodes) original.appendChild(c);

    const { nodes, anchorNode, anchorOffset } = convertFromMarkDown(b, o);
    let original = nodes[0];
    if (original.tagName?.toLowerCase() !== b.__cached_tag) {
      original = create(b.__cached_tag);
      for (const c of nodes) original.appendChild(c);
    }
    b.parentNode.replaceChild(original, b);
    s.removeAllRanges();
    s.addRange(range(anchorNode, anchorOffset));
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
    s.removeAllRanges();
    s.addRange(range(target, caret));
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
