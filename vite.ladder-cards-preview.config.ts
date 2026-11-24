import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The ladder question gallery (preview/ladder-cards), for the Year 7-8 plan's card pages.
export default defineConfig({
  root: 'preview/ladder-cards',
  base: './',
  plugins: [react()],
  server: { port: 5191, fs: { allow: ['../..'] } },
});
