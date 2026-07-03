import './style.css';
import { S, save, load, cfgOf } from './state.js';
import { PALETTES } from './color/palettes.js';
import { SCENERIES } from './scenery/index.js';
import { MODES } from './modes/index.js';
import { audio, updateAudio, setFollowCallback } from './audio/engine.js';
import { createPainter } from './render/painter.js';
import { tickPerf } from './perf.js';
import { initPanel, buildCfgSliders, syncRow, setHint, setFollow, toggleSheet } from './ui/panel.js';
import { initGestures } from './ui/gestures.js';
import { initKeys } from './ui/keys.js';
import { toast } from './ui/toast.js';

const $ = s => document.querySelector(s);
const bgc = $('#bgc'), bctx = bgc.getContext('2d');
const amb = $('#amb'), actx = amb.getContext('2d');
const glc = $('#glc');

load();
const painter = createPainter(glc);

const scen = () => SCENERIES[S.scenIdx] || SCENERIES[0];
const mode = () => MODES[S.modeIdx] || MODES[0];

function paintScene() {
  bctx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
  scen().draw(bctx, S.W, S.H, true);
  S.lightScene = scen().light;
  // additive canvas over light scenes would wash out: fall back to alpha
  glc.style.mixBlendMode = (painter.kind === 'webgl' && !S.lightScene) ? 'plus-lighter' : 'normal';
}

function resize() {
  S.DPR = Math.min(devicePixelRatio || 1, 2);
  S.W = innerWidth; S.H = innerHeight;
  for (const c of [bgc, amb]) {
    c.width = S.W * S.DPR; c.height = S.H * S.DPR;
    c.style.width = S.W + 'px'; c.style.height = S.H + 'px';
  }
  actx.setTransform(S.DPR, 0, 0, S.DPR, 0, 0);
  painter.resize(S.W, S.H, S.DPR, Math.max(.55, S.q));
  paintScene();
  mode().reset(cfgOf(mode()));
}

/* ---------- shared UI api ---------- */
const api = {
  setScene(i) {
    S.scenIdx = i;
    const s = scen();
    if (!S.palManual) {
      const pi = PALETTES.findIndex(p => p.name === s.defPal);
      if (pi >= 0) { S.palIdx = pi; syncRow($('#palRow'), pi); }
    }
    // scenery brings its signature mode (still freely switchable)
    const mi = MODES.findIndex(m => m.name === s.defMode);
    if (mi >= 0 && mi !== S.modeIdx) { S.modeIdx = mi; syncRow($('#modeRow'), mi); }
    paintScene();
    painter.clear();
    mode().reset(cfgOf(mode()));
    setHint(mode().hint);
    buildCfgSliders(api);
    syncRow($('#bgRow'), i);
    save();
  },
  setMode(i) {
    S.modeIdx = i;
    painter.clear();
    mode().reset(cfgOf(mode()));
    setHint(mode().hint);
    buildCfgSliders(api);
    syncRow($('#modeRow'), i);
    save();
  },
  setPalette(i) {
    S.palIdx = i; S.palManual = true;
    syncRow($('#palRow'), i); save();
  },
  resetMode() { mode().reset(cfgOf(mode())); },
  flowChanged() { syncRow($('#flowRow'), S.flow > 0 ? 0 : 1); save(); },
  followChanged() { setFollow(); },
  togglePanel() { toggleSheet(); },
  async fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (e) { toast('Fullscreen not available in this browser'); }
  },
  tap(x, y) { mode().tap && mode().tap(x, y, cfgOf(mode())); },
  drag(x, y, dx, dy) { mode().drag && mode().drag(x, y, dx, dy, cfgOf(mode())); },
};

initPanel(api);
initGestures(glc, api);
initKeys(api);
setFollowCallback(setFollow);
addEventListener('resize', resize);

/* restore last session's scenery/mode without re-triggering defaults */
resize();
syncRow($('#flowRow'), S.flow > 0 ? 0 : 1);
setHint(mode().hint);
setFollow();
buildCfgSliders(api);

/* keep the screen awake while visualizing */
async function keepAwake() {
  try { await navigator.wakeLock.request('screen'); } catch (_) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
addEventListener('pointerdown', keepAwake, { once: true });

/* offline/installable app shell */
if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

/* ---------- render loop ---------- */
let last = performance.now();
function frame(now) {
  const t = now / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
  tickPerf(dt, () => painter.resize(S.W, S.H, S.DPR, Math.max(.55, S.q)));
  updateAudio(t, dt);

  const m = mode(), cfg = cfgOf(m);
  m.step(dt, t, cfg);

  // living scenery layer (Canvas2D, faint by design)
  actx.clearRect(0, 0, S.W, S.H);
  if (scen().ambient) scen().ambient(actx, t, S.W, S.H);

  // entity layer (WebGL trails + bloom, or 2D fallback)
  const decay = cfg.trail != null ? cfg.trail / 100 : 0;
  painter.begin(decay);
  m.draw(painter, t, cfg);
  painter.flush(m.bloom != null ? m.bloom : .55);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
