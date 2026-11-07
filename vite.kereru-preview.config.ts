import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Kererū’s Number Line preview (preview/kereru: the whole game on a pretend server in the browser) into
// dist-preview-kereru/. Run it: npx vite --config vite.kereru-preview.config.ts
// With KERERU_INLINE=1 everything goes inside the script, so `npm run kereru:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/kereru',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-kereru', emptyOutDir: true, assetsInlineLimit: process.env.KERERU_INLINE ? 100_000_000 : 4096,
    ...(process.env.KERERU_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
