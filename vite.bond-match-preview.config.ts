import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Bond Match preview (preview/bond-match) into dist-preview-bond-match/.
export default defineConfig({
  root: 'preview/bond-match',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-bond-match', emptyOutDir: true },
});
