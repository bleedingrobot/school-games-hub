import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone power-clash preview (preview/power-clash) into dist-preview-power-clash/.
export default defineConfig({
  root: 'preview/power-clash',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-power-clash', emptyOutDir: true },
});
