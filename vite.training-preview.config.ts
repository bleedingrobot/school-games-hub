import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Basic Facts Training preview (preview/training) into dist-preview-training/.
export default defineConfig({
  root: 'preview/training',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-training', emptyOutDir: true },
});
