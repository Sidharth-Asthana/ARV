import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, zone } from './common.js';

const M = 120;
let lines = [], acc = 0;
const pts = new Float32Array(M * 2);

export default {
  name: 'Waves', hint: 'tap or drag to ripple · flick to set flow',
  bloom: .5,
  params: {
    lines: { label: 'Lines',     min: 3,  max: 12,  step: 1, val: 6, reset: true },
    amp:   { label: 'Amplitude', min: 40, max: 220, step: 5, val: 100 },
    trail: { label: 'Trails',    min: 0,  max: 80,  step: 2, val: 20 },
  },
  reset(cfg) {
    lines = [];
    const n = cfg.lines;
    for (let i = 0; i < n; i++)
      lines.push({ f: n === 1 ? .5 : i / (n - 1), u: new Float32Array(M), v: new Float32Array(M),
                   k: 2 + i % 4, ph: rnd() * 7, band: i % 3 });
  },
  tap(x, y) {
    const fx = x / S.W, [y0, y1] = zone(), n = lines.length;
    for (const [li, l] of lines.entries()) {
      const ly = y0 + (y1 - y0) * (li + .5) / n;
      const near = Math.exp(-Math.pow((y - ly) / (S.H * .18), 2));
      const amp = S.H * .09 * (.25 + .75 * near);
      for (let j = 0; j < M; j++) {
        const d = j / (M - 1) - fx;
        l.u[j] += amp * Math.exp(-d * d * 160);
      }
    }
  },
  drag(x, y, dx, dy) {
    const fx = x / S.W, [y0, y1] = zone(), n = lines.length;
    for (const [li, l] of lines.entries()) {
      const ly = y0 + (y1 - y0) * (li + .5) / n;
      const near = Math.exp(-Math.pow((y - ly) / (S.H * .10), 2));
      if (near < .02) continue;
      for (let j = 0; j < M; j++) {
        const d = j / (M - 1) - fx;
        l.u[j] += dy * near * .5 * Math.exp(-d * d * 220);
      }
    }
  },
  step(dt, t, cfg) {
    if (lines.length !== cfg.lines) this.reset(cfg);
    const pace = audio.pace;
    if (audio.onBeat) {
      const sig = 160 + pace * 640, amp = S.H * .05 * audio.beatAmp * (.5 + pace * 1.2);
      for (const l of lines) if (rnd() < .6) {
        const fx = rnd();
        for (let j = 0; j < M; j++) { const d = j / (M - 1) - fx; l.u[j] += amp * Math.exp(-d * d * sig); }
      }
    }
    acc = Math.min(acc + dt, .1);
    const h = 1 / 240, c2 = 6400, damp = 1.6 + pace * 1.6;
    while (acc >= h) {
      acc -= h;
      for (const l of lines) {
        const u = l.u, v = l.v;
        for (let j = 1; j < M - 1; j++) v[j] += (c2 * (u[j - 1] + u[j + 1] - 2 * u[j]) - damp * v[j]) * h;
        for (let j = 1; j < M - 1; j++) u[j] += v[j] * h;
        u[0] = u[M - 1] = 0;
      }
    }
  },
  draw(p, t, cfg) {
    const [y0, y1] = zone(), n = lines.length, pace = audio.pace;
    const bands = [audio.bass, audio.mid, audio.treb];
    const ampK = cfg.amp / 100 * S.zoom;
    for (const [li, l] of lines.entries()) {
      const yc = y0 + (y1 - y0) * (li + .5) / n;
      const e = bands[l.band];
      const A = (6 + e * S.H * .05) * (1 + audio.beatGlow * .5) * ampK;
      const spd = (0.8 + pace * 2.2) * S.flow;
      for (let j = 0; j < M; j++) {
        const fx = j / (M - 1);
        pts[j * 2] = fx * S.W;
        pts[j * 2 + 1] = yc + Math.sin(fx * Math.PI * l.k - t * spd * (1 + l.k * .3) + l.ph) * A + l.u[j];
      }
      const [cr, cg, cb] = rgbAt(l.f, t);
      p.poly(pts, M, 1.2 + e * 1.8 + audio.shimmer * .5, cr, cg, cb, .85);
    }
  },
};
