import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Pigeon’s Number Line preview (preview/pigeon: the whole game on a pretend server in the browser) into
// dist-preview-pigeon/. Run it: npx vite --config vite.pigeon-preview.config.ts
// With PIGEON_INLINE=1 everything goes inside the script, so `npm run pigeon:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/pigeon',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-pigeon', emptyOutDir: true, assetsInlineLimit: process.env.PIGEON_INLINE ? 100_000_000 : 4096,
    ...(process.env.PIGEON_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
