import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Order Up! preview (preview/orderup: the whole activity on a pretend server in the browser) into
// dist-preview-orderup/. Run it: npx vite --config vite.weka-preview.config.ts
// With ORDERUP_INLINE=1 everything goes inside the script, so `npm run orderup:single` can make one HTML file.
export default defineConfig({
  root: 'preview/orderup',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-orderup', emptyOutDir: true, assetsInlineLimit: process.env.ORDERUP_INLINE ? 100_000_000 : 4096,
    ...(process.env.ORDERUP_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
