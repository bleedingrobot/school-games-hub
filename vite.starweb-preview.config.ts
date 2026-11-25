import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the Star Web preview (preview/starweb: the whole game on a pretend server in the browser) into
// dist-preview-starweb/. Run it: npx vite --config vite.starweb-preview.config.ts
export default defineConfig({
  root: 'preview/starweb',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-preview-starweb', emptyOutDir: true },
});
