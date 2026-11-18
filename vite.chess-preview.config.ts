import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone chess preview (preview/chess) into dist-preview-chess/. Nothing is saved: the page asks for
// src/data/botGames as usual, and this swaps in a stand-in that pretends to save.
function standIn(): Plugin {
  const real = path.resolve('src/data/botGames.ts');
  return {
    name: 'chess-stand-in',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !source.startsWith('.')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved?.id === real ? path.resolve('preview/chess/fakeBotGames.ts') : null;
    },
  };
}

export default defineConfig({
  root: 'preview/chess',
  base: './',
  publicDir: path.resolve('public'),
  plugins: [standIn(), react()],
  build: { outDir: '../../dist-preview-chess', emptyOutDir: true },
});
