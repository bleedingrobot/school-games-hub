import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Archery Challenge preview (preview/archery: pick a world and a bot, then fight) into dist-preview-archery/.
// With ARCHERY_INLINE=1 everything goes inside the script, so it can be made into one HTML file:
// ARCHERY_INLINE=1 npx vite build --config vite.archery-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-archery archery-test-page.html
export default defineConfig({
  root: 'preview/archery',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-archery', emptyOutDir: true, assetsInlineLimit: process.env.ARCHERY_INLINE ? 100_000_000 : 4096,
    // One file can't load parts of itself later, so the inline build keeps every part in the one script.
    ...(process.env.ARCHERY_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
