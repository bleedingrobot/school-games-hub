import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Smash Quest preview (preview/bonkers: the whole game on a pretend server in the browser) into
// dist-preview-bonkers/. Run it: npx vite --config vite.bonkers-preview.config.ts
// With BONKERS_INLINE=1 everything goes inside the script, so `npm run bonkers:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/bonkers',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-bonkers', emptyOutDir: true, assetsInlineLimit: process.env.BONKERS_INLINE ? 100_000_000 : 4096,
    ...(process.env.BONKERS_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
