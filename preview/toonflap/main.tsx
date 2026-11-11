/**
 * The Toon Flap preview: the whole game with no sign-in. It never talks to the school's server: the rules are the shared
 * ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a reload carries on.
 * Preview tools (not in the real game): open every level, unlock every flyer and trail, maths on or off, start again.
 * Run it: npx vite --config vite.toonflap-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToonFlapGame } from '../../src/games/toonflap/ToonFlapGame';
import { trialBackend } from '../../src/games/toonflap/backend';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'toonflap-preview' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <ToonFlapGame
        backend={trial.backend}
        extra={(h) => (
          <details className="tfp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.openAll(); h.reload(); }}>Open every level</button>
            <button type="button" onClick={() => { trial.tools.unlockAll(); h.reload(); }}>Unlock every flyer and trail</button>
            <p>Maths is {trial.tools.maths() ? 'on' : 'off'}:</p>
            <button type="button" onClick={() => { trial.tools.setMaths(true); h.reload(); }}>Maths on</button>
            <button type="button" onClick={() => { trial.tools.setMaths(false); h.reload(); }}>Maths off</button>
            <p>
              <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again as a new pupil</button>
            </p>
          </details>
        )}
      />
    </SoundProvider>
  </StrictMode>,
);
