import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Wormholes & Black Holes preview (preview/space) into dist-preview/.
export default defineConfig({
  root: 'preview/space',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview', emptyOutDir: true },
});
