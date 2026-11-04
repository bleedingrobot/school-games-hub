import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Weka’s Stepping Stones preview (preview/weka: the whole game on a pretend server in the browser) into
// dist-preview-weka/. Run it: npx vite --config vite.weka-preview.config.ts
// With WEKA_INLINE=1 everything goes inside the script, so `npm run weka:single` can make one HTML file.
export default defineConfig({
  root: 'preview/weka',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-weka', emptyOutDir: true, assetsInlineLimit: process.env.WEKA_INLINE ? 100_000_000 : 4096,
    ...(process.env.WEKA_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
