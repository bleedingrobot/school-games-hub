import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Builds the Star Trader preview (preview/trader: the whole game on a pretend server in the browser) into dist-preview-trader/.
// preview/trader/art.html, ships.html and planets.html (the painted globes) are harnesses for the pictures alone.
// With TRADER_INLINE=1 only the game page is built, with everything inside the script, so it can be made into one HTML file:
// TRADER_INLINE=1 npx vite build --config vite.trader-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-trader star-trader-test-page.html
const inline = Boolean(process.env.TRADER_INLINE);
export default defineConfig({
  root: 'preview/trader',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist-preview-trader',
    emptyOutDir: true,
    assetsInlineLimit: inline ? 100_000_000 : 4096,
    rolldownOptions: inline
      ? { output: { codeSplitting: false } }
      : { input: { index: resolve(__dirname, 'preview/trader/index.html'), art: resolve(__dirname, 'preview/trader/art.html'), ships: resolve(__dirname, 'preview/trader/ships.html'), planets: resolve(__dirname, 'preview/trader/planets.html') } },
  },
});
