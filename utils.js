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

export function setDims(e, x = 0, y = 0, w = 0, h = 0) {
  const val = (v) => (typeof v === `number` ? v + `px` : v);
  Object.assign(e.style, {
    top: `calc(${window.scrollY}px + ${val(y)})`,
    left: `calc(${window.scrollX}px + ${val(x)})`,
    width: val(w),
    height: val(h),
  });
}

export function getFirstTextNode(e) {
  const first = e.childNodes[0];
  if (!first) return;
  if (first.nodetype === 3) return first;
  return getFirstTextNode(first);
}
