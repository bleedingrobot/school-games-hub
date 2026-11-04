import { defineConfig } from 'vite';

// Builds the Star Forge 3D viewer preview (preview/trader-forge-viewer: example systems, no sign-in) into dist-preview-trader-forge-viewer/.
export default defineConfig({
  root: 'preview/trader-forge-viewer',
  base: './',
  build: {
    outDir: '../../dist-preview-trader-forge-viewer',
    emptyOutDir: true,
  },
});
