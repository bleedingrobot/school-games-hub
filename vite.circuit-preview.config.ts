import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The finish screen's achievement pop reaches the game list (for the Achievement Hall's names), and through it every game.
 * Windows can't hold Glyph's Art.ts and art.ts together, so a Windows build of this preview stands Glyph in with a name-only
 * game (the preview never shows it). On Linux and CI the real one builds as usual.
 */
function glyphStandIn(): Plugin {
  const id = '\0glyph-stand-in';
  return {
    name: 'glyph-stand-in',
    enforce: 'pre',
    resolveId(source, importer) {
      if (process.platform !== 'win32' || !importer?.replace(/\\/g, '/').endsWith('src/games/registry.ts')) return null;
      return source === './glyph' ? id : null;
    },
    load(name) {
      return name === id ? "export const glyph = { id: 'glyph', name: 'Glyph Gates', tagline: '', colours: ['#000', '#000'], Icon: () => null, Play: () => null, group: 'no-maths' };" : null;
    },
  };
}

// Builds the Circuit Racer preview (preview/circuit: the whole game on the real server handler with a pretend database, in
// the browser) into dist-preview-circuit/. Run it: npx vite --config vite.circuit-preview.config.ts
export default defineConfig({
  root: 'preview/circuit',
  base: './',
  plugins: [glyphStandIn(), react()],
  build: { outDir: '../../dist-preview-circuit', emptyOutDir: true },
});
