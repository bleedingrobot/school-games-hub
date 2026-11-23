import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Class Showdown test page (preview/showdown: projector and controller on the real server steps with a pretend
// class) into dist-preview-showdown/. Run it: npx vite --config vite.showdown-preview.config.ts
export default defineConfig({
  root: 'preview/showdown',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-showdown', emptyOutDir: true },
});
