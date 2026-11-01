/**
 * The Diamond Drop preview (Stage 2): the whole game with no sign-in. It never talks to the school's server: the rules
 * are the shared ones, run by the trial backend in this page, and the Hold on! questions come from a fixed pretend
 * focus (times tables). The pretend pupil is kept in this browser so a reload carries on. Preview tools (not in the real
 * game) are in the corner: pretend tomorrow, jump to a level, more coins, start again.
 * Run it: npx vite --config vite.diamond-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LAST_LEVEL } from '../../shared/diamond/config';
import { DiamondGame } from '../../src/games/diamond/DiamondGame';
import { trialBackend } from '../../src/games/diamond/trialBackend';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'diamond-preview-pupil' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <DiamondGame
      backend={trial.backend}
      extra={(h) => (
        <details className="ddp-tools">
          <summary>Preview tools</summary>
          <p>Only in this preview. Nothing is saved to the school.</p>
          <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
          <button type="button" onClick={() => { trial.tools.give(500); h.reload(); }}>+500 coins</button>
          <button type="button" onClick={() => { trial.tools.give(5000); h.reload(); }}>+5,000 coins</button>
          <p>Jump to level (everything above it passed):</p>
          {Array.from({ length: LAST_LEVEL }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => { trial.tools.jumpTo(n); h.reload(); }}>{n}</button>
          ))}
          <p>
            <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again as a new pupil</button>
          </p>
        </details>
      )}
    />
  </StrictMode>,
);
