import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, zone } from './common.js';

/* rain on still water: every beat lands as an expanding ring; minor
   onsets patter as small rings; taps splash */
let rips = [], dragAcc = 0;

function splash(x, y, size, strong) {
  rips.push({ x, y, r: 2, vr: (60 + rnd() * 40) * size * (strong ? 1.6 : 1),
              life: 1, decay: .55 / size, f: rnd(), w: strong ? 2 : 1.1 });
}

export default {
  name: 'Ripples', hint: 'tap to splash · drag to trail rain',
  bloom: .5,
  params: {
    rate: { label: 'Rain',   min: 40, max: 220, step: 5, val: 100 },
    size: { label: 'Size',   min: 40, max: 220, step: 5, val: 100 },
    life: { label: 'Life',   min: 40, max: 220, step: 5, val: 100 },
    trail:{ label: 'Trails', min: 0,  max: 80,  step: 2, val: 25 },
  },
  reset() { rips = []; },
  tap(x, y, cfg) { splash(x, y, cfg.size / 100 * 1.6 * S.zoom, true); },
  drag(x, y, dx, dy, cfg) {
    dragAcc += Math.hypot(dx, dy);
    if (dragAcc > 30) { dragAcc = 0; splash(x, y, cfg.size / 100 * .7, false); }
  },
  step(dt, t, cfg) {
    const [y0, y1] = zone(), pace = audio.pace;
    const sizeK = cfg.size / 100 * S.zoom, rateK = cfg.rate / 100;
    if (audio.onBeat) {
      const k = 1 + Math.round(audio.beatAmp * (1 + pace * 2) * rateK);
      for (let i = 0; i < k; i++)
        splash(rnd() * S.W, y0 + rnd() * (y1 - y0), sizeK * (0.9 + audio.beatAmp * .8), true);
    }
    if (audio.onShimmer)
      splash(rnd() * S.W, y0 + rnd() * (y1 - y0), sizeK * .5, false);
    // ambient patter follows loudness
    if (rnd() < dt * (1 + audio.level * 6) * rateK)
      splash(rnd() * S.W, y0 + rnd() * (y1 - y0), sizeK * (.3 + rnd() * .3), false);
    const lifeK = cfg.life / 100;
    for (let i = rips.length - 1; i >= 0; i--) {
      const r = rips[i];
      r.r += r.vr * dt * (1 + audio.bass * .6);
      r.vr *= .995;
      r.life -= dt * r.decay / lifeK;
      if (r.life <= 0) rips.splice(i, 1);
    }
    if (rips.length > 260) rips.splice(0, rips.length - 260);
  },
  draw(p, t) {
    for (const r of rips) {
      const [cr, cg, cb] = rgbAt(r.f, t);
      const a = r.life * r.life * .8;
      p.ring(r.x, r.y, r.r, r.w, cr, cg, cb, a, 48);
      // faint inner echo ring
      if (r.r > 24) p.ring(r.x, r.y, r.r * .62, r.w * .6, cr, cg, cb, a * .4, 36);
    }
  },
};
