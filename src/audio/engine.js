import { S } from '../state.js';
import { toast } from '../ui/toast.js';

/* ================= audio engine v4 =================
   - 24 mel-spaced bands from a 2048-point FFT
   - auto-gain against a slowly decaying loudness peak
   - onset detection per instrument group (drums/keys/percussion) with
     pace-scaled adaptive thresholds; a conductor elects a lead instrument
   - autocorrelation tempo tracking over a 6s onset-envelope history,
     with beat-phase prediction: the engine knows when the next beat is
     due (audio.phase01 ramps 0->1 toward it) and fires grid beats when
     an expected hit is acoustically buried
   - sources: synthetic demo beat, microphone, desktop tab capture */

export const N_MEL = 24;
const GROUPS = [
  { name: 'drums',      lo: 0,  hi: 6,  floor: .010 },
  { name: 'keys',       lo: 6,  hi: 15, floor: .007 },
  { name: 'percussion', lo: 15, hi: 24, floor: .008 },
];

export const audio = {
  mode: 'demo',                 // demo | mic | tab
  mel: new Float32Array(N_MEL), // smoothed 0..1 mel band energies
  bass: 0, mid: 0, treb: 0, level: 0,
  onBeat: false, beatAmp: 0, beatGlow: 0,
  shimmer: 0, onShimmer: false,
  bpm: 118, phase01: 0,         // progress toward the predicted next beat
  energyAvg: .4, pace: .5, peak: .3,
  lead: 0, second: 1,
  groups: GROUPS,
  // internals
  ac: null, an: null, buf: null, prevMel: new Float32Array(N_MEL),
  env: new Float32Array(512), envT: new Float32Array(512), envI: 0,
  lastBeat: 0, lastShim: 0, nextBeatAt: 0, tempoAt: 0, evalAt: 0,
  gb: GROUPS.map(g => ({ ...g, hist: [], sal: 0, ivs: [], lastOn: -9, onset: false, strength: 0 })),
  stream: null,
};

let melFilters = null;   // [ [binStart, weights...] per mel band ]

function buildMelFilters(binCount, sampleRate) {
  const fMax = Math.min(9000, sampleRate / 2), fMin = 40;
  const mel = f => 2595 * Math.log10(1 + f / 700);
  const inv = m => 700 * (Math.pow(10, m / 2595) - 1);
  const m0 = mel(fMin), m1 = mel(fMax);
  const centers = [];
  for (let i = 0; i < N_MEL + 2; i++) centers.push(inv(m0 + (m1 - m0) * i / (N_MEL + 1)));
  const binHz = sampleRate / 2 / binCount;
  melFilters = [];
  for (let b = 1; b <= N_MEL; b++) {
    const lo = centers[b - 1], c = centers[b], hi = centers[b + 1];
    const s = Math.max(1, Math.floor(lo / binHz)), e = Math.min(binCount - 1, Math.ceil(hi / binHz));
    const w = new Float32Array(e - s + 1);
    let sum = 0;
    for (let i = s; i <= e; i++) {
      const f = i * binHz;
      const v = f < c ? (f - lo) / (c - lo) : (hi - f) / (hi - c);
      w[i - s] = Math.max(0, v); sum += w[i - s];
    }
    if (sum > 0) for (let i = 0; i < w.length; i++) w[i] /= sum;
    melFilters.push({ start: s, w });
  }
}

async function attachStream(stream, label) {
  audio.ac = audio.ac || new (window.AudioContext || window.webkitAudioContext)();
  await audio.ac.resume();
  if (audio.stream) for (const tr of audio.stream.getTracks()) tr.stop();
  audio.stream = stream;
  const src = audio.ac.createMediaStreamSource(stream);
  audio.an = audio.ac.createAnalyser();
  audio.an.fftSize = 2048;
  audio.an.smoothingTimeConstant = .55;
  src.connect(audio.an);
  audio.buf = new Uint8Array(audio.an.frequencyBinCount);
  buildMelFilters(audio.an.frequencyBinCount, audio.ac.sampleRate);
  audio.mode = label;
  audio.peak = .3; audio.env.fill(0);
  for (const g of audio.gb) { g.hist.length = 0; g.ivs.length = 0; g.sal = 0; g.lastOn = -9; }
}

export async function startMic(deviceId) {
  const constraints = id => ({
    audio: {
      echoCancellation: false, noiseSuppression: false,
      ...(id ? { deviceId: { exact: id } } : {}),
    },
  });
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints(deviceId));
    } catch (e) {
      if (!deviceId) throw e;
      // saved device unplugged/renamed: fall back to the default input
      stream = await navigator.mediaDevices.getUserMedia(constraints(null));
      toast('Saved input unavailable — using default microphone');
    }
    await attachStream(stream, 'mic');
    const label = stream.getAudioTracks()[0]?.label;
    toast(label ? `Listening via ${label}` : 'Listening — play music out loud nearby');
    return true;
  } catch (e) {
    toast('Microphone not available — demo beat continues');
    return false;
  }
}

/* labeled audio inputs (labels appear once mic permission is granted) */
export async function listInputs() {
  try {
    const ds = await navigator.mediaDevices.enumerateDevices();
    return ds.filter(d => d.kind === 'audioinput')
             .map(d => ({ id: d.deviceId, label: d.label || 'Microphone' }));
  } catch (e) { return []; }
}

/* desktop only: capture the audio of a chosen browser tab (lossless sync) */
export const tabCaptureSupported = () =>
  !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

export async function startTab() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, audio: true,       // Chrome requires video; we discard it
    });
    if (!stream.getAudioTracks().length) {
      for (const tr of stream.getTracks()) tr.stop();
      toast('No audio shared — tick "Share tab audio" when choosing the tab');
      return false;
    }
    for (const tr of stream.getVideoTracks()) tr.stop();
    stream.getAudioTracks()[0].addEventListener('ended', () => {
      if (audio.mode === 'tab') { audio.mode = 'demo'; toast('Tab capture ended — demo beat resumed'); }
    });
    await attachStream(stream, 'tab');
    toast('Synced to tab audio');
    return true;
  } catch (e) {
    toast('Tab capture cancelled');
    return false;
  }
}
export function stopCapture() {
  if (audio.stream) for (const tr of audio.stream.getTracks()) tr.stop();
  audio.stream = null;
  audio.mode = 'demo';
}

function registerBeat(t, amp, soft) {
  audio.onBeat = true;
  audio.beatAmp = Math.min(1, amp * (.5 + audio.pace * .9));
  audio.beatGlow = Math.max(audio.beatGlow, soft ? .55 : 1);
  audio.lastBeat = t;
}

/* ---------- tempo: autocorrelation over the onset envelope ---------- */
function trackTempo(t) {
  if (t < audio.tempoAt) return;
  audio.tempoAt = t + 2.5;
  // gather ~6s of envelope, resampled to 100Hz
  const HZ = 100, LEN = 600;
  const e = new Float32Array(LEN);
  const t0 = t - LEN / HZ;
  for (let i = 0; i < 512; i++) {
    const ts = audio.envT[i];
    if (ts <= t0 || ts > t) continue;
    const idx = Math.min(LEN - 1, Math.floor((ts - t0) * HZ));
    e[idx] = Math.max(e[idx], audio.env[i]);
  }
  let mean = 0; for (let i = 0; i < LEN; i++) mean += e[i]; mean /= LEN;
  if (mean < .002) return;                       // silence: keep last tempo
  for (let i = 0; i < LEN; i++) e[i] -= mean;
  // autocorrelate for lags 40..250 BPM, prefer the 90..180 octave
  let bestLag = 0, bestV = -1;
  for (let lag = Math.floor(HZ * 60 / 250); lag <= Math.floor(HZ * 60 / 40); lag++) {
    let v = 0;
    for (let i = lag; i < LEN; i++) v += e[i] * e[i - lag];
    const bpm = 60 * HZ / lag;
    const pref = (bpm >= 90 && bpm <= 180) ? 1 : .72;
    v *= pref;
    if (v > bestV) { bestV = v; bestLag = lag; }
  }
  if (bestLag > 0 && bestV > 0) {
    const bpm = 60 * HZ / bestLag;
    audio.bpm += (bpm - audio.bpm) * .5;
    // phase: align the beat grid to the strongest recent comb position
    const iv = 60 / audio.bpm;
    let bestOff = 0, bestS = -1;
    for (let k = 0; k < 24; k++) {
      const off = k / 24 * iv;
      let s = 0;
      for (let b = 0; b < 6; b++) {
        const tb = t - off - b * iv;
        const idx = Math.floor((tb - t0) * HZ);
        if (idx >= 0 && idx < LEN) s += e[idx] + (idx > 0 ? e[idx - 1] : 0);
      }
      if (s > bestS) { bestS = s; bestOff = off; }
    }
    audio.nextBeatAt = t - bestOff + iv;
    while (audio.nextBeatAt < t + .05) audio.nextBeatAt += iv;
  }
}

/* ---------- conductor: elect the lead instrument ---------- */
function conductor(t) {
  if (t < audio.evalAt) return;
  audio.evalAt = t + 3;
  const scores = audio.gb.map(g => {
    if (g.sal < 1e-4) return 0;
    let reg = .3, plaus = .6;
    if (g.ivs.length >= 3) {
      const m = g.ivs.reduce((a, x) => a + x, 0) / g.ivs.length;
      const cv = Math.sqrt(g.ivs.reduce((a, x) => a + (x - m) * (x - m), 0) / g.ivs.length) / m;
      reg = 1 / (1 + cv * 2);
      const rate = 1 / m;
      plaus = (rate > .3 && rate < 5) ? 1 : .5;
    }
    return g.sal * (.4 + .8 * reg) * plaus;
  });
  let best = 0; scores.forEach((s, i) => { if (s > scores[best]) best = i; });
  if (best !== audio.lead && scores[best] > scores[audio.lead] * 1.3) {
    audio.lead = best;
    toast(`Following ${audio.gb[best].name}`);
  }
  let sec = (audio.lead + 1) % 3;
  audio.gb.forEach((_, i) => { if (i !== audio.lead && scores[i] > scores[sec]) sec = i; });
  audio.second = sec;
  onFollowChange && onFollowChange();
}
export let onFollowChange = null;
export function setFollowCallback(fn) { onFollowChange = fn; }

/* ---------- per-frame update ---------- */
let demoBeatIdx = -1;
export function updateAudio(t, dt) {
  audio.onBeat = false; audio.onShimmer = false;
  audio.beatGlow *= .92; audio.shimmer *= .88;
  const sens = S.sens;

  if (audio.mode !== 'demo' && audio.an) {
    audio.an.getByteFrequencyData(audio.buf);
    // mel band energies + auto-gain
    let raw = 0;
    const melRaw = new Float32Array(N_MEL);
    for (let b = 0; b < N_MEL; b++) {
      const f = melFilters[b];
      let v = 0;
      for (let i = 0; i < f.w.length; i++) v += audio.buf[f.start + i] * f.w[i];
      melRaw[b] = v / 255;
      raw += melRaw[b];
    }
    raw /= N_MEL;
    audio.peak = Math.max(audio.peak * .9985, raw, .04);
    const agc = Math.min(8, .5 / audio.peak) * sens;
    const ease = .25 + .25 * audio.pace;
    let flux = [0, 0, 0], groupE = [0, 0, 0];
    for (let b = 0; b < N_MEL; b++) {
      const v = Math.min(1, melRaw[b] * agc);
      audio.mel[b] += (v - audio.mel[b]) * ease;
      const d = v - audio.prevMel[b];
      audio.prevMel[b] = v;
      const gi = b < 6 ? 0 : b < 15 ? 1 : 2;
      if (d > 0) flux[gi] += d;
      groupE[gi] += v;
    }
    flux[0] /= 6; flux[1] /= 9; flux[2] /= 9;
    audio.bass += (groupE[0] / 6 - audio.bass) * (ease + .1);
    audio.mid  += (groupE[1] / 9 - audio.mid) * ease;
    audio.treb += (groupE[2] / 9 - audio.treb) * ease;
    audio.level = Math.min(1, audio.bass * .55 + audio.mid * .3 + audio.treb * .15);

    // onset envelope history (for tempo autocorrelation)
    const envV = flux[0] * 1.2 + flux[1] * .6 + flux[2] * .4;
    audio.env[audio.envI] = envV; audio.envT[audio.envI] = t;
    audio.envI = (audio.envI + 1) % 512;

    // per-group onsets: slow songs trigger easier, fast songs need hits
    const k = 1.3 + audio.pace * 1.0, gate = audio.level > .06;
    for (const [gi, g] of audio.gb.entries()) {
      g.onset = false;
      const f = flux[gi];
      g.hist.push(f); if (g.hist.length > 45) g.hist.shift();
      const n = g.hist.length;
      const mean = g.hist.reduce((a, x) => a + x, 0) / n;
      const std = Math.sqrt(g.hist.reduce((a, x) => a + (x - mean) * (x - mean), 0) / n) || 1e-4;
      if (n > 20 && gate && f > mean + k * std && f > g.floor && t - g.lastOn > .18) {
        g.onset = true;
        g.strength = Math.min(1, .4 + (f - mean) / (std * 4 + 1e-4) * .3);
        const iv = t - g.lastOn;
        if (iv > .2 && iv < 2.5) { g.ivs.push(iv); if (g.ivs.length > 8) g.ivs.shift(); }
        g.lastOn = t; g.sal += (f - g.sal) * .35;
      } else g.sal *= Math.pow(.985, dt * 60);
    }
    trackTempo(t);
    conductor(t);

    // major beat: lead instrument onset near the predicted grid, or the
    // grid itself when the hit is buried
    const iv = 60 / audio.bpm;
    const lead = audio.gb[audio.lead];
    if (lead.onset && t - audio.lastBeat > .22) {
      registerBeat(t, lead.strength, false);
      // gently re-phase the grid onto real hits
      if (Math.abs(t - audio.nextBeatAt) < iv * .25) audio.nextBeatAt = t + iv;
    } else if (audio.nextBeatAt > 0 && t >= audio.nextBeatAt && audio.level > .1) {
      registerBeat(t, .4 * Math.min(1, audio.level * 1.6), true);
      audio.nextBeatAt += iv;
    }
    audio.phase01 = audio.nextBeatAt > t
      ? 1 - Math.min(1, (audio.nextBeatAt - t) / iv) : 0;

    // minor accents from the runner-up instrument
    const sec = audio.gb[audio.second];
    if (sec.onset && t - audio.lastShim > .15 && t - audio.lastBeat > .06) {
      audio.shimmer = Math.min(1, .5 + sec.strength * .5);
      audio.onShimmer = true; audio.lastShim = t;
    }
  } else {
    /* synthetic demo groove */
    const bpm = 118, ph = t * bpm / 60, idx = Math.floor(ph);
    const sect = .55 + .45 * Math.abs(Math.sin(idx / 8));
    if (idx !== demoBeatIdx) {
      demoBeatIdx = idx;
      if (Math.sin(idx * 12.9898) * 43758.5453 % 1 > -0.75) {
        registerBeat(t, .7 + .3 * sect, false);
        if (idx % 2) { audio.shimmer = 1; audio.onShimmer = true; }
      }
    }
    const env = Math.exp(-(ph % 1) * 6);
    audio.bass = Math.min(1, (env * .85 + .06) * sect * sens);
    audio.mid  = Math.min(1, (.28 + .2 * Math.sin(t * .9) + .12 * Math.sin(t * 3.7)) * sect * sens);
    audio.treb = Math.min(1, (.18 + .14 * Math.sin(t * 5.3 + 1)) * sect * sens);
    audio.level = Math.min(1, audio.bass * .55 + audio.mid * .3 + audio.treb * .15);
    audio.bpm = bpm;
    audio.phase01 = ph % 1;
    for (let b = 0; b < N_MEL; b++) {
      const gi = b < 6 ? 0 : b < 15 ? 1 : 2;
      const base = gi === 0 ? audio.bass : gi === 1 ? audio.mid : audio.treb;
      const tgt = Math.min(1, base * (.55 + .45 * Math.sin(t * (1.1 + b * .37) + b * 2.1)) * 1.15);
      audio.mel[b] += (tgt - audio.mel[b]) * .3;
    }
  }

  /* tempo + energy -> pace: slow songs ease gently, fast songs jolt hard */
  audio.energyAvg += (audio.level - audio.energyAvg) * .01;
  const paceT = Math.max(0, Math.min(1, (audio.bpm - 70) / 95 * .55 + audio.energyAvg * .75));
  audio.pace += (paceT - audio.pace) * .02;
}
