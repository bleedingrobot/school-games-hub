/**
 * A stand-alone copy of Gem Keep, for trying it without signing in (and for browser test
 * scripts, which get the engine as window.gemKeep), plus a maths practice tab for the
 * question box and number pad. Nothing is saved.
 * Build: npm run gem-keep:preview. Or run it: npx vite --config vite.gem-keep-preview.config.ts
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { spawnEnemy } from '../../shared/gem-keep/engine';
import { PROTOTYPE_LEVEL } from '../../shared/gem-keep/levels/prototype';
import { MuteButton } from '../../src/components/MuteButton';
import type { GameEngine } from '../../src/games/gem-keep/engine/GameEngine';
import { GemKeepGame } from '../../src/games/gem-keep/ui/GemKeepGame';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import '../space/preview.css';
import { MathsPractice } from './MathsPractice';
import './practice.css';

declare global {
  interface Window {
    gemKeep?: { engine: GameEngine; spawnEnemy: typeof spawnEnemy };
  }
}

const expose = (engine: GameEngine) => (window.gemKeep = { engine, spawnEnemy });

function Preview() {
  const [tab, setTab] = useState<'game' | 'maths'>('game');
  return (
    <SoundProvider>
      <header className="preview-bar">
        <span>
          <strong>Preview</strong> · not the live site, nothing is saved
        </span>
        <nav className="preview-tabs" aria-label="Preview">
          <button type="button" aria-pressed={tab === 'game'} onClick={() => setTab('game')}>
            Game
          </button>
          <button type="button" aria-pressed={tab === 'maths'} onClick={() => setTab('maths')}>
            Maths practice
          </button>
        </nav>
        <MuteButton />
      </header>
      <main id="main">{tab === 'game' ? <GemKeepGame level={PROTOTYPE_LEVEL} onEngine={expose} /> : <MathsPractice />}</main>
    </SoundProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
