import { S } from '../state.js';
import { SCENERIES } from '../scenery/index.js';

export const rnd = Math.random;
export const scen = () => SCENERIES[S.scenIdx] || SCENERIES[0];
export const zone = () => { const s = scen(); return [s.z0 * S.H, s.z1 * S.H]; };
export const focal = () => { const s = scen(); return [s.fx * S.W, s.fy * S.H]; };
