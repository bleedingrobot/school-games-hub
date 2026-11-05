import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Royal Decree preview (preview/decree) into dist-preview-decree/.
export default defineConfig({
  root: 'preview/decree',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-decree', emptyOutDir: true },
});
