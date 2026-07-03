import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, zone } from './common.js';

/* paper lanterns drifting up through the mist, flickering with the
   high end and surging upward on the beat */
const L = [];
function make(fresh) {
  const [y0, y1] = zone();
  return { x: rnd() * S.W,
           y: fresh ? y1 + 30 + rnd() * 60 : y0 + rnd() * (y1 - y0),
           vx: 0, vy: 0, f: rnd(), sz: 5 + rnd() * 6,
           sway: rnd() * 7, flick: .5 + rnd() * .5 };
}

export default {
  name: 'Lanterns', hint: 'tap to release a lantern · drag for a breeze',
  bloom: .75,
  params: {
    count:   { label: 'Lanterns', min: 4,  max: 40,  step: 1, val: 14, reset: true },
    rise:    { label: 'Rise',     min: 40, max: 220, step: 5, val: 100 },
    flicker: { label: 'Flicker',  min: 0,  max: 220, step: 5, val: 100 },
    trail:   { label: 'Trails',   min: 0,  max: 80,  step: 2, val: 20 },
  },
  reset(cfg) {
    L.length = 0;
    for (let i = 0, n = cfg.count; i < n; i++) L.push(make(false));
  },
  tap(x, y) {
    const l = make(true); l.x = x; l.y = y; l.vy = -30;
    L.push(l);
    if (L.length > 60) L.shift();
  },
  drag(x, y, dx, dy) {
    for (const l of L) {
      const d = Math.hypot(l.x - x, l.y - y);
      if (d < 180) { const k = (1 - d / 180) * .22 * 60; l.vx += dx * k; l.vy += dy * k * .5; }
    }
  },
  step(dt, t, cfg) {
    const [y0] = zone(), pace = audio.pace;
    const n = cfg.count;
    while (L.length < n) L.push(make(true));
    const riseK = cfg.rise / 100;
    if (audio.onBeat)
      for (const l of L) { l.vy -= audio.beatAmp * (18 + pace * 30) * riseK; }
    for (let i = L.length - 1; i >= 0; i--) {
      const l = L[i];
      const rise = -(9 + pace * 10) * riseK;
      l.vx += (S.flow * 6 + Math.sin(t * .7 + l.sway) * 8 - l.vx) * .8 * dt;
      l.vy += (rise - l.vy) * .5 * dt;
      l.x += l.vx * dt; l.y += l.vy * dt;
      if (l.y < y0 - 60) { L.splice(i, 1); if (L.length < n) L.push(make(true)); }
      if (l.x < -30) l.x = S.W + 30; if (l.x > S.W + 30) l.x = -30;
    }
  },
  draw(p, t, cfg) {
    const flickK = cfg.flicker / 100;
    for (const l of L) {
      const flick = 1 - flickK * .4 * (0.5 + 0.5 * Math.sin(t * (7 + l.flick * 5) + l.sway * 9)) * (0.3 + audio.treb);
      const glow = Math.min(1, (.5 + audio.beatGlow * .4) * flick + audio.shimmer * .15);
      const s = l.sz * S.zoom;
      const [cr, cg, cb] = rgbAt(l.f, t);
      // halo, paper body, hot core
      p.dot(l.x, l.y, s * 2.2, cr, cg, cb, .12 * glow, 1);
      p.disc(l.x, l.y, s * .62, s * .85, 0, cr, cg, cb, .55 * glow, .4);
      p.dot(l.x, l.y + s * .1, s * .28, 1, .92, .75, .9 * glow, .7);
    }
  },
};
