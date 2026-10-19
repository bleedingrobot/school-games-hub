import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Marble Rush preview (preview/marble) into dist-preview-marble/.
// With MARBLE_INLINE=1 everything goes inside the script, so `npm run marble:single` can make one HTML file.
export default defineConfig({
  root: 'preview/marble',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-marble', emptyOutDir: true, assetsInlineLimit: process.env.MARBLE_INLINE ? 100_000_000 : 4096 },
});
