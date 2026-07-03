/* Canvas2D fallback painter implementing the same API as the WebGL
   painter. No trails or bloom — just clean additive drawing — so weak
   or WebGL-less devices still get the full app. */
export function create2DPainter(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, light = false;

  function resize(w, h, dpr, q) {
    W = w; H = h;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function begin() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
  }
  const css = (r, g, b, a) =>
    `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${Math.min(1, a)})`;

  function dot(x, y, rad, r, g, b, a, soft = .6) {
    if (soft > .05) {
      ctx.fillStyle = css(r, g, b, a * .12 * soft);
      ctx.beginPath(); ctx.arc(x, y, rad * 2.6, 0, 7); ctx.fill();
    }
    ctx.fillStyle = css(r, g, b, a);
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
  }
  function disc(x, y, rx, ry, rot, r, g, b, a, soft = .6) {
    ctx.fillStyle = css(r, g, b, a);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7); ctx.fill();
  }
  function seg(x1, y1, x2, y2, w, r, g, b, a) {
    ctx.strokeStyle = css(r, g, b, a);
    ctx.lineWidth = w * 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function poly(pts, n, w, r, g, b, a) {
    ctx.strokeStyle = css(r, g, b, a);
    ctx.lineWidth = w * 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++)
      i === 0 ? ctx.moveTo(pts[0], pts[1]) : ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();
  }
  function ring(cx, cy, rad, w, r, g, b, a) {
    ctx.strokeStyle = css(r, g, b, a);
    ctx.lineWidth = w * 2;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
  }
  function flush() { ctx.globalCompositeOperation = 'source-over'; }
  function clear() {}

  return { kind: '2d', resize, begin, clear, dot, disc, seg, poly, ring, flush };
}
