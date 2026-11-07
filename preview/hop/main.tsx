/**
 * The Hop's Glow-worm Pond preview (Stage 2): the whole game with no sign-in. It never talks to the school's server: the
 * rules are the shared ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a
 * reload carries on. Preview tools (not in the real game): pretend tomorrow, jump to a day, count in 10s, 5s or 2s, start again.
 * Run it: npx vite --config vite.hop-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HopGame } from '../../src/games/hop/HopGame';
import { trialBackend } from '../../src/games/hop/backend';
import { penguinPairs } from '../../src/games/korora';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'hop-preview-pupil' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <HopGame
        backend={trial.backend}
        nextGame={{ name: 'Penguin Pairs', Icon: penguinPairs.Icon, open: () => window.alert('This opens Penguin Pairs in the real game.') }}
        extra={(h) => (
          <details className="hpp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
            <p>Jump to after this many finished days (10+ silver, 20+ gold):</p>
            {[0, 5, 9, 10, 15, 20, 25, 29].map((n) => (
              <button key={n} type="button" onClick={() => { trial.tools.jumpTo(n); h.reload(); }}>{n}</button>
            ))}
            <p>Count in:</p>
            {([10, 5, 2] as const).map((s) => (
              <button key={s} type="button" onClick={() => { trial.tools.setStep(s); h.reload(); }}>{s}s</button>
            ))}
            <p>Make every fact of this step secure:</p>
            {([10, 5, 2] as const).map((s) => (
              <button key={s} type="button" onClick={() => { trial.tools.makeSecure(s); h.reload(); }}>{s}s secure</button>
            ))}
            <p>
              <label>
                <input type="checkbox" defaultChecked={trial.tools.labelsOn()} onChange={(e) => { trial.tools.setLabels(e.target.checked); h.reload(); }} />{' '}
                The teacher lets the hops show their step (+2)
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
