import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Maths Monsters preview (preview/monsters) into dist-preview-monsters/.
export default defineConfig({
  root: 'preview/monsters',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-monsters', emptyOutDir: true },
});
