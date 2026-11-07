import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Swamp Hen’s Reed Rows preview (preview/swamphen: the whole game on a pretend server in the browser) into
// dist-preview-swamphen/. Run it: npx vite --config vite.swamphen-preview.config.ts
// With SWAMPHEN_INLINE=1 everything goes inside the script, so `npm run swamphen:preview` can make one HTML file.
export default defineConfig({
  root: 'preview/swamphen',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-swamphen', emptyOutDir: true, assetsInlineLimit: process.env.SWAMPHEN_INLINE ? 100_000_000 : 4096,
    ...(process.env.SWAMPHEN_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
