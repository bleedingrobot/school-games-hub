import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Builds the Diamond Drop preview (preview/diamond: the whole game on a pretend server in the browser) into dist-preview-diamond/.
// preview/diamond/art.html is every drawn picture on one sheet, for checking the code art.
// With DIAMOND_INLINE=1 everything goes inside the script, so it can be made into one HTML file:
// DIAMOND_INLINE=1 npx vite build --config vite.diamond-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-diamond diamond-drop-test-page.html
const inline = Boolean(process.env.DIAMOND_INLINE);
export default defineConfig({
  root: 'preview/diamond',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist-preview-diamond',
    emptyOutDir: true,
    assetsInlineLimit: inline ? 100_000_000 : 4096,
    rolldownOptions: inline
      ? { output: { codeSplitting: false } }
      : { input: { index: resolve(__dirname, 'preview/diamond/index.html'), art: resolve(__dirname, 'preview/diamond/art.html') } },
  },
});
