/**
 * The Kiwi's Beanstalk preview (Stage 2): the whole game with no sign-in. It never talks to the school's server: the rules
 * are the shared ones, run by the trial backend in this page, and the pretend pupil is kept in this browser so a reload
 * carries on. Preview tools (not in the real game) are under it: pretend tomorrow, jump to a day, start again.
 * Run it: npx vite --config vite.beanstalk-preview.config.ts
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BeanstalkGame } from '../../src/games/beanstalk/BeanstalkGame';
import { trialBackend } from '../../src/games/beanstalk/backend';
import type { Signpost } from '../../src/games/beanstalk/signpost';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';
import './preview.css';

const trial = trialBackend({ storageKey: 'beanstalk-preview-pupil' });

/** The preview has no Weka and no maths records: two pretend switches stand in for them (the card's rules are the real ones). */
function Preview() {
  const [wekaOn, setWekaOn] = useState(true);
  const [secure, setSecure] = useState(true);
  const [opened, setOpened] = useState(false);
  const signpost: Signpost = { wekaOn, secure: async () => secure, open: () => setOpened(true) };
  return (
    <SoundProvider>
      {opened && <p role="status" className="bsp-opened">Weka's Stepping Stones would open here. <button type="button" onClick={() => setOpened(false)}>Close</button></p>}
      <BeanstalkGame
        backend={trial.backend}
        signpost={signpost}
        extra={(h) => (
          <details className="bsp-tools">
            <summary>Preview tools</summary>
            <p>Only in this preview. Nothing is saved to the school.</p>
            <button type="button" onClick={() => { trial.tools.nextDay(); h.reload(); }}>Pretend it is tomorrow</button>
            <p>Jump to after this many finished days:</p>
            {[0, 5, 9, 10, 15, 20, 25, 29, 30, 59, 60, 89, 90, 119, 120].map((n) => (
              <button key={n} type="button" onClick={() => { trial.tools.jumpTo(n); h.reload(); }}>{n}</button>
            ))}
            <p>This pupil's dots (they follow how the days go; two good days fade them, a hard day brings one back):</p>
            {([['Full', 0], ['Small', 1], ['None', 2]] as const).map(([name, level]) => (
              <button key={name} type="button" onClick={() => { trial.tools.setHelp(level); h.reload(); }}>{name}</button>
            ))}
            <p>
              <label>
                <input type="checkbox" defaultChecked={trial.tools.dotsOn()} onChange={(e) => { trial.tools.setDots(e.target.checked); h.reload(); }} />{' '}
                The teacher lets the leaves show dots
              </label>
            </p>
            <p>Finish screen's "what's next" card (shows from the bonds to 20 beanstalk, days 30 to 59, and later):</p>
            <p>
              <label><input type="checkbox" checked={wekaOn} onChange={(e) => setWekaOn(e.target.checked)} /> Weka is switched on for the class</label>
              <br />
              <label><input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} /> This pupil's pairs are secure</label>
            </p>
            <p>
              <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again as a new pupil</button>
            </p>
          </details>
        )}
      />
    </SoundProvider>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
