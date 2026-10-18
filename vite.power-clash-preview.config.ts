import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the stand-alone power-clash preview (preview/power-clash) into dist-preview-power-clash/.
// The classmates part of the preview uses a STAND-IN server (preview/power-clash/standIn.ts): the
// pages ask for src/data/powerGames and src/data/multiplayer as usual, and this swaps in the stand-ins.
function standIn(): Plugin {
  const swaps: Record<string, string> = {
    [path.resolve('src/data/powerGames.ts')]: path.resolve('preview/power-clash/fakePowerGames.ts'),
    [path.resolve('src/data/multiplayer.ts')]: path.resolve('preview/power-clash/fakeMultiplayer.ts'),
  };
  return {
    name: 'power-clash-stand-in',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      // The stand-in files themselves use the real modules (they re-export them), so leave their imports alone.
      const own = path.resolve('preview/power-clash') + path.sep;
      if (!importer || !source.startsWith('.') || (importer.startsWith(own) && /(fake|standIn)/.test(importer))) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && swaps[resolved.id] ? swaps[resolved.id] : null;
    },
  };
}

export default defineConfig({
  root: 'preview/power-clash',
  base: './',
  plugins: [standIn(), react()],
  build: { outDir: '../../dist-preview-power-clash', emptyOutDir: true },
});
