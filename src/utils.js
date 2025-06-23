export const create = (tag) => document.createElement(tag.toLowerCase());
export const range = (sn, so, en, eo) => {
  const r = document.createRange();
  if (sn) r.setStart(sn, so);
  if (en) r.setEnd(en, eo);
  return r;
};

export function setDims(e, x = 0, y = 0, w = `fit-content`, h = `fit-content`) {
  const val = (v) => (typeof v === `number` ? v + `px` : v);
  Object.assign(e.style, {
    top: `calc(${window.scrollY}px + ${val(y)})`,
    left: `calc(${window.scrollX}px + ${val(x)})`,
    width: val(w),
    height: val(h),
  });
}

export function getFirstTextNode(e) {
  if (e.nodeType === 3) return e;
  const first = e.childNodes[0];
  if (!first) {
    console.log(e);
    throw new Error(`there is no text node to be found`);
  }
  return getFirstTextNode(first);
}

export function getLastTextNode(e) {
  if (e.nodeType === 3) return e;
  const last = Array.from(e.childNodes).at(-1);
  if (!last) {
    throw new Error(`there is no text node to be found`);
  }
  return getLastTextNode(last);
}

export function replaceWith(element, replacements) {
  const parent = element.parentNode;
  const last = replacements.pop();

  let e = last;
  parent.replaceChild(e, element);

  while (replacements.length) {
    let before = replacements.pop();
    parent.insertBefore(before, e);
    e = before;
  }

  if (last.nodetype === 3) return last;

  return getFirstTextNode(last);
}

// removes meaningless whitespace.
// See https://www.sitepoint.com/removing-useless-nodes-from-the-dom/
export function clean(node) {
  const { childNodes } = node;
  for (let n = 0; n < childNodes.length; n++) {
    const child = childNodes[n];
    const { nodeType, nodeValue } = child;
    if (nodeType === 8 || (nodeType === 3 && !/\S/.test(nodeValue))) {
      node.removeChild(child);
      n--;
    } else if (nodeType === 1) {
      clean(child);
    }
  }
}
