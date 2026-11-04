import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Pipi's Hidden Shells preview (preview/pipi: the whole game on a pretend server in the browser) into
// dist-preview-pipi/. Run it: npx vite --config vite.pipi-preview.config.ts
// With PIPI_INLINE=1 everything goes inside the script, so `npm run pipi:single` can make one HTML file.
export default defineConfig({
  root: 'preview/pipi',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-pipi', emptyOutDir: true, assetsInlineLimit: process.env.PIPI_INLINE ? 100_000_000 : 4096,
    ...(process.env.PIPI_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
