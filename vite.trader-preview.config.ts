import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Builds the Star Trader preview (preview/trader: the whole game on a pretend server in the browser) into dist-preview-trader/.
// preview/trader/art.html is a harness for the pictures alone.
export default defineConfig({
  root: 'preview/trader',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist-preview-trader',
    emptyOutDir: true,
    rolldownOptions: { input: { index: resolve(__dirname, 'preview/trader/index.html'), art: resolve(__dirname, 'preview/trader/art.html'), ships: resolve(__dirname, 'preview/trader/ships.html') } },
  },
});
