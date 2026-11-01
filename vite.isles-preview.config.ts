import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Sky Isles preview (preview/isles) into dist-preview-isles/.
// With ISLES_INLINE=1 everything (pictures too) goes inside the script, so it can be made into one HTML file to publish:
// ISLES_INLINE=1 npm run isles:preview && node scripts/inline-monsters-preview.mjs dist-preview-isles sky-isles-test-page.html
const inline = Boolean(process.env.ISLES_INLINE);
export default defineConfig({
  root: 'preview/isles',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist-preview-isles',
    emptyOutDir: true,
    assetsInlineLimit: inline ? 100_000_000 : 4096,
    rolldownOptions: inline ? { output: { codeSplitting: false } } : {},
  },
});
