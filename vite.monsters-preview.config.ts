import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Maths Monsters preview (preview/monsters) into dist-preview-monsters/.
// With MONSTERS_INLINE=1 the pictures are put inside the script too, so `npm run monsters:single`
// can wrap the whole page into one HTML file (for sharing as one file).
export default defineConfig({
  root: 'preview/monsters',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-monsters', emptyOutDir: true, assetsInlineLimit: process.env.MONSTERS_INLINE ? 100_000_000 : 4096 },
});
