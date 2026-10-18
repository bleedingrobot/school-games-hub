import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Dragon Maths preview (preview/lord) into dist-preview-lord/.
export default defineConfig({
  root: 'preview/lord',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-lord', emptyOutDir: true },
});
