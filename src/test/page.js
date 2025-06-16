import { OS } from "../constants.js";
import { getFirstTextNode } from "../utils.js";

document.body.contentEditable = true;
document.body.spellcheck = true;

const create = (tag) => document.createElement(tag);

document.addEventListener(`keydown`, (evt) => {
  const { key, ctrlKey, metaKey } = evt;

  const special = OS === `mac` ? metaKey : ctrlKey;

  if (key === `b` && special) {
    makeSelection(evt, `strong`);
  }
  if (key === `i` && special) {
    makeSelection(evt, `em`);
  }
  if (key === `c` && special) {
    makeSelection(evt, `code`);
  }
  if (key === `s` && special) {
    makeSelection(evt, `s`);
  }
  if (key === `ArrowUp` && special) {
    makeSelection(evt, `sup`);
  }
  if (key === `ArrowDown` && special) {
    makeSelection(evt, `sub`);
  }
});

const cosmeticsMaster = [`strong`, `em`, `code`, `s`, `sup`, `sub`];

function makeSelection(evt, tag) {
  evt.preventDefault();
  const s = window.getSelection();
  let offset = s.direction === `backwards` ? s.anchorOffset : s.focusOffset;
  let e = s.direction === `backwards` ? s.anchorNode : s.focusNode;
  e = e.parentNode;

  // Are we in a {{tag}} element already?
  const f = e.closest(tag);
  let nested = false;
  if (f && e !== f) {
    e = f;
    nested = true;
  }

  const cosmetics = cosmeticsMaster.filter((v) => v !== tag);

  // Is this a plain caret, rather than text selection?
  if (s.toString() === ``) {
    // Remove markup
    if (e.tagName.toLowerCase() === tag) {
      let c = offset;
      const p = e.parentNode;
      const n = Array.from(e.childNodes);

      console.log(`removing markup`, e);
      if (!nested) {
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
      if (nested) {
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

    // Add markup by expanding our caret to a either a preexisting
    // cosmetic block selection, or single word selection
    else {
      const f = e.closest(cosmetics.join(`,`));
      let nested = !!f;

      if (f) {
        // special case: are we su'ing a sup or sup'ing a sub?
        if (f.tagName.toLowerCase() === `sub` && tag === `sup`) {
          return makeSelection(evt, `sub`);
        } else if (f.tagName.toLowerCase() === `sup` && tag === `sub`) {
          return makeSelection(evt, `sup`);
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
  }

  // This is a text selection
  else {
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
}
