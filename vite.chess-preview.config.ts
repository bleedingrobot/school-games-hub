import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone chess preview (preview/chess) into dist-preview-chess/. Nothing is saved: the page asks for
// src/data/botGames and src/games/chess/lookData as usual, and this swaps in stand-ins that pretend to save.
function standIn(): Plugin {
  const swaps: Record<string, string> = {
    [path.resolve('src/data/botGames.ts')]: path.resolve('preview/chess/fakeBotGames.ts'),
    [path.resolve('src/games/chess/lookData.ts')]: path.resolve('preview/chess/fakeLooks.ts'),
  };
  return {
    name: 'chess-stand-in',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !source.startsWith('.')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      // Windows gives the id with / but path.resolve with \, so compare them the same way.
      return (resolved && swaps[path.resolve(resolved.id)]) ?? null;
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
