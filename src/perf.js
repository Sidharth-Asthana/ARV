import { S } from './state.js';

/* adaptive quality: drop render scale + entity budgets below ~50fps */
let acc = 0, frames = 0;
export function tickPerf(dt, onChange) {
  acc += dt; frames++;
  if (acc >= 2) {
    const fps = frames / acc; acc = 0; frames = 0;
    const old = S.q;
    if (fps < 47) S.q = Math.max(.4, S.q - .15);
    else if (fps > 56) S.q = Math.min(1, S.q + .06);
    if (S.q !== old) onChange && onChange();
  }
}
