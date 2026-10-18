import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Clan Quest preview (preview/clans) into dist-preview-clans/.
export default defineConfig({
  root: 'preview/clans',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-clans', emptyOutDir: true, assetsInlineLimit: 100_000_000 },
});
