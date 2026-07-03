import { S, save } from '../state.js';
import { buzz } from './haptics.js';
import { toast } from './toast.js';

/* tap = mode interaction; slow drag = steer; fast horizontal flick =
   flip flow; two fingers = pinch zoom. Every gesture ticks the haptics. */
export function initGestures(canvas, api) {
  const ptrs = new Map();
  let pinch = null;

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY,
                            t0: performance.now(), moved: false });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: S.zoom };
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 14) p.moved = true;
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      S.zoom = Math.min(1.8, Math.max(.5, pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0));
      buzz(3);
      return;
    }
    if (p.moved) { api.drag(p.x, p.y, dx, dy); buzz(4); }
  });
  function end(e) {
    const p = ptrs.get(e.pointerId); if (!p) return;
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) { pinch = null; buzz(6); save(); } return; }
    const dt = (performance.now() - p.t0) / 1000, tx = p.x - p.x0, ty = p.y - p.y0;
    if (!p.moved && dt < .4) {
      api.tap(p.x, p.y);
      buzz(10);
    } else if (dt < .3 && Math.abs(tx) > 80 && Math.abs(tx) > 2.2 * Math.abs(ty)) {
      const nf = tx > 0 ? 1 : -1;
      if (nf !== S.flow) {
        S.flow = nf;
        api.flowChanged();
        toast(S.flow > 0 ? 'Flow →' : '← Flow');
        buzz([10, 40, 10]); save();
      }
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
