import { lcg, ridge, twinkle, vGrad, glowSpot, shootingStar, auroraRibbons } from './helpers.js';

/* Each scenery paints a static scene, draws a faint living ambient layer
   every frame, and declares: the vertical zone the visualization lives
   in (z0..z1), a focal point (fx,fy), a default palette, and its
   default visualization mode. */
export const SCENERIES = [
  { name: 'Night Peaks', light: false, z0: .10, z1: .58, fx: .5, fy: .34,
    defPal: 'Aurora', defMode: 'Particles',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#0a0f22'], [.6, '#070a16'], [1, '#04050b']]);
      ridge(c, w, h, .80, .10, '#0a0c17', 21);
      ridge(c, w, h, .88, .07, '#060712', 22);
    },
    ambient(c, t, w, h) {
      twinkle(c, t, w, h, .55, Math.round(w * h / 9000), 7, 1);
      shootingStar(c, t, w, h, 9, 101);
    } },

  { name: 'Moonlit Sea', light: false, z0: .42, z1: .78, fx: .72, fy: .26,
    defPal: 'Ocean', defMode: 'Waves',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#08111f'], [.6, '#0a1524'], [.62, '#061019'], [1, '#03080e']]);
      glowSpot(c, w * .72, h * .26, h * .16, 'rgba(220,230,250,.55)');
      c.fillStyle = '#e8edf8'; c.beginPath(); c.arc(w * .72, h * .26, h * .035, 0, 7); c.fill();
    },
    ambient(c, t, w, h) {
      twinkle(c, t, w, h, .5, Math.round(w * h / 14000), 11, .8);
      const cx = ((t * 5) % (w * 1.5)) - w * .25;
      glowSpot(c, cx, h * .21, h * .09, 'rgba(200,212,238,.05)');
      glowSpot(c, cx + w * .08, h * .24, h * .07, 'rgba(200,212,238,.04)');
      for (let i = 0; i < 7; i++) {
        const y = h * (.64 + i * .045), sh = .5 + .5 * Math.sin(t * (1 + i * .31) + i * 2.6);
        c.fillStyle = `rgba(210,225,250,${.14 * sh * (1 - i / 8)})`;
        const gw = w * (.05 + .02 * Math.sin(t * .7 + i));
        c.beginPath();
        (c.roundRect ? c.roundRect(w * .72 - gw / 2, y, gw, 2, 1) : c.rect(w * .72 - gw / 2, y, gw, 2));
        c.fill();
      }
    } },

  { name: 'Desert Dusk', light: false, z0: .24, z1: .62, fx: .5, fy: .52,
    defPal: 'Ember', defMode: 'Rings',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#241026'], [.55, '#43181f'], [.75, '#1c0a0c'], [1, '#0d0507']]);
      glowSpot(c, w * .5, h * .66, h * .3, 'rgba(255,140,60,.30)');
      ridge(c, w, h, .78, .05, '#170a0d', 31, 32);
      ridge(c, w, h, .87, .05, '#0c0508', 32, 32);
    },
    ambient(c, t, w, h) {
      glowSpot(c, w * .5, h * .66, h * (.26 + .04 * Math.sin(t * .6)),
               `rgba(255,140,60,${.10 + .05 * Math.sin(t * .6)})`);
      twinkle(c, t * .6, w, h, .7, 10, 33, .35, '255,190,130');
    } },

  { name: 'Aurora Pines', light: false, z0: .08, z1: .52, fx: .5, fy: .30,
    defPal: 'Aurora', defMode: 'Ribbons',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#041018'], [.6, '#06131f'], [1, '#030910']]);
      ridge(c, w, h, .90, .055, '#040a0c', 43, 90);
    },
    ambient(c, t, w, h) {
      twinkle(c, t, w, h, .6, Math.round(w * h / 11000), 41, .9);
      auroraRibbons(c, t, w, h);
    } },

  { name: 'City Nights', light: false, z0: .12, z1: .58, fx: .5, fy: .38,
    defPal: 'Candy', defMode: 'Equalizer',
    draw(c, w, h, store) {
      vGrad(c, w, h, [[0, '#0b0d1e'], [.65, '#141031'], [1, '#080617']]);
      glowSpot(c, w * .5, h * .78, h * .34, 'rgba(120,90,255,.14)');
      const R = lcg(53); let x = -10; const flick = [];
      while (x < w + 10) {
        const bw = w * (.05 + R() * .08), bh = h * (.08 + R() * .16), y = h * .86 - bh;
        c.fillStyle = '#070812';
        c.beginPath();
        (c.roundRect ? c.roundRect(x, y, bw, bh + h * .2, [bw * .18, bw * .18, 0, 0]) : c.rect(x, y, bw, bh + h * .2));
        c.fill();
        for (let i = 0, nw = Math.floor(bh * bw / 240); i < nw; i++) {
          const wx = x + bw * .15 + R() * bw * .7, wy = y + bh * .1 + R() * bh * .8;
          c.fillStyle = `rgba(255,214,140,${.25 + R() * .5})`;
          c.fillRect(wx, wy, 1.3, 1.8);
          if (i % 4 === 0) flick.push([wx, wy]);
        }
        x += bw + w * .012;
      }
      if (store) this._flick = flick;
    },
    ambient(c, t, w, h) {
      twinkle(c, t, w, h, .35, Math.round(w * h / 16000), 51, .7);
      if (!this._flick) return;
      for (const [i, [x, y]] of this._flick.entries()) {
        c.fillStyle = `rgba(255,214,140,${.2 + .55 * (.5 + .5 * Math.sin(t * (1.2 + i % 3) + i * 2.7))})`;
        c.fillRect(x, y, 1.3, 1.8);
      }
    } },

  { name: 'Forest Glade', light: false, z0: .12, z1: .62, fx: .5, fy: .40,
    defPal: 'Aurora', defMode: 'Tendrils',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#06130c'], [.7, '#04100a'], [1, '#020806']]);
      const R = lcg(71);
      for (let i = 0; i < 6; i++) {
        const tx = w * (.04 + i * .17 + R() * .06), tw = w * (.018 + R() * .02), th = h * (.5 + R() * .25);
        c.fillStyle = i % 2 ? '#031008' : '#040d09';
        c.beginPath();
        (c.roundRect ? c.roundRect(tx, h - th, tw, th + 4, tw * .5) : c.rect(tx, h - th, tw, th + 4));
        c.fill();
      }
      ridge(c, w, h, .86, .05, '#03100a', 72, 60);
      ridge(c, w, h, .93, .04, '#020a06', 73, 60);
    },
    ambient(c, t, w, h) {
      for (let i = 0; i < 2; i++) {
        const x = ((t * (4 + i * 2.5) + i * w * .7) % (w + w * .6)) - w * .3;
        glowSpot(c, x, h * (.7 + i * .1), h * .13, 'rgba(170,215,190,.045)');
      }
      twinkle(c, t, w, h, .35, 12, 74, .5);
      twinkle(c, t * .8, w, h, .95, 8, 75, .4, '150,240,180');
    } },

  { name: 'Sakura Dusk', light: false, z0: .16, z1: .60, fx: .32, fy: .54,
    defPal: 'Candy', defMode: 'Petals',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#2a1430'], [.55, '#3d1d3b'], [.8, '#241224'], [1, '#150a16']]);
      glowSpot(c, w * .32, h * .7, h * .26, 'rgba(255,150,170,.22)');
      ridge(c, w, h, .84, .05, '#1a0d1c', 81, 40);
      const R = lcg(83);
      c.strokeStyle = '#160a16'; c.lineCap = 'round';
      for (let b = 0; b < 3; b++) {
        c.lineWidth = (3 - b) * 2.2;
        c.beginPath(); c.moveTo(w * 1.02, h * (.02 + b * .05));
        c.quadraticCurveTo(w * (.8 - b * .06), h * (.08 + b * .06), w * (.62 - b * .1), h * (.16 + b * .05));
        c.stroke();
        for (let i = 0; i < 9; i++) {
          const fr = i / 9, bx = w * (1.0 - fr * (.38 + b * .1)),
                by = h * (.03 + b * .05 + fr * (.12 + b * .02)) + R() * 8 - 4;
          c.fillStyle = `rgba(255,${168 + R() * 40 | 0},${195 + R() * 30 | 0},${.35 + R() * .35})`;
          c.beginPath(); c.arc(bx, by, 1.6 + R() * 2.4, 0, 7); c.fill();
        }
      }
    },
    ambient(c, t, w, h) {
      glowSpot(c, w * .32, h * .7, h * (.22 + .03 * Math.sin(t * .5)), 'rgba(255,150,170,.10)');
      const R = lcg(85);
      for (let i = 0; i < 6; i++) {
        const sp = 10 + R() * 12, ph = R() * h, x = (w * (.6 + R() * .4) + Math.sin(t * .8 + i * 2) * w * .04);
        const y = ((t * sp + ph) % (h * 1.1)) - h * .05;
        c.fillStyle = `rgba(255,180,205,${.28 * (1 - y / h) + .06})`;
        c.beginPath(); c.ellipse(x, y, 2.6, 1.5, t + i, 0, 7); c.fill();
      }
    } },

  { name: 'Rainfall', light: false, z0: .12, z1: .60, fx: .5, fy: .35,
    defPal: 'Ocean', defMode: 'Ripples',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#0d1420'], [.6, '#111a29'], [1, '#080d15']]);
      glowSpot(c, w * .5, h * .2, h * .3, 'rgba(150,175,215,.07)');
      ridge(c, w, h, .80, .06, '#0a111c', 91);
      ridge(c, w, h, .89, .05, '#060b12', 92);
    },
    ambient(c, t, w, h) {
      const R = lcg(95);
      c.lineCap = 'round'; c.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const sp = 280 + R() * 220, x0 = R() * w * 1.1 - w * .05, ph = R() * h, ln = 7 + R() * 7;
        const y = ((t * sp + ph) % (h + 40)) - 20;
        c.strokeStyle = `rgba(170,192,222,${.06 + R() * .07})`;
        c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 - ln * .25, y + ln); c.stroke();
      }
      const lp = (t % 17) / 17;
      if (lp < .025) glowSpot(c, w * .7, h * .15, h * .4, `rgba(205,218,255,${.06 * Math.sin(lp / .025 * Math.PI)})`);
    } },

  { name: 'Morning Mist', light: true, z0: .20, z1: .62, fx: .68, fy: .30,
    defPal: 'Ember', defMode: 'Lanterns',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#eef1f7'], [.6, '#dde4ef'], [1, '#c6d1e2']]);
      glowSpot(c, w * .68, h * .30, h * .20, 'rgba(255,252,240,.9)');
      c.fillStyle = '#f8f6ee'; c.beginPath(); c.arc(w * .68, h * .30, h * .03, 0, 7); c.fill();
      ridge(c, w, h, .76, .07, 'rgba(158,172,196,.55)', 61);
      ridge(c, w, h, .85, .06, 'rgba(120,136,166,.55)', 62);
    },
    ambient(c, t, w, h) {
      for (let i = 0; i < 2; i++) {
        const x = ((t * (6 + i * 3) + i * w * .6) % (w + w * .5)) - w * .25;
        glowSpot(c, x, h * (.62 + i * .12), h * .16, 'rgba(255,255,255,.14)');
      }
      glowSpot(c, w * .68, h * .30, h * (.17 + .02 * Math.sin(t * .5)), 'rgba(255,252,240,.25)');
    } },

  { name: 'Nebula', light: false, z0: .08, z1: .88, fx: .5, fy: .46,
    defPal: 'Spectrum', defMode: 'Galaxy',
    draw(c, w, h) {
      vGrad(c, w, h, [[0, '#05040f'], [.5, '#0a0618'], [1, '#030209']]);
      // layered gas clouds
      const R = lcg(120);
      const tints = ['96,60,180', '40,90,190', '190,60,140', '60,150,170'];
      for (let i = 0; i < 14; i++) {
        const x = R() * w, y = R() * h, r = h * (.1 + R() * .22);
        glowSpot(c, x, y, r, `rgba(${tints[i % 4]},${.035 + R() * .05})`);
      }
      // dense starfield
      for (let i = 0; i < Math.round(w * h / 2600); i++) {
        const x = R() * w, y = R() * h;
        c.fillStyle = `rgba(226,232,255,${.15 + R() * .6})`;
        c.beginPath(); c.arc(x, y, .3 + R() * 1.0, 0, 7); c.fill();
      }
    },
    ambient(c, t, w, h) {
      twinkle(c, t, w, h, 1, Math.round(w * h / 9000), 121, .8);
      const x = ((t * 3) % (w * 1.6)) - w * .3;
      glowSpot(c, x, h * .3, h * .2, 'rgba(120,80,200,.03)');
      shootingStar(c, t, w, h, 13, 123);
    } },
];
