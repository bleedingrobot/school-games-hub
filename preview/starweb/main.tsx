/**
 * The Star Web preview: the whole game with no sign-in. The rules are the shared server rules, run by the trial backend in
 * this page, and the pretend pupil (who knows a handful of times-table facts) is kept in this browser.
 * Run it: npx vite --config vite.starweb-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SoundProvider } from '../../src/sound';
import { StarWebGame } from '../../src/games/starweb/StarWebGame';
import { trialBackend } from '../../src/games/starweb/trial';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'starweb-preview' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <StarWebGame
        backend={trial.backend}
        extra={(h) => (
          <details className="swp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.lightSome(); h.reload(); }}>Light some tables (opens Free sky)</button>
            <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again as a new pupil</button>
          </details>
        )}
      />
    </SoundProvider>
  </StrictMode>,
);
