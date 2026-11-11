import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Toon Flap preview (preview/toonflap: the whole game on a pretend server in the browser) into
// dist-preview-toonflap/. Run it: npx vite --config vite.toonflap-preview.config.ts
// With TOONFLAP_INLINE=1 everything goes inside the script, so `npm run toonflap:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/toonflap',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-toonflap', emptyOutDir: true, assetsInlineLimit: process.env.TOONFLAP_INLINE ? 100_000_000 : 4096,
    ...(process.env.TOONFLAP_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
