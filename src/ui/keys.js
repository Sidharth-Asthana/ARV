import { S } from '../state.js';
import { toast } from './toast.js';

/* desktop keyboard shortcuts:
   F fullscreen · Space/H panel · ←/→ scenery · ↑/↓ mode ·
   1-5 palettes · R reverse flow */
export function initKeys(api) {
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case 'f': case 'F': api.fullscreen(); break;
      case ' ': case 'h': case 'H': e.preventDefault(); api.togglePanel(); break;
      case 'ArrowRight': e.preventDefault(); api.setScene((S.scenIdx + 1) % 10); break;
      case 'ArrowLeft':  e.preventDefault(); api.setScene((S.scenIdx + 9) % 10); break;
      case 'ArrowDown':  e.preventDefault(); api.setMode((S.modeIdx + 1) % 10); break;
      case 'ArrowUp':    e.preventDefault(); api.setMode((S.modeIdx + 9) % 10); break;
      case 'r': case 'R': S.flow = -S.flow; api.flowChanged();
        toast(S.flow > 0 ? 'Flow →' : '← Flow'); break;
      default:
        if (e.key >= '1' && e.key <= '5') api.setPalette(+e.key - 1);
    }
  });
}
