import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Parrot’s See-saw preview (preview/parrot: the whole game on a pretend server in the browser) into
// dist-preview-parrot/. Run it: npx vite --config vite.parrot-preview.config.ts
// With PARROT_INLINE=1 everything goes inside the script, so `npm run parrot:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/parrot',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-parrot', emptyOutDir: true, assetsInlineLimit: process.env.PARROT_INLINE ? 100_000_000 : 4096,
    ...(process.env.PARROT_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
