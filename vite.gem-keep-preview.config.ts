import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Gem Keep preview (preview/gem-keep) into dist-preview-gem-keep/.
export default defineConfig({
  root: 'preview/gem-keep',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-gem-keep', emptyOutDir: true },
});
