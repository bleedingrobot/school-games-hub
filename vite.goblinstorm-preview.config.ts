import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Goblin Storm preview (preview/goblinstorm: the whole game on a stand-in server in the browser) into
// dist-preview-goblinstorm/. Run it: npx vite --config vite.goblinstorm-preview.config.ts
export default defineConfig({
  root: 'preview/goblinstorm',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-goblinstorm', emptyOutDir: true },
});
