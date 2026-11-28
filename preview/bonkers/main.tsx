/**
 * The Smash Quest preview: the whole game with no sign-in. It never talks to the school's server: the rules are the
 * shared ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a reload carries on.
 * Preview tools (not in the real game): fill the star bar, go up a level, adventures unlimited or one a day, start again.
 * Run it: npx vite --config vite.bonkers-preview.config.ts
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BonkersGame } from '../../src/games/bonkers/BonkersGame';
import { trialBackend } from '../../src/games/bonkers/trial';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'bonkers-preview' });

function Tools({ reload }: { reload: () => void }) {
  const [unlimited, setUnlimited] = useState(true);
  return (
    <details className="bqp-tools">
      <summary>Preview tools</summary>
      <p>Only in this preview. Nothing is saved to the school. The questions are times tables here; at school they come from each pupil’s own focus.</p>
      <button type="button" onClick={() => { trial.tools.fillBar(); reload(); }}>Fill the star bar (meet the trainer)</button>
      <button type="button" onClick={() => { trial.tools.levelUp(); reload(); }}>Up a level</button>
      <button type="button" onClick={() => { trial.tools.stickers(); reload(); }}>+50 stickers</button>
      <button type="button" onClick={() => { trial.tools.setUnlimited(!unlimited); setUnlimited(!unlimited); reload(); }}>
        {unlimited ? 'Adventures: unlimited (tap for 1 a day)' : 'Adventures: 1 a day (tap for unlimited)'}
      </button>
      <button type="button" onClick={() => { trial.tools.reset(); reload(); }}>Start again as a new pupil</button>
    </details>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <BonkersGame backend={trial.backend} extra={(h) => <Tools reload={h.reload} />} />
    </SoundProvider>
  </StrictMode>,
);
