import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Kiwi's Beanstalk preview (preview/beanstalk: the whole game on a pretend server in the browser) into
// dist-preview-beanstalk/. Run it: npx vite --config vite.beanstalk-preview.config.ts
// With BEANSTALK_INLINE=1 everything goes inside the script, so `npm run beanstalk:single` can make one HTML file.
export default defineConfig({
  root: 'preview/beanstalk',
  publicDir: '../../public', // the recorded voice clips (public/voice/beanstalk)
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-beanstalk', emptyOutDir: true, assetsInlineLimit: process.env.BEANSTALK_INLINE ? 100_000_000 : 4096,
    // One file can't load parts of itself later, so the inline build keeps every part in the one script.
    ...(process.env.BEANSTALK_INLINE ? { rolldownOptions: { output: { codeSplitting: false } } } : {}),
  },
});
