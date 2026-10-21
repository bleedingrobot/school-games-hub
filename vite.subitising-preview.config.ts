import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Quick looks preview (preview/subitising) into dist-preview-subitising/.
export default defineConfig({
  root: 'preview/subitising',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-subitising', emptyOutDir: true },
});
