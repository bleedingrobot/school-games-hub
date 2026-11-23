import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The finish screen's achievement pop reaches the hub's game list (the Achievement Hall's rules use it for game names), and
 * through it every game and all their paintings. The preview only needs Circuit Racer's name, so it gets a stand-in list:
 * the demo stays small (and builds on Windows, where Glyph's Art.ts and art.ts can't live together).
 */
function gameListStandIn(): Plugin {
  const id = '\0circuit-preview-games';
  return {
    name: 'circuit-preview-games',
    enforce: 'pre',
    resolveId(source) {
      return /(^|\/)games\/registry$/.test(source) ? id : null;
    },
    load(name) {
      return name === id
        ? "export const findGame = () => undefined; export const gameLabel = (id) => (id === 'circuit' ? 'Circuit Racer' : id);"
        : null;
    },
  };
}

// Builds the Circuit Racer preview (preview/circuit: the whole game on the real server handler with a pretend database, in
// the browser) into dist-preview-circuit/. Run it: npx vite --config vite.circuit-preview.config.ts
export default defineConfig({
  root: 'preview/circuit',
  base: './',
  plugins: [gameListStandIn(), react()],
  build: { outDir: '../../dist-preview-circuit', emptyOutDir: true },
});
