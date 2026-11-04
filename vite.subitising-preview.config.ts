import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone Quick looks preview (preview/subitising) into dist-preview-subitising/.
export default defineConfig({
  root: 'preview/subitising',
  publicDir: '../../public', // the recorded voice clips (public/voice/quick-looks)
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-subitising', emptyOutDir: true },
});
