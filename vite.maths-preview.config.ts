import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone maths practice page (preview/maths) into dist-preview-maths/.
export default defineConfig({
  root: 'preview/maths',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-maths', emptyOutDir: true },
});
