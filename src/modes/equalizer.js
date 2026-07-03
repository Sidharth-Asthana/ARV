import { S } from '../state.js';
import { audio, N_MEL } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { zone } from './common.js';

/* rounded spectrum towers rising out of the scene, straight off the
   mel filterbank; peak caps hold and fall */
let vals = [], peaks = [], boost = [];

export default {
  name: 'Equalizer', hint: 'tap or drag to excite the bars',
  bloom: .55,
  params: {
    bars:   { label: 'Bars',   min: 12, max: 48,  step: 2, val: 24, reset: true },
    rise:   { label: 'Rise',   min: 40, max: 220, step: 5, val: 100 },
    peaks:  { label: 'Peaks',  min: 0,  max: 100, step: 5, val: 60 },
    trail:  { label: 'Trails', min: 0,  max: 80,  step: 2, val: 15 },
  },
  reset(cfg) {
    vals = new Array(cfg.bars).fill(0);
    peaks = new Array(cfg.bars).fill(0);
    boost = new Array(cfg.bars).fill(0);
  },
  tap(x) {
    const n = vals.length, bi = Math.floor(x / S.W * n);
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - bi);
      boost[i] = Math.max(boost[i], Math.exp(-d * d / 6));
    }
  },
  drag(x) { this.tap(x); },
  step(dt, t, cfg) {
    if (vals.length !== cfg.bars) this.reset(cfg);
    const n = cfg.bars;
    for (let i = 0; i < n; i++) {
      // resample the mel spectrum onto the bar count (flow reverses order)
      const mi = (S.flow > 0 ? i : n - 1 - i) / (n - 1) * (N_MEL - 1);
      const lo = Math.floor(mi), fr = mi - lo;
      const e = audio.mel[lo] * (1 - fr) + audio.mel[Math.min(N_MEL - 1, lo + 1)] * fr;
      const target = Math.min(1.3, e * (1 + audio.beatGlow * .3) + boost[i] * .8);
      const rise = target > vals[i] ? .5 : .12 + audio.pace * .2;
      vals[i] += (target - vals[i]) * rise;
      boost[i] *= .9;
      if (vals[i] > peaks[i]) peaks[i] = vals[i];
      else peaks[i] -= dt * (.25 + audio.pace * .4);
      if (peaks[i] < 0) peaks[i] = 0;
    }
  },
  draw(p, t, cfg) {
    const n = vals.length, [y0, y1] = zone();
    const base = y1, maxH = (y1 - y0) * cfg.rise / 100 * S.zoom;
    const slot = S.W / n, bw = Math.max(2, slot * .32);
    const peakA = cfg.peaks / 100;
    for (let i = 0; i < n; i++) {
      const x = slot * (i + .5);
      const h = Math.max(3, vals[i] * maxH);
      const [cr, cg, cb] = rgbAt(i / n, t);
      p.seg(x, base, x, base - h, bw, cr, cg, cb, .8);
      if (peakA > 0 && peaks[i] > .02)
        p.dot(x, base - peaks[i] * maxH - bw, bw * .55, cr, cg, cb, peakA, .8);
    }
  },
};
