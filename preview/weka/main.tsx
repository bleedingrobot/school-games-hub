/**
 * The Weka’s Stepping Stones preview: the whole game with no sign-in. It never talks to the school's server: the rules are the
 * shared ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a reload carries
 * on. Preview tools (not in the real game): pretend tomorrow, jump to a day, pick a level, the teacher's help setting,
 * start again. Run it: npx vite --config vite.weka-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WekaGame } from '../../src/games/weka/WekaGame';
import { trialBackend } from '../../src/games/weka/backend';
import { SoundProvider } from '../../src/sound';
import { HELP_SETTINGS } from '../../shared/weka/server';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'weka-preview-pupil' });
const HELP_WORDS = { fade: 'fades (bronze, silver, gold)', always: 'always full pictures', off: 'off: words and numbers only' };

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <WekaGame
        backend={trial.backend}
        extra={(h) => (
          <details className="krp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
            <p>Jump to after this many finished days (10+ silver, 20+ gold):</p>
            {[0, 5, 9, 10, 15, 20, 25, 29].map((n) => (
              <button key={n} type="button" onClick={() => { trial.tools.jumpTo(n); h.reload(); }}>{n}</button>
            ))}
            <p>Level:</p>
            {([1, 2, 3, 4] as const).map((l) => (
              <button key={l} type="button" onClick={() => { trial.tools.setLevel(l); h.reload(); }}>{l}</button>
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
