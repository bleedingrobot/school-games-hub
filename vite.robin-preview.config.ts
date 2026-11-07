import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Robin’s Berry Basket preview (preview/robin: the whole game on a pretend server in the browser) into
// dist-preview-robin/. Run it: npx vite --config vite.robin-preview.config.ts
// With ROBIN_INLINE=1 everything goes inside the script, so `npm run robin:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/robin',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-robin', emptyOutDir: true, assetsInlineLimit: process.env.ROBIN_INLINE ? 100_000_000 : 4096,
    ...(process.env.ROBIN_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
