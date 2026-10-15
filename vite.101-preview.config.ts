import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone 101 preview (preview/101) into dist-preview-101/.
export default defineConfig({
  root: 'preview/101',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-101', emptyOutDir: true },
});
