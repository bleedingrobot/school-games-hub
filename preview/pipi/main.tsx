/**
 * The Pipi's Hidden Shells preview (Stage 2): the whole game with no sign-in. It never talks to the school's server: the
 * rules are the shared ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a
 * reload carries on. Preview tools (not in the real game): pretend tomorrow, jump to a day, pick a level, help on or off,
 * start again. Run it: npx vite --config vite.pipi-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PipiGame } from '../../src/games/pipi/PipiGame';
import { trialBackend } from '../../src/games/pipi/backend';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'pipi-preview-pupil' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <PipiGame
        backend={trial.backend}
        extra={(h) => (
          <details className="ppp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
            <p>Jump to after this many finished days (10+ silver, 20+ gold):</p>
            {[0, 5, 9, 10, 15, 20, 25, 29].map((n) => (
              <button key={n} type="button" onClick={() => { trial.tools.jumpTo(n); h.reload(); }}>{n}</button>
            ))}
            <p>Pipi families:</p>
            {([[1, '3 to 5'], [2, '6 and 7'], [3, '8 to 10']] as const).map(([l, label]) => (
              <button key={l} type="button" onClick={() => { trial.tools.setLevel(l); h.reload(); }}>{label}</button>
            ))}
            <p>
              <label>
                <input type="checkbox" defaultChecked={trial.tools.helpOn()} onChange={(e) => { trial.tools.setHelp(e.target.checked); h.reload(); }} />{' '}
                The teacher lets the sand help (frame and outlines)
              </label>
            </p>
            <p>
              <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again as a new pupil</button>
            </p>
          </details>
        )}
      />
    </SoundProvider>
  </StrictMode>,
);
