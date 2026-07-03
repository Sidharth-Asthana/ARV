import { S } from '../state.js';

/* each scheme is an explicit color list; entities cycle smoothly through
   the list over time, and the settings chips are built from the exact
   same list, so panel and canvas always match. */
export const PALETTES = [
  { name: 'Aurora',   cols: ['#38f5a6', '#2ce0d2', '#5f7cff', '#a05cff', '#4ecf8e'] },
  { name: 'Ember',    cols: ['#ffd23f', '#cc7722', '#ff7a1a', '#e63b2e', '#ff9d2e'] },
  { name: 'Ocean',    cols: ['#eef7ff', '#9fd0ff', '#2ad4ff', '#7fffd4', '#2b4bc4'] },
  { name: 'Candy',    cols: ['#ff5cd0', '#ff4d6d', '#ff9ecb', '#c44dff', '#ff6ea9'] },
  { name: 'Spectrum', cols: ['#ff4646', '#ffc93c', '#3cf58a', '#3cc8ff', '#9b4dff'] },
];
for (const p of PALETTES) {
  p.rgb = p.cols.map(c => [
    parseInt(c.slice(1, 3), 16) / 255,
    parseInt(c.slice(3, 5), 16) / 255,
    parseInt(c.slice(5, 7), 16) / 255,
  ]);
  p.grad = `conic-gradient(${[...p.cols, p.cols[0]].join(',')})`;
}

const CYCLE_SPEED = .03;           // one trip through the list ~33s

export const pal = () => PALETTES[S.palIdx] || PALETTES[0];

/* rgb triple (0..1 floats) at cycle position f, drifting with time */
export function rgbAt(f, t) {
  const list = pal().rgb, n = list.length;
  const p = (((f + t * CYCLE_SPEED) % 1) + 1) % 1 * n;
  const i = Math.floor(p) % n, fr = p - Math.floor(p);
  const a = list[i], b = list[(i + 1) % n];
  let r = a[0] + (b[0] - a[0]) * fr,
      g = a[1] + (b[1] - a[1]) * fr,
      bl = a[2] + (b[2] - a[2]) * fr;
  if (S.lightScene) { r *= .5; g *= .5; bl *= .5; }
  return [r, g, bl];
}

/* css string variant for DOM/2D-ambient use */
export function cssAt(f, t, alpha) {
  const [r, g, b] = rgbAt(f, t);
  return `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${alpha})`;
}
