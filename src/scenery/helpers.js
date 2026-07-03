export function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = s * 1664525 + 1013904223 >>> 0) / 4294967296);
}
export function ridge(c, w, h, yFrac, ampFrac, color, seed, pts = 48) {
  const R = lcg(seed), a = R() * 6, b = R() * 6, f1 = 1.2 + R() * 1.6, f2 = 3 + R() * 3;
  const yBase = h * yFrac, amp = h * ampFrac;
  c.fillStyle = color; c.beginPath(); c.moveTo(-2, h + 2);
  for (let i = 0; i <= pts; i++) {
    const fx = i / pts;
    const y = yBase - (Math.sin(fx * f1 * Math.PI + a) * .62 + Math.sin(fx * f2 * Math.PI + b) * .38) * amp;
    c.lineTo(fx * w, y);
  }
  c.lineTo(w + 2, h + 2); c.closePath(); c.fill();
}
export function twinkle(c, t, w, h, yMax, n, seed, alpha, col = '226,232,255') {
  const R = lcg(seed);
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h * yMax, r = .4 + R() * 1.1,
          base = .25 + R() * .5, sp = .4 + R() * 1.6, ph = R() * 7;
    c.fillStyle = `rgba(${col},${alpha * base * (.55 + .45 * Math.sin(t * sp + ph))})`;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
}
export function vGrad(c, w, h, stops) {
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
export function glowSpot(c, x, y, r, col) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
export function shootingStar(c, t, w, h, period, seed) {
  const cyc = Math.floor(t / period), ph = (t % period) / period;
  if (ph > .06) return;
  const R = lcg(seed + cyc), p = ph / .06;
  const x0 = w * (.1 + R() * .7), y0 = h * (.06 + R() * .2);
  const x = x0 + p * w * .16, y = y0 + p * h * .07;
  const g = c.createLinearGradient(x, y, x - w * .05, y - h * .022);
  g.addColorStop(0, `rgba(235,240,255,${.7 * (1 - p)})`);
  g.addColorStop(1, 'rgba(235,240,255,0)');
  c.strokeStyle = g; c.lineWidth = 1.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x - w * .05, y - h * .022); c.stroke();
}
export function auroraRibbons(c, t, w, h) {
  for (let i = 0; i < 3; i++) {
    const breathe = .7 + .3 * Math.sin(t * .4 + i * 2.1);
    const g = c.createLinearGradient(0, h * (.08 + i * .09), 0, h * (.3 + i * .09));
    const col = i === 1 ? `rgba(120,90,255,${.10 * breathe})` : `rgba(60,245,150,${.12 * breathe})`;
    g.addColorStop(0, 'rgba(60,245,150,0)');
    g.addColorStop(.5, col);
    g.addColorStop(1, 'rgba(60,245,150,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, h * (.30 + i * .06));
    for (let j = 0; j <= 32; j++) { const fx = j / 32;
      c.lineTo(fx * w, h * (.20 + i * .07) + Math.sin(fx * 4 + i * 2 + t * .25) * h * .05); }
    for (let j = 32; j >= 0; j--) { const fx = j / 32;
      c.lineTo(fx * w, h * (.30 + i * .07) + Math.sin(fx * 4 + i * 2 + t * .25) * h * .05); }
    c.closePath(); c.fill();
  }
}
