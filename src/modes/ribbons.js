import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, zone } from './common.js';

/* flowing aurora-silk ribbons: layered sinusoids driven by mel bands,
   with a spring displacement field for taps and drags */
const M = 90;
let ribbons = [];
const pts = new Float32Array(M * 2);

export default {
  name: 'Ribbons', hint: 'tap to ripple the silk · drag to bend it',
  bloom: .65,
  params: {
    ribbons: { label: 'Ribbons',   min: 2,  max: 7,   step: 1, val: 4, reset: true },
    width:   { label: 'Width',     min: 40, max: 220, step: 5, val: 100 },
    wave:    { label: 'Undulation',min: 40, max: 220, step: 5, val: 100 },
    trail:   { label: 'Trails',    min: 0,  max: 85,  step: 2, val: 35 },
  },
  reset(cfg) {
    ribbons = [];
    for (let i = 0; i < cfg.ribbons; i++)
      ribbons.push({ f: cfg.ribbons === 1 ? .5 : i / (cfg.ribbons - 1),
                     u: new Float32Array(M), v: new Float32Array(M),
                     ph: rnd() * 7, k1: 1.5 + rnd(), k2: 3 + rnd() * 2, band: i % 3 });
  },
  tap(x, y) {
    const fx = x / S.W, [y0, y1] = zone(), n = ribbons.length;
    for (const [ri, r] of ribbons.entries()) {
      const ry = y0 + (y1 - y0) * (ri + .5) / n;
      const near = Math.exp(-Math.pow((y - ry) / (S.H * .16), 2));
      for (let j = 0; j < M; j++) {
        const d = j / (M - 1) - fx;
        r.u[j] += S.H * .08 * (.3 + .7 * near) * Math.exp(-d * d * 120);
      }
    }
  },
  drag(x, y, dx, dy) {
    const fx = x / S.W, [y0, y1] = zone(), n = ribbons.length;
    for (const [ri, r] of ribbons.entries()) {
      const ry = y0 + (y1 - y0) * (ri + .5) / n;
      const near = Math.exp(-Math.pow((y - ry) / (S.H * .12), 2));
      if (near < .02) continue;
      for (let j = 0; j < M; j++) {
        const d = j / (M - 1) - fx;
        r.u[j] += dy * near * .6 * Math.exp(-d * d * 90);
      }
    }
  },
  step(dt, t, cfg) {
    if (ribbons.length !== cfg.ribbons) this.reset(cfg);
    // soft spring back to rest + neighbor coupling = silky settling.
    // fixed substeps keep the integrator inside its stability limit.
    this._acc = Math.min((this._acc || 0) + dt, .1);
    const h = 1 / 240, uMax = S.H * .3;
    while (this._acc >= h) {
      this._acc -= h;
      for (const r of ribbons) {
        const u = r.u, v = r.v;
        for (let j = 1; j < M - 1; j++) {
          const lap = u[j - 1] + u[j + 1] - 2 * u[j];
          v[j] += (lap * 900 - u[j] * 14 - v[j] * 2.4) * h;
        }
        for (let j = 1; j < M - 1; j++) {
          u[j] += v[j] * h;
          if (u[j] > uMax) u[j] = uMax; else if (u[j] < -uMax) u[j] = -uMax;
        }
      }
    }
    if (audio.onBeat) {
      // the whole silk billows on the beat
      for (const r of ribbons) {
        const fx = rnd();
        for (let j = 0; j < M; j++) {
          const d = j / (M - 1) - fx;
          r.u[j] += S.H * .04 * audio.beatAmp * Math.exp(-d * d * 30);
        }
      }
    }
  },
  draw(p, t, cfg) {
    const [y0, y1] = zone(), n = ribbons.length, pace = audio.pace;
    const bands = [audio.bass, audio.mid, audio.treb];
    const waveK = cfg.wave / 100 * S.zoom, widthK = cfg.width / 100;
    for (const [ri, r] of ribbons.entries()) {
      const yc = y0 + (y1 - y0) * (ri + .5) / n;
      const e = bands[r.band];
      const A = (S.H * .028 + e * S.H * .06) * waveK;
      const spd = (.5 + pace * 1.6) * S.flow;
      const [cr, cg, cb] = rgbAt(r.f, t);
      // three stacked passes make the silk body
      for (let layer = 0; layer < 3; layer++) {
        const off = (layer - 1) * (5 + e * 10) * widthK;
        for (let j = 0; j < M; j++) {
          const fx = j / (M - 1);
          const env = Math.sin(fx * Math.PI);   // pinch the ends
          const yv = Math.sin(fx * Math.PI * r.k1 - t * spd + r.ph) * A
                   + Math.sin(fx * Math.PI * r.k2 + t * spd * .7 + r.ph * 2) * A * .5;
          pts[j * 2] = fx * S.W;
          pts[j * 2 + 1] = yc + (yv + off) * env + r.u[j];
        }
        const w = (layer === 1 ? 2.2 : 1.1) * widthK + e * 1.5;
        p.poly(pts, M, w, cr, cg, cb, layer === 1 ? .5 : .22);
      }
    }
  },
};
