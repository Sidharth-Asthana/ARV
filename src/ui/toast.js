let timer = 0;
export function toast(msg) {
  const t = document.querySelector('#toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => t.classList.remove('show'), 2600);
}
