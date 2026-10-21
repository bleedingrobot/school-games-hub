import { defineConfig } from 'vite';

// Builds the plain Archery Challenge engine test page (preview/archery) into dist-preview-archery/.
// With ARCHERY_INLINE=1 everything goes inside the script, so it can be made into one HTML file:
// ARCHERY_INLINE=1 npx vite build --config vite.archery-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-archery archery-test-page.html
export default defineConfig({
  root: 'preview/archery',
  base: './',
  build: { outDir: '../../dist-preview-archery', emptyOutDir: true, assetsInlineLimit: process.env.ARCHERY_INLINE ? 100_000_000 : 4096,
    ...(process.env.ARCHERY_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
