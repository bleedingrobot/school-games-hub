import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Class Live test page (preview/classlive: projector and controller on the real server steps with a pretend
// class) into dist-preview-classlive/. Run it: npx vite --config vite.classlive-preview.config.ts
export default defineConfig({
  root: 'preview/classlive',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-classlive', emptyOutDir: true },
});
