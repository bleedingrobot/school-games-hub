/**
 * The Robin’s Berry Basket preview: the whole game with no sign-in. It never talks to the school's server: the rules are the
 * shared ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a reload carries
 * on. Preview tools (not in the real game): pretend tomorrow, jump to a day, pick a step and help level, the teacher's
 * help setting, start again. Run it: npx vite --config vite.robin-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RobinGame } from '../../src/games/robin/RobinGame';
import { trialBackend } from '../../src/games/robin/backend';
import { SoundProvider } from '../../src/sound';
import { HELP_SETTINGS } from '../../shared/kit/help';
import { STEPS, type HelpLevel, type Step } from '../../shared/robin/config';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'robin-preview' });
const HELP_WORDS = { fade: 'Lots, then fewer (fades with the child’s challenges)', always: 'Some (always level 4, numbered slots)', off: 'Off (plain basket, no marks)' };
const LEVELS: HelpLevel[] = [5, 4, 3, 2, 1, 0];

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <RobinGame
        backend={trial.backend}
        extra={(h) => (
          <details className="krp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
            <p>Jump to after this many finished days (10+ silver, 20+ gold):</p>
            {[0, 10, 20, 29].map((n) => (
              <button key={n} type="button" onClick={() => { trial.tools.jumpTo(n); h.reload(); }}>{n}</button>
            ))}
            <p>Step:</p>
            {STEPS.map((s) => (
              <button key={s.step} type="button" title={s.name} onClick={() => { trial.tools.setPlace(s.step as Step, trial.tools.place().level); h.reload(); }}>{s.step}</button>
            ))}
            <p>Help level (5 numbered slots and counting, 0 free pile):</p>
            {LEVELS.map((l) => (
              <button key={l} type="button" onClick={() => { trial.tools.setPlace(trial.tools.place().step, l); h.reload(); }}>{l}</button>
            ))}
            <p>The teacher's help setting:</p>
            {HELP_SETTINGS.map((s) => (
              <label key={s} style={{ display: 'block' }}>
                <input type="radio" name="help" defaultChecked={trial.tools.help() === s} onChange={() => { trial.tools.setHelp(s); h.reload(); }} /> {HELP_WORDS[s]}
              </label>
            ))}
            <p>
              <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again as a new pupil</button>
            </p>
          </details>
        )}
      />
    </SoundProvider>
  </StrictMode>,
);
