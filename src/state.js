/* global mutable state + persistence */
export const S = {
  W: 0, H: 0, DPR: 1,
  flow: 1,            // 1 forward, -1 reverse
  zoom: 1,            // pinch scale .5..1.8
  sens: 1,            // sensitivity multiplier
  palIdx: 0, palManual: false,
  scenIdx: 0, modeIdx: 0,
  modeCfg: {},        // per-mode slider values: { modeName: { key: value } }
  lightScene: false,
  q: 1,               // perf quality 0.4..1
};

const KEY = 'arviz-v4';

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      flow: S.flow, zoom: S.zoom, sens: S.sens,
      palIdx: S.palIdx, palManual: S.palManual,
      scenIdx: S.scenIdx, modeIdx: S.modeIdx,
      modeCfg: S.modeCfg,
    }));
  } catch (_) {}
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    if (s.flow != null) S.flow = s.flow;
    if (s.zoom != null) S.zoom = s.zoom;
    if (s.sens != null) S.sens = s.sens;
    if (s.palIdx != null) S.palIdx = s.palIdx;
    S.palManual = !!s.palManual;
    if (s.scenIdx != null) S.scenIdx = s.scenIdx;
    if (s.modeIdx != null) S.modeIdx = s.modeIdx;
    if (s.modeCfg) S.modeCfg = s.modeCfg;
  } catch (_) {}
}

/* merged per-mode config: saved values over the mode's declared defaults */
export function cfgOf(mode) {
  const saved = S.modeCfg[mode.name] || {};
  const out = {};
  for (const [k, p] of Object.entries(mode.params || {}))
    out[k] = saved[k] != null ? saved[k] : p.val;
  return out;
}
export function setCfg(mode, key, value) {
  (S.modeCfg[mode.name] = S.modeCfg[mode.name] || {})[key] = value;
  save();
}
