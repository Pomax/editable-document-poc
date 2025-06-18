const range = document.createRange();

export function mergeForward(textNode, next) {
  const offset = textNode.textContent.length;
  textNode.textContent += next.textContent;
  textNode.parentNode.removeChild(next);
  return offset;
}

export function selectElement(element) {
  const selection = window.getSelection();
  range.selectNode(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

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
