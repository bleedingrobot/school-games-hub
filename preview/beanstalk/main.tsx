/**
 * The Kiwi's Beanstalk preview (Stage 2): the whole game with no sign-in. It never talks to the school's server: the rules
 * are the shared ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a reload
 * carries on. Preview tools (not in the real game) are under it: pretend tomorrow, jump to a day, start again.
 * Run it: npx vite --config vite.beanstalk-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BeanstalkGame } from '../../src/games/beanstalk/BeanstalkGame';
import { trialBackend } from '../../src/games/beanstalk/backend';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'beanstalk-preview-pupil' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <BeanstalkGame
        backend={trial.backend}
        extra={(h) => (
          <details className="bsp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
            <p>Jump to after this many finished days:</p>
            {[0, 5, 9, 10, 15, 20, 25, 29, 59].map((n) => (
              <button key={n} type="button" onClick={() => { trial.tools.jumpTo(n); h.reload(); }}>{n}</button>
            ))}
            <p>
              <label>
                <input type="checkbox" defaultChecked={trial.tools.dotsOn()} onChange={(e) => { trial.tools.setDots(e.target.checked); h.reload(); }} />{' '}
                The teacher lets the leaves show dots
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
