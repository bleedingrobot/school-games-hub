import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Builds the stand-alone home page and themes preview (preview/home) into dist-preview-home/: the real site with
// src/lib/supabase swapped for a made-up one, so it never talks to the live server.
// With HOME_INLINE=1 everything goes inside the script, so `npm run home:single` can make one HTML file.
const fake = fileURLToPath(new URL('./preview/home/fakeSupabase.ts', import.meta.url));
const swapSupabase: Plugin = {
  name: 'home-preview-fake-supabase',
  enforce: 'pre',
  resolveId(source) {
    return /(^|\/)lib\/supabase$/.test(source) ? fake : null;
  },
};

export default defineConfig({
  root: 'preview/home',
  base: './',
  plugins: [swapSupabase, react()],
  build: {
    outDir: '../../dist-preview-home',
    emptyOutDir: true,
    assetsInlineLimit: process.env.HOME_INLINE ? 100_000_000 : 4096,
    ...(process.env.HOME_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
