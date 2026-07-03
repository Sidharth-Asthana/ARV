import { S } from '../state.js';
import { audio } from '../audio/engine.js';
import { rgbAt } from '../color/palettes.js';
import { rnd, zone } from './common.js';

/* living growth: tendril tips advance through a curl field, leaving
   glowing stems; beats make them branch, taps plant new sprouts */
const HIST = 60;
let tips = [];
let steer = null;   // {x,y} while dragging

function sprout(x, y, ang, gen) {
  return { x, y, ang, gen, speed: 60 + rnd() * 40, life: 1,
           f: rnd(), hist: [x, y], ph: rnd() * 7 };
}
function plantBase(cfg) {
  const [y0, y1] = zone();
  const x = rnd() * S.W, y = y1 - rnd() * (y1 - y0) * .2;
  return sprout(x, y, -Math.PI / 2 + (rnd() - .5) * .8, 0);
}

export default {
  name: 'Tendrils', hint: 'tap to plant a sprout · drag to guide growth',
  bloom: .7,
  params: {
    sprouts: { label: 'Sprouts', min: 3,  max: 16,  step: 1, val: 7, reset: true },
    growth:  { label: 'Growth',  min: 40, max: 220, step: 5, val: 100 },
    curl:    { label: 'Curl',    min: 40, max: 220, step: 5, val: 100 },
    trail:   { label: 'Trails',  min: 0,  max: 90,  step: 2, val: 60 },
  },
  reset(cfg) {
    tips = [];
    for (let i = 0; i < cfg.sprouts; i++) tips.push(plantBase(cfg));
    steer = null;
  },
  tap(x, y) {
    tips.push(sprout(x, y, -Math.PI / 2 + (rnd() - .5) * 1.6, 0));
    if (tips.length > 40) tips.shift();
  },
  drag(x, y) { steer = { x, y, until: performance.now() + 150 }; },
  step(dt, t, cfg) {
    const pace = audio.pace, curlK = cfg.curl / 100;
    const speedK = cfg.growth / 100 * (0.6 + audio.level * 1.2 + pace * .5);
    if (steer && performance.now() > steer.until) steer = null;
    if (audio.onBeat) {
      // branch: strong beats fork the healthiest tendrils
      const k = 1 + Math.round(audio.beatAmp * (1 + pace * 2));
      for (let i = 0; i < k && tips.length < 40; i++) {
        const src = tips[Math.floor(rnd() * tips.length)];
        if (src && src.life > .3)
          tips.push(sprout(src.x, src.y, src.ang + (rnd() > .5 ? .9 : -.9) + (rnd() - .5) * .4, src.gen + 1));
      }
    }
    const [y0] = zone();
    for (let i = tips.length - 1; i >= 0; i--) {
      const tp = tips[i];
      // curl-noise steering + upward habit + flow lean
      const n1 = Math.sin(tp.x * .008 + t * .6 + tp.ph) * Math.cos(tp.y * .008 - t * .4);
      let turn = n1 * 1.3 * curlK * dt * 10;
      turn += (Math.sin(-Math.PI / 2 - tp.ang)) * 1.1 * dt * 10 * .12; // prefer upward
      turn += S.flow * .25 * dt;
      if (steer) {
        const da = Math.atan2(steer.y - tp.y, steer.x - tp.x) - tp.ang;
        turn += Math.atan2(Math.sin(da), Math.cos(da)) * 2.2 * dt;
      }
      if (audio.onShimmer) turn += (rnd() - .5) * .5;                // percussive wiggle
      tp.ang += turn;
      const sp = tp.speed * speedK * dt;
      tp.x += Math.cos(tp.ang) * sp;
      tp.y += Math.sin(tp.ang) * sp;
      tp.hist.push(tp.x, tp.y);
      if (tp.hist.length > HIST * 2) tp.hist.splice(0, 2);
      tp.life -= dt * (.06 + tp.gen * .02);
      if (tp.life <= 0 || tp.y < y0 - 40 || tp.x < -60 || tp.x > S.W + 60) {
        tips.splice(i, 1);
        if (tips.length < cfg.sprouts) tips.push(plantBase(cfg));
      }
    }
    while (tips.length < cfg.sprouts) tips.push(plantBase(cfg));
  },
  draw(p, t) {
    for (const tp of tips) {
      const n = tp.hist.length / 2;
      const [cr, cg, cb] = rgbAt(tp.f, t);
      // stem: taper width and alpha toward the tail
      for (let i = 0; i < n - 1; i++) {
        const fr = i / (n - 1);
        p.seg(tp.hist[i * 2], tp.hist[i * 2 + 1], tp.hist[i * 2 + 2], tp.hist[i * 2 + 3],
              (.4 + fr * 1.6) * S.zoom, cr, cg, cb, (0.12 + fr * .6) * tp.life);
      }
      // glowing growing tip
      p.dot(tp.x, tp.y, (1.6 + audio.bass * 2) * S.zoom, cr, cg, cb, tp.life, 1);
    }
  },
};
