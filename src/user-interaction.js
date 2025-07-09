import { OS } from "./constants.js";
import { getFirstTextNode, range, replaceWith } from "./utils.js";
import { highlight, setSelection } from "./selection.js";
import { convertFromMarkDown } from "./markdown/index.js";
import { options, updateEditBar } from "./edit-options.js";
import { handlers } from "./content-manipulation.js";

// Used to track which element "we were in" vs. which
// element "we're in now" when looking at key handing.
const lastDown = {};

// Used to handle users ctrl/cmd-keying the current selection
const keyHandlers = {
  ".": (evt) => handlers.blockquote(evt),
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
  z: (evt) => handlers.code(evt),
  d: (evt) => handlers.del(evt),
  i: (evt) => handlers.em(evt),
  l: (evt) => handlers.a(evt),
  ArrowUp: (evt) => handlers.sup(evt),
  ArrowDown: (evt) => handlers.sub(evt),
  "/": (evt) => handlers.markdown(evt),
  a: (evt) => handlers.all(evt),
};

/**
 * What should happen when the pointer stops being down?
 */
[`pointerup`, `touchstart`].forEach((type) =>
  document.addEventListener(type, (evt) => {
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
  })
);

function getCells(table) {
  return [...table.querySelectorAll(`tr`)].map((row) => [
    ...row.querySelectorAll(`th,td`),
  ]);
}

function findCell(rows, e) {
  let x, y, row;
  for (y = 0; y < rows.length; y++) {
    row = rows[y];
    for (x = 0; x < row.length; x++) {
      if (row[x] === e) {
        return { x, y };
      }
    }
  }
  return { x: -1, y: -1 };
}

function selectCell(s, cell) {
  const tn = getFirstTextNode(cell);
  setSelection(s, range(tn, 0));
}

/**
 * What should happen when a key gets pressed
 */
document.addEventListener(`keydown`, (evt) => {
  if (evt.target.closest(`.edit-options`)) return;

  const { key, ctrlKey, metaKey } = evt;
  const special = OS === `mac` ? metaKey : ctrlKey;

  if (special) {
    keyHandlers[key]?.(evt);
    return updateEditBar();
  }

  const s = window.getSelection();
  highlight(s);
  const e = (lastDown.element = s.anchorNode.parentNode);
  lastDown.markdown = lastDown.element.closest(`.live-markdown`);

  const table = e.closest(`table`);
  if (table && (key === `ArrowDown` || key === `ArrowUp`)) {
    const cells = getCells(table);
    const dir = key === `ArrowDown` ? +1 : -1;
    const { x, y } = findCell(cells, e);
    if (x > -1 && y > -1) {
      try {
        selectCell(s, cells[y + dir][x]);
        evt.preventDefault();
      } catch (e) {
        // let the browser handle it
      }
    }
  }
});

/**
 * What should happen when a key gets released?
 */
document.addEventListener(`keyup`, (evt) => {
  if (evt.target.closest(`.edit-options`)) {
    return;
  }

  const { key } = evt;
  const { markdown, element } = lastDown;
  const s = window.getSelection();
  setSelection(s);

  let e = s.anchorNode;
  if (e?.nodeType === 3) e = e.parentNode;
  const eTag = e.tagName.toLowerCase();

  const b = e?.closest(`.live-markdown`);

  if (markdown) {
    if (e && !b) handlers.markdown(undefined, markdown);
    lastDown.markdown = false;
  }

  // Did we just do a bizarro-land table jump, where we went
  // from "an element below a table" all the way up to a
  // table's heading elements, without ever touching the
  // table's regular cells? If so, don't be stupid please.
  const table = e.closest(`table`);
  if (table && !element.closest(`table`)) {
    const { y: y1 } = table.getBoundingClientRect();
    const { y: y2 } = element.getBoundingClientRect();
    if (e.tagName.toLowerCase() === `th` && y2 > y1) {
      const cells = getCells(table);
      const x = cells[0].indexOf(e);
      const cell = cells.at(-1)[x];
      return selectCell(s, cell);
    }
  }

  // Did we just type markdown, outside of markdown
  // context? If so, we need to insta-convert that.
  const n = s.anchorNode;
  if (n === document.body) return;

  // Enter may create a <div>, and we want <p>> instead.
  if (key === `Enter`) {
    const e = n.parentNode;
    if (e && e.tagName.toLowerCase() === `div`) {
      const p = document.createElement(`p`);
      p.textContent = ` `;
      const tn = p.childNodes[0];
      tn.textContent = ``;
      e.parentNode.replaceChild(p, e);
      setSelection(s, range(tn, 0));
    }
  }

  if (e && !b) {
    if (e === document.body) return;
    const { nodes } = convertFromMarkDown(n);
    if (nodes.length > 1) {
      let tn = nodes.at(-1);
      if (nodes.length === 2) {
        tn = document.createTextNode(``);
        nodes.push(tn);
      }
      replaceWith(n, nodes);
      setSelection(s, range(tn, 0));
    }
  }
});
