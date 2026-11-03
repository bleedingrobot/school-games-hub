import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Kiwi's Beanstalk preview (preview/beanstalk: the whole game on a pretend server in the browser) into
// dist-preview-beanstalk/. Run it: npx vite --config vite.beanstalk-preview.config.ts
export default defineConfig({
  root: 'preview/beanstalk',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-beanstalk', emptyOutDir: true },
});
