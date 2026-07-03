let last = 0;
export function buzz(pattern) {
  const n = performance.now();
  if (n - last < 70) return;
  last = n;
  if (navigator.vibrate) try { navigator.vibrate(pattern); } catch (_) {}
}
