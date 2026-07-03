import { S, save, cfgOf, setCfg } from '../state.js';
import { PALETTES } from '../color/palettes.js';
import { SCENERIES } from '../scenery/index.js';
import { MODES } from '../modes/index.js';
import { audio, startMic, startTab, stopCapture, tabCaptureSupported, listInputs } from '../audio/engine.js';
import { buzz } from './haptics.js';

const $ = s => document.querySelector(s);

export function syncRow(row, idx) {
  [...row.children].forEach((c, i) => c.classList.toggle('on', i === idx));
}

export function initPanel(api) {
  /* scenery swatches, painted by the real scenery painters */
  const bgRow = $('#bgRow');
  for (const [i, s] of SCENERIES.entries()) {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === S.scenIdx ? ' on' : '');
    b.title = s.name; b.setAttribute('aria-label', s.name);
    const tc = document.createElement('canvas'); tc.width = tc.height = 88;
    const tcx = tc.getContext('2d');
    s.draw(tcx, 88, 88, false);
    if (s.ambient) s.ambient(tcx, 0, 88, 88);
    b.style.backgroundImage = `url(${tc.toDataURL()})`;
    b.dataset.i = i; bgRow.appendChild(b);
  }
  chipRow(bgRow, c => { api.setScene(+c.dataset.i); return true; });

  /* mode chips */
  const modeRow = $('#modeRow');
  for (const [i, m] of MODES.entries()) {
    const b = document.createElement('button');
    b.className = 'chip' + (i === S.modeIdx ? ' on' : '');
    b.textContent = m.name; b.dataset.i = i;
    modeRow.appendChild(b);
  }
  chipRow(modeRow, c => { api.setMode(+c.dataset.i); return true; });

  /* audio source chips (tab capture only where supported) */
  const srcRow = $('#srcRow');
  const sources = [['demo', 'Demo beat'], ['mic', 'Listen (mic)']];
  if (tabCaptureSupported()) sources.push(['tab', 'Capture tab']);
  for (const [i, [key, label]] of sources.entries()) {
    const b = document.createElement('button');
    b.className = 'chip' + (i === 0 ? ' on' : '');
    b.dataset.src = key; b.textContent = label;
    srcRow.appendChild(b);
  }
  chipRow(srcRow, async c => {
    const k = c.dataset.src;
    if (k === 'mic') {
      const ok = await startMic(S.micId);
      if (ok) refreshMicList();
      return ok;
    }
    if (k === 'tab') return startTab();
    stopCapture(); api.followChanged(); return true;
  });

  /* input device dropdown: appears once mic permission reveals labels,
     so Stereo Mix / loopback devices can be picked in-app */
  const micSel = $('#micSel');
  async function refreshMicList() {
    const inputs = await listInputs();
    const labeled = inputs.filter(d => d.id);
    if (labeled.length < 2) { micSel.hidden = true; return; }
    micSel.innerHTML = '';
    for (const d of labeled) {
      const o = document.createElement('option');
      o.value = d.id; o.textContent = d.label;
      micSel.appendChild(o);
    }
    if (S.micId && [...micSel.options].some(o => o.value === S.micId))
      micSel.value = S.micId;
    micSel.hidden = false;
  }
  micSel.addEventListener('change', async () => {
    S.micId = micSel.value; save();
    if (audio.mode === 'mic') await startMic(S.micId);
  });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener)
    navigator.mediaDevices.addEventListener('devicechange', () => {
      if (!micSel.hidden || audio.mode === 'mic') refreshMicList();
    });

  /* flow + palettes */
  chipRow($('#flowRow'), c => { S.flow = +c.dataset.flow; return true; });
  const palRow = $('#palRow');
  for (const [i, p] of PALETTES.entries()) {
    const b = document.createElement('button');
    b.className = 'chip' + (i === S.palIdx ? ' on' : '');
    b.innerHTML = `<span class="dot" style="background:${p.grad}"></span>${p.name}`;
    b.dataset.i = i; palRow.appendChild(b);
  }
  chipRow(palRow, c => { S.palIdx = +c.dataset.i; S.palManual = true; return true; });

  $('#sens').value = Math.round(S.sens * 100);
  $('#sens').addEventListener('input', e => { S.sens = e.target.value / 100; save(); });

  $('#gearBtn').addEventListener('click', () => { buzz(6); toggleSheet(); });
  $('#fsBtn').addEventListener('click', () => { buzz(6); api.fullscreen(); });

  buildCfgSliders(api);
}

export function toggleSheet() { $('#sheet').classList.toggle('hidden'); }

function chipRow(rowEl, onPick) {
  rowEl.addEventListener('click', e => {
    const c = e.target.closest('.chip,.swatch'); if (!c) return;
    buzz(6);
    Promise.resolve(onPick(c)).then(ok => {
      if (ok === false) return;
      for (const x of rowEl.children) x.classList.toggle('on', x === c);
      save();
    });
  });
}

/* per-mode slider block: rebuilt on every mode switch, values stored
   separately for each mode */
export function buildCfgSliders(api) {
  const mode = MODES[S.modeIdx];
  const wrap = document.querySelector('#cfgRows');
  document.querySelector('#cfgLbl').textContent = `${mode.name} settings`;
  wrap.innerHTML = '';
  const cfg = cfgOf(mode);
  for (const [key, spec] of Object.entries(mode.params || {})) {
    const row = document.createElement('div');
    row.className = 'sl';
    const lab = document.createElement('span');
    lab.textContent = spec.label;
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = spec.min; inp.max = spec.max; inp.step = spec.step;
    inp.value = cfg[key];
    inp.addEventListener('input', () => {
      setCfg(mode, key, +inp.value);
      if (spec.reset) api.resetMode();
    });
    row.append(lab, inp);
    wrap.appendChild(row);
  }
}

export function setHint(text) { document.querySelector('#hint').textContent = text; }
export function setFollow() {
  const el = document.querySelector('#follow');
  el.textContent = audio.mode !== 'demo'
    ? `following ${audio.gb[audio.lead].name} · ${Math.round(audio.bpm)} bpm`
    : `demo beat · 118 bpm`;
}
