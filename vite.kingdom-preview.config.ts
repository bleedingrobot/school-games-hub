import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Kingdom Keeper preview (preview/kingdom) into dist-preview-kingdom/.
export default defineConfig({
  root: 'preview/kingdom',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-kingdom', emptyOutDir: true },
});
