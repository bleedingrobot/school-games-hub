import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Mine Runner preview (preview/mine) into dist-preview-mine/.
// With MINE_INLINE=1 everything goes inside the script, so `npm run mine:single` can make one HTML file.
export default defineConfig({
  root: 'preview/mine',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-mine', emptyOutDir: true, assetsInlineLimit: process.env.MINE_INLINE ? 100_000_000 : 4096,
    // One file can't load parts of itself later, so the inline build keeps every part in the one script.
    ...(process.env.MINE_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
