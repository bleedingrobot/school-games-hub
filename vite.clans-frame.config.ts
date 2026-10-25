import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const REAL_SPRITE = resolve(__dirname, 'src/games/clans/Sprite.tsx');
const TRY_SPRITE = resolve(__dirname, 'preview/clans-frame/Sprite.tsx');

/** The game's screens import ./Sprite; in the try-out they get the painted stand-in instead (which itself still uses the real one). */
const paintedSprites = (): Plugin => ({
  name: 'clans-frame-sprites',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || importer === TRY_SPRITE || !/\/Sprite$/.test(source)) return null;
    const hit = await this.resolve(source, importer, { ...options, skipSelf: true });
    return hit?.id === REAL_SPRITE ? TRY_SPRITE : null;
  },
});

// Builds the Clans art frame try-out (preview/clans-frame, Stage A.2) into dist-preview-clans-frame/.
export default defineConfig({
  root: 'preview/clans-frame',
  base: './',
  plugins: [paintedSprites(), react()],
  build: { outDir: '../../dist-preview-clans-frame', emptyOutDir: true, assetsInlineLimit: 100_000_000 },
});
