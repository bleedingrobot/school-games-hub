import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Hop's Glow-worm Pond preview (preview/hop: the whole game on a pretend server in the browser) into
// dist-preview-hop/. Run it: npx vite --config vite.hop-preview.config.ts
// With HOP_INLINE=1 everything goes inside the script, so `npm run hop:single` can make one HTML file.
export default defineConfig({
  root: 'preview/hop',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-hop', emptyOutDir: true, assetsInlineLimit: process.env.HOP_INLINE ? 100_000_000 : 4096,
    ...(process.env.HOP_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
