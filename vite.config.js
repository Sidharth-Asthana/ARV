import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

// The build emits a single self-contained dist/ARviz.html (plus the PWA
// shell copied verbatim from public/), keeping the app as portable as the
// original hand-written file.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: { input: resolve(__dirname, 'ARviz.html') },
    target: 'es2020',
  },
});
