import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Marble Rush preview (preview/marble) into dist-preview-marble/.
export default defineConfig({
  root: 'preview/marble',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-marble', emptyOutDir: true },
});
