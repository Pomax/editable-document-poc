import { Editable } from "./constants.js";
import { clean, findAll, getFirstTextNode, getLastTextNode } from "./utils.js";

// In order to make sure caret positions are sequential,
// we need to force-collapse white space in all text nodes!
const tree = document.createTreeWalker(document.body, 4, () => 1); // "text node" + "accepted"
for (let tn = tree.nextNode(); tn; tn = tree.nextNode()) {
  tn.textContent = tn.textContent.replace(/\n?\s+/g, ` `);
}

// Also remove any leading and trailing white space from
// block level elements, because that's going to cause dumb
// problems wrt caret placement, too.
findAll(Editable.join(`,`)).forEach((e) => {
  try {
    const first = getFirstTextNode(e);
    first.textContent = first.textContent.replace(/^\s+/, ``);
    const last = getLastTextNode(e);
    last.textContent = last.textContent.replace(/\s+$/, ``);
  } catch (e) {}
});

// Also, kill off any nonsense whitespace between tags where it can't do anything anyway.
clean(document.body);