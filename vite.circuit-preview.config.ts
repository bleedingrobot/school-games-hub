import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Circuit Racer preview (preview/circuit: the whole game on the real server handler with a pretend database, in
// the browser) into dist-preview-circuit/. Run it: npx vite --config vite.circuit-preview.config.ts
export default defineConfig({
  root: 'preview/circuit',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-circuit', emptyOutDir: true },
});
