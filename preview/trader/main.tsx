/**
 * The Star Trader preview (stage T.2): the whole game screen with no sign-in. It never talks to the school's server:
 * the rules are the shared ones, and maths questions are made and marked here in the browser for a pretend pupil.
 * Nothing is saved. Preview tools (not in the real game) are in the corner: pretend credits, pretend tomorrow,
 * another ship, a pirate fight.
 * Run it: npx vite --config vite.trader-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { traderApi } from '../../src/data/trader';
import { TraderGame } from '../../src/games/trader/TraderGame';
import { trialBackend } from '../../src/games/trader/trialBackend';
import '../../src/styles.css';
import './preview.css';

const params = new URLSearchParams(location.search);
const trial = trialBackend({ seed: params.get('seed') ?? 'preview-season' });
const api = traderApi(trial.transport);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <TraderGame
      api={api}
      startAt={params.has('play') ? 'planet' : 'title'}
      extra={(h) => (
        <details className="trp-tools">
          <summary>Preview tools</summary>
          <button type="button" onClick={() => { trial.tools.give(1000); h.reload(); }}>+1,000 credits</button>
          <button type="button" onClick={() => { trial.tools.give(20000); h.reload(); }}>+20,000 credits</button>
          <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
          <button type="button" onClick={() => { trial.tools.busySchool(); h.reload(); }} title="30 pretend classmates trade all day on the school market; jump somewhere to see the moved prices">Busy lunchtime (30 classmates)</button>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => { trial.tools.setShip(i); h.reload(); }}>Ship {i + 1}</button>
          ))}
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" onClick={() => { trial.tools.forcePirates(i); h.reload(); }}>Pirates {i + 1}</button>
          ))}
          <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again</button>
        </details>
      )}
    />
  </StrictMode>,
);
