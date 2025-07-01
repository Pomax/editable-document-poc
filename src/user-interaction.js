import { OS } from "./constants.js";
import { range, replaceWith } from "./utils.js";
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
  c: (evt) => handlers.code(evt),
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
 * What should happen when a key gets pressed
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

  // Enter may create a new div, and we want paragraphs instead.
  if (key === `Enter`) {
    if (eTag === `div`) {
      const p = document.createElement(`p`);
      p.textContent = ` `;
      const tn = p.childNodes[0];
      tn.textContent = ``;
      e.parentNode.replaceChild(p, e);
      const r = range(tn, 0);
      setSelection(s, r);
    }
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
      setSelection(s, range(target, 0));
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
      setSelection(s, range(target, 0));
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
      setSelection(s, range(target, 0));
      return;
    }
  }

  // Did we just type markdown, outside of markdown
  // context? If so, we need to insta-convert that.
  const n = s.anchorNode;
  if (n === document.body) return;

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
