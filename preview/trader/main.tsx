/**
 * The Star Trader preview (stage T.2): the whole game screen with no sign-in. It never talks to the school's server:
 * the rules are the shared ones, and maths questions are made and marked here in the browser for a pretend pupil.
 * Nothing is saved. Preview tools (not in the real game) are in the corner: pretend credits, pretend tomorrow,
 * another ship, a pirate fight.
 * Run it: npx vite --config vite.trader-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { trialApi } from '../../src/games/trader/api';
import { TraderGame } from '../../src/games/trader/TraderGame';
import '../../src/styles.css';
import './preview.css';

const params = new URLSearchParams(location.search);
const api = trialApi();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <TraderGame
      api={api}
      startAt={params.has('play') ? 'planet' : 'title'}
      galaxySeed={params.get('seed') ?? 'preview-season'}
      extra={(h) => (
        <details className="trp-tools">
          <summary>Preview tools</summary>
          <button type="button" onClick={() => h.give(1000)}>+1,000 credits</button>
          <button type="button" onClick={() => h.give(20000)}>+20,000 credits</button>
          <button type="button" onClick={h.nextDay}>Pretend it is tomorrow</button>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => h.setShip(i)}>Ship {i + 1}</button>
          ))}
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" onClick={() => h.forcePirates(i)}>Pirates {i + 1}</button>
          ))}
          <button type="button" onClick={h.restart}>Start again</button>
        </details>
      )}
    />
  </StrictMode>,
);
