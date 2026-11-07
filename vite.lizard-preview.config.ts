import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Lizard’s Bundles preview (preview/lizard: the whole game on a pretend server in the browser) into
// dist-preview-lizard/. Run it: npx vite --config vite.lizard-preview.config.ts
// With LIZARD_INLINE=1 everything goes inside the script, so `npm run lizard:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/lizard',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-lizard', emptyOutDir: true, assetsInlineLimit: process.env.LIZARD_INLINE ? 100_000_000 : 4096,
    ...(process.env.LIZARD_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
