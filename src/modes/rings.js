import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, focal } from './common.js';

const SEG = 96;
let rings = [], spikes = [], rot = 0;
const pts = new Float32Array((SEG + 1) * 2);
const baseR = (i, cfg) => Math.min(S.W, S.H) * (.10 + .075 * i) * S.zoom * (cfg ? cfg.spread / 100 : 1);

export default {
  name: 'Rings', hint: 'tap to spike · pinch to resize · drag to spin',
  bloom: .55,
  params: {
    rings:  { label: 'Rings',    min: 3,  max: 8,   step: 1, val: 5, reset: true },
    spread: { label: 'Spread',   min: 60, max: 160, step: 5, val: 100 },
    spike:  { label: 'Spikes',   min: 40, max: 220, step: 5, val: 100 },
    trail:  { label: 'Trails',   min: 0,  max: 80,  step: 2, val: 12 },
  },
  reset(cfg) {
    rings = []; spikes = [];
    const n = cfg.rings;
    for (let i = 0; i < n; i++) rings.push({ f: n === 1 ? .5 : i / (n - 1), band: i % 3, pulse: 0 });
  },
  tap(x, y, cfg) {
    const [cx, cy] = focal();
    const d = Math.hypot(x - cx, y - cy), ang = Math.atan2(y - cy, x - cx);
    let best = 0, bd = 1e9;
    rings.forEach((r, i) => { const e = Math.abs(d - baseR(i, cfg)); if (e < bd) { bd = e; best = i; } });
    spikes.push({ ring: best, ang, amp: Math.min(S.W, S.H) * .09 * cfg.spike / 100, w: .5, life: 1 });
    rings[best].pulse = 1;
  },
  drag(x, y, dx) { rot += dx * .004; },
  step(dt, t, cfg) {
    if (rings.length !== cfg.rings) this.reset(cfg);
    const pace = audio.pace;
    rot += dt * S.flow * (.15 + audio.level * .8);
    const spikeK = cfg.spike / 100;
    if (audio.onBeat) {
      const k = 1 + Math.round(pace * 4);
      for (let i = 0; i < k; i++)
        spikes.push({ ring: Math.floor(rnd() * rings.length), ang: rnd() * Math.PI * 2,
                      amp: Math.min(S.W, S.H) * (.03 + .06 * audio.beatAmp * (0.4 + pace)) * spikeK,
                      w: .6 - pace * .35, life: 1 });
    }
    if (audio.onShimmer)
      spikes.push({ ring: Math.floor(rnd() * rings.length), ang: rnd() * Math.PI * 2,
                    amp: Math.min(S.W, S.H) * .02 * spikeK, w: .18, life: .7 });
    for (let i = spikes.length - 1; i >= 0; i--) {
      const s = spikes[i]; s.life -= dt * (1 + pace * 1.6);
      if (s.life <= 0) spikes.splice(i, 1);
    }
    for (const r of rings) r.pulse *= .93;
  },
  draw(p, t, cfg) {
    const [cx, cy] = focal();
    const bands = [audio.bass, audio.mid, audio.treb];
    for (const [i, r] of rings.entries()) {
      const e = bands[r.band];
      // anticipation: rings tighten slightly as the next beat approaches
      const antic = 1 - .02 * Math.pow(audio.phase01, 3);
      const R = baseR(i, cfg) * (1 + e * .22 + r.pulse * .12) * antic;
      for (let s = 0; s <= SEG; s++) {
        const a = s / SEG * Math.PI * 2 + rot;
        let rr = R;
        for (const sp of spikes) {
          if (sp.ring !== i) continue;
          let d = a - sp.ang;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          rr += sp.amp * sp.life * Math.exp(-(d * d) / (sp.w * sp.w));
        }
        pts[s * 2] = cx + Math.cos(a) * rr;
        pts[s * 2 + 1] = cy + Math.sin(a) * rr;
      }
      const [cr, cg, cb] = rgbAt(r.f, t);
      p.poly(pts, SEG + 1, 1.2 + e * 2 + audio.shimmer * .5, cr, cg, cb, .85);
    }
  },
};
