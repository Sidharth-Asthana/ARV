import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, zone } from './common.js';

const P = [], BURST = [], RINGS = [];

export default {
  name: 'Particles', hint: 'tap to burst · drag to stir',
  bloom: .6,
  params: {
    count: { label: 'Count',  min: 100, max: 4000, step: 50, val: 700, reset: true },
    size:  { label: 'Size',   min: 40,  max: 300,  step: 5,  val: 100 },
    trail: { label: 'Trails', min: 0,   max: 92,   step: 2,  val: 55 },
  },
  make() {
    const [y0, y1] = zone();
    return { x: rnd() * S.W, y: y0 + rnd() * (y1 - y0), vx: 0, vy: 0,
             f: rnd(), sz: .5 + rnd() * 1.4, ph: rnd() * 7 };
  },
  reset(cfg) {
    P.length = 0; BURST.length = 0; RINGS.length = 0;
    for (let i = 0, n = Math.round(cfg.count * S.q); i < n; i++) P.push(this.make());
  },
  tap(x, y) {
    for (let i = 0, n = 44; i < n; i++) {
      const a = Math.PI * 2 * i / n + rnd() * .3, sp = 2.2 + rnd() * 4.8;
      BURST.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, f: rnd(), sz: 1 + rnd() * 2 });
    }
    RINGS.push({ x, y, r: 6, life: 1 });
  },
  drag(x, y, dx, dy) {
    const R = 110;
    for (const p of P) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < R) { const k = (1 - d / R) * .32; p.vx += dx * k; p.vy += dy * k; }
    }
  },
  step(dt, t, cfg) {
    const [y0, y1] = zone(), pace = audio.pace;
    const n = Math.round(cfg.count * S.q);
    while (P.length < n) P.push(this.make());
    P.length = Math.min(P.length, n);
    const drive = (.25 + audio.bass * 1.6) * (.5 + pace), flowV = (.5 + pace * 1.4) * S.flow;
    let jolt = null;
    if (audio.onBeat)
      jolt = { x: rnd() * S.W, y: y0 + rnd() * (y1 - y0), r: S.W * .28,
               k: audio.beatAmp * (0.7 + pace * 1.9) };
    for (const p of P) {
      const nx = Math.sin(p.y * .006 + t * .35 + p.ph) * Math.cos(p.x * .004 - t * .22);
      const ny = Math.cos(p.x * .006 - t * .3 + p.ph) * Math.sin(p.y * .004 + t * .27);
      p.vx += nx * .05 * drive + (flowV - p.vx) * .015;
      p.vy += ny * .05 * drive;
      if (p.y < y0) p.vy += (y0 - p.y) * .0022;
      if (p.y > y1) p.vy -= (p.y - y1) * .0022;
      if (jolt) {
        const dx = p.x - jolt.x, dy = p.y - jolt.y, d = Math.hypot(dx, dy);
        if (d < jolt.r) { const s = jolt.k * (1 - d / jolt.r) * 2.4 / (d || 1); p.vx += dx * s; p.vy += dy * s; }
      }
      p.vx *= .94; p.vy *= .94;
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      if (p.x < -12) p.x = S.W + 12; if (p.x > S.W + 12) p.x = -12;
    }
    for (let i = BURST.length - 1; i >= 0; i--) {
      const b = BURST[i];
      b.x += b.vx * dt * 60; b.y += b.vy * dt * 60;
      b.vx *= .955; b.vy *= .955; b.life -= dt * (.7 + pace * .6);
      if (b.life <= 0) BURST.splice(i, 1);
    }
    for (let i = RINGS.length - 1; i >= 0; i--) {
      const r = RINGS[i]; r.r += dt * (220 + audio.bass * 300); r.life -= dt * 1.4;
      if (r.life <= 0) RINGS.splice(i, 1);
    }
  },
  draw(p, t, cfg) {
    const sizeK = cfg.size / 100 * S.zoom;
    for (const q of P) {
      const r = q.sz * sizeK * (1 + audio.bass * 1.6 + audio.shimmer * .25);
      const [cr, cg, cb] = rgbAt(q.f, t);
      p.dot(q.x, q.y, r, cr, cg, cb, .8, .8);
    }
    for (const b of BURST) {
      const [cr, cg, cb] = rgbAt(b.f, t);
      p.dot(b.x, b.y, b.sz * (.5 + b.life), cr, cg, cb, b.life, .9);
    }
    for (const r of RINGS) {
      const [cr, cg, cb] = rgbAt(.5, t);
      p.ring(r.x, r.y, r.r, 1, cr, cg, cb, r.life * .5, 48);
    }
  },
};
