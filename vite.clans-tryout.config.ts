import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The game asks for a big and a small copy of each portrait and wide painting. The try-out page has to fit in 16 MB with
 * every picture built in, so the big copy is sent to the small one: both names become the same file, built in once.
 */
const smallCopies = (): Plugin => ({
  name: 'clans-tryout-small-copies',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    const m = source.match(/^(.*\/art\/(members|scenes|quests|kingdoms)\/)([^/?]+)\.webp\?url$/);
    if (!m) return null;
    const [, dir, group, name] = m;
    const tail = group === 'members' ? '-small' : '-800';
    if (name.endsWith(tail)) return null;
    return this.resolve(`${dir}${name}${tail}.webp?url`, importer, { ...options, skipSelf: true });
  },
});

// Builds the Clans art try-out (Stage A.9): the whole game with a pretend clan, every picture built in, into dist-preview-clans-tryout/.
export default defineConfig({
  root: 'preview/clans',
  base: './',
  plugins: [smallCopies(), react()],
  build: { outDir: '../../dist-preview-clans-tryout', emptyOutDir: true, assetsInlineLimit: 100_000_000 },
});
