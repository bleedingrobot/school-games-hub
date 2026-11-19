/**
 * The Goblin Storm preview: the whole game with no sign-in. It never talks to the school's server: the stand-in
 * backend makes questions from a fixed pretend focus (the times tables) and replays each run in this page.
 * Run it: npx vite --config vite.goblinstorm-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoblinStormGame } from '../../src/games/goblinstorm/GoblinStormGame';
import { HEROES, MAPS } from '../../shared/goblinstorm/config';
import { emptySave, standInBackend } from '../../src/games/goblinstorm/backend';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';

const params = new URLSearchParams(location.search);
const multipleChoice = params.get('mc') === '1';
// ?open=all: every hero and map open, to try them all (the pretend save is otherwise fresh and lives in this page).
const openAll = params.get('open') === 'all';
const start = openAll ? { ...emptySave(), heroes: HEROES.map((h) => h.id), bosses: MAPS.map((_, i) => i) } : emptySave();
const backend = standInBackend(undefined, multipleChoice, start);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <GoblinStormGame
        backend={backend}
        extra={<p className="gs-menu__sub" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>Preview only: nothing is saved to the school. Pretend focus: times tables. Add ?mc=1 for pick-an-answer questions, ?open=all to open every hero and map.</p>}
      />
    </SoundProvider>
  </StrictMode>,
);
