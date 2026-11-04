import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Penguin Pairs preview (preview/korora: the whole game on a pretend server in the browser) into
// dist-preview-korora/. Run it: npx vite --config vite.korora-preview.config.ts
// With KORORA_INLINE=1 everything goes inside the script, so `npm run korora:single` can make one HTML file.
export default defineConfig({
  root: 'preview/korora',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-korora', emptyOutDir: true, assetsInlineLimit: process.env.KORORA_INLINE ? 100_000_000 : 4096,
    ...(process.env.KORORA_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
