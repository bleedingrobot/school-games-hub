import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Glyph Gates preview (preview/glyph: the whole game on a pretend server in the browser) into
// dist-preview-glyph/. Run it: npx vite --config vite.glyph-preview.config.ts
export default defineConfig({
  root: 'preview/glyph',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-glyph', emptyOutDir: true },
});
