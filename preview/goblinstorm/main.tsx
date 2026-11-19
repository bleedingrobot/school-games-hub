/**
 * The Goblin Storm preview: the whole game with no sign-in. It never talks to the school's server: the stand-in
 * backend makes questions from a fixed pretend focus (the times tables) and replays each run in this page.
 * Run it: npx vite --config vite.goblinstorm-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoblinStormGame } from '../../src/games/goblinstorm/GoblinStormGame';
import { standInBackend } from '../../src/games/goblinstorm/backend';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';

const multipleChoice = new URLSearchParams(location.search).get('mc') === '1';
const backend = standInBackend(undefined, multipleChoice);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <GoblinStormGame
        backend={backend}
        extra={<p className="gs-menu__sub" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>Preview only: nothing is saved to the school. Pretend focus: times tables. Add ?mc=1 for pick-an-answer questions.</p>}
      />
    </SoundProvider>
  </StrictMode>,
);
