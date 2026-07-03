import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, focal } from './common.js';

/* the WebGL flagship: a differential-rotation spiral of thousands of
   stars breathing with the bass; beats flash the core and kick the
   rotation, taps send a gravitational pulse through the arms */
let stars = null, N = 0;
let rotOff = 0, kick = 0;
const pulses = [];

function build(count) {
  N = count;
  stars = { r: new Float32Array(N), a0: new Float32Array(N),
            f: new Float32Array(N), sz: new Float32Array(N),
            arm: new Float32Array(N), zj: new Float32Array(N) };
  const ARMS = 3;
  for (let i = 0; i < N; i++) {
    // density falls off with radius; arms carry most of the stars
    const r = Math.pow(rnd(), .6);
    const arm = Math.floor(rnd() * ARMS);
    const spread = .16 + r * .22;
    stars.r[i] = r;
    stars.arm[i] = arm / ARMS * Math.PI * 2 + (rnd() - .5) * spread * Math.PI;
    stars.a0[i] = rnd() * .3;
    stars.f[i] = Math.min(1, r + (rnd() - .5) * .3);
    stars.sz[i] = .5 + Math.pow(rnd(), 3) * 1.8;
    stars.zj[i] = (rnd() - .5) * .22 * (1 - r * .5);
  }
}

export default {
  name: 'Galaxy', hint: 'tap for a gravity pulse · drag to spin the disk',
  bloom: .85,
  params: {
    stars: { label: 'Stars', min: 2000, max: 30000, step: 1000, val: 10000, reset: true },
    twist: { label: 'Twist', min: 0,    max: 220,   step: 5,    val: 100 },
    speed: { label: 'Spin',  min: 40,   max: 220,   step: 5,    val: 100 },
    trail: { label: 'Trails',min: 0,    max: 94,    step: 2,    val: 80 },
  },
  reset(cfg) { build(Math.round(cfg.stars * S.q)); pulses.length = 0; rotOff = 0; kick = 0; },
  tap(x, y) {
    const [cx, cy] = focal();
    const R = Math.min(S.W, S.H) * .42 * S.zoom;
    pulses.push({ r: Math.hypot(x - cx, (y - cy) / .62) / R, life: 1 });
  },
  drag(x, y, dx) { rotOff += dx * .003; },
  step(dt, t, cfg) {
    const want = Math.round(cfg.stars * S.q);
    if (!stars || Math.abs(want - N) > 1500) build(want);
    if (audio.onBeat) kick = Math.min(1, kick + audio.beatAmp * .8);
    kick *= Math.pow(.2, dt);
    rotOff += dt * S.flow * (cfg.speed / 100) * (.12 + audio.level * .25 + kick * .4);
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.r += dt * 1.2; p.life -= dt * .9;
      if (p.life <= 0) pulses.splice(i, 1);
    }
  },
  draw(p, t, cfg) {
    if (!stars) return;
    const [cx, cy] = focal();
    const R = Math.min(S.W, S.H) * .42 * S.zoom;
    const twist = cfg.twist / 100 * 2.4;
    const breathe = 1 + audio.bass * .13;
    const phase = 1 - .015 * Math.pow(audio.phase01, 3);   // inhale before the beat
    for (let i = 0; i < N; i++) {
      const r0 = stars.r[i];
      // differential rotation: inner stars orbit faster
      const ang = stars.arm[i] + stars.a0[i] + rotOff / (0.25 + r0 * .9) + r0 * twist;
      let rr = r0 * breathe * phase;
      for (const pu of pulses) {
        const d = rr - pu.r;
        rr += .06 * pu.life * Math.exp(-d * d * 60);
      }
      const x = cx + Math.cos(ang) * rr * R;
      const y = cy + Math.sin(ang) * rr * R * .62 + stars.zj[i] * R;
      const [cr, cg, cb] = rgbAt(stars.f[i], t);
      const tw = .5 + .5 * Math.sin(t * 2 + i);
      p.dot(x, y, stars.sz[i] * S.zoom * (1 + audio.treb * .4),
            cr, cg, cb, .28 + .3 * tw, .35);
    }
    // hot core, flashing with the beat
    const [cr, cg, cb] = rgbAt(.05, t);
    p.dot(cx, cy, R * .05 * (1 + audio.beatGlow * .8), 1, .96, .9, .5 + audio.beatGlow * .5, 1);
    p.dot(cx, cy, R * .12, cr, cg, cb, .18 + audio.bass * .2, 1);
  },
};
