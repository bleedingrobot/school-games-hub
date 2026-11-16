import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// The stand-alone TEACHER preview (preview/teacher): the real site with src/lib/supabase swapped for a made-up one, so every
// teacher page shows made-up data and nothing is sent anywhere.
const fake = fileURLToPath(new URL('./preview/teacher/fakeSupabase.ts', import.meta.url));
const swapSupabase: Plugin = {
  name: 'teacher-preview-fake-supabase',
  enforce: 'pre',
  resolveId(source) {
    return /(^|\/)lib\/supabase$/.test(source) ? fake : null;
  },
};

// This copy of node_modules may lack the QR packages; set TEACHER_PREVIEW_DEPS to a folder that has them (its node_modules).
const extra = process.env.TEACHER_PREVIEW_DEPS;
const alias: Record<string, string> = {};
if (extra) {
  for (const pkg of ['jsqr', 'qrcode-generator']) {
    if (!existsSync(fileURLToPath(new URL(`./node_modules/${pkg}`, import.meta.url)))) alias[pkg] = `${extra}/node_modules/${pkg}`;
  }
}

export default defineConfig({
  resolve: { alias },
  root: 'preview/teacher',
  base: './',
  plugins: [swapSupabase, react()],
  server: { fs: { allow: ['../..'] } },
  build: { outDir: '../../dist-preview-teacher', emptyOutDir: true },
});
