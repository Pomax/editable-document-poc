import { Editable, cosmeticsMaster } from "./constants.js";
import { setDims } from "./utils.js";
import { handlers } from "./content-manipulation.js";

export const options = document.createElement(`div`);
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

export function updateEditBar(s = window.getSelection()) {
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
      // FIXME: Magic constants abound here, and there should be exactly zero
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
