import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd } from './common.js';

const P = [];
function make(fresh) {
  return { x: rnd() * S.W, y: fresh ? -20 - rnd() * 40 : rnd() * S.H,
           vx: 0, vy: 0, f: rnd(), sz: 2.6 + rnd() * 2.6,
           rot: rnd() * 7, vr: (rnd() - .5) * 2, sway: rnd() * 7, spark: 0 };
}

export default {
  name: 'Petals', hint: 'tap for a gust · drag to steer the wind',
  bloom: .45,
  params: {
    count: { label: 'Petals', min: 20, max: 220, step: 5,  val: 70, reset: true },
    fall:  { label: 'Fall',   min: 40, max: 220, step: 5,  val: 100 },
    gust:  { label: 'Gusts',  min: 40, max: 220, step: 5,  val: 100 },
  },
  reset(cfg) {
    P.length = 0;
    for (let i = 0, n = Math.round(cfg.count * S.q); i < n; i++) P.push(make(false));
  },
  tap(x, y, cfg) {
    const g = cfg.gust / 100;
    for (const p of P) {
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
      if (d < 160) { const k = (1 - d / 160) * 5 * g / (d || 1);
        p.vx += dx * k * 60; p.vy += (dy * k - 1.4 * (1 - d / 160)) * 60; p.vr += (rnd() - .5) * 8; }
    }
  },
  drag(x, y, dx, dy) {
    for (const p of P) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 140) { const k = (1 - d / 140) * .25 * 60; p.vx += dx * k; p.vy += dy * k; p.vr += dx * .01; }
    }
  },
  step(dt, t, cfg) {
    const pace = audio.pace;
    const n = Math.round(cfg.count * S.q);
    while (P.length < n) P.push(make(true));
    P.length = Math.min(P.length, n);
    const gustK = cfg.gust / 100;
    if (audio.onBeat) {
      const g = audio.beatAmp * (28 + pace * 70) * gustK;
      for (const p of P) { p.vx += S.flow * g * (.5 + rnd()); p.vr += (rnd() - .5) * 4 * audio.beatAmp; }
    }
    if (audio.onShimmer && P.length)
      for (let i = 0; i < 3; i++) P[Math.floor(rnd() * P.length)].spark = 1;
    const fall = (16 + pace * 16) * cfg.fall / 100,
          breeze = S.flow * (14 + pace * 36 + audio.level * 30);
    for (const p of P) {
      p.vx += (breeze + Math.sin(t * .8 + p.sway) * 12 - p.vx) * .02 * 60 * dt;
      p.vy += (fall + Math.sin(t * 1.3 + p.sway * 2) * 6 - p.vy) * .03 * 60 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += (p.vr + audio.level * 1.2) * dt;
      p.vr *= .985; p.spark *= .92;
      if (p.y > S.H + 24) Object.assign(p, make(true));
      if (p.x < -24) p.x = S.W + 24; if (p.x > S.W + 24) p.x = -24;
    }
  },
  draw(p, t) {
    for (const q of P) {
      const a = .5 + .45 * Math.min(1, q.spark + audio.beatGlow * .4);
      const s = q.sz * S.zoom * (1 + audio.bass * .35);
      const [cr, cg, cb] = rgbAt(q.f, t);
      p.disc(q.x, q.y, s, s * .55, q.rot, cr, cg, cb, a, .3);
    }
  },
};
