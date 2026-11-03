/**
 * The Star Trader preview (stage T.2): the whole game screen with no sign-in. It never talks to the school's server:
 * the rules are the shared ones, and maths questions are made and marked here in the browser for a pretend pupil.
 * Nothing is saved. Preview tools (not in the real game) are in the corner: pretend credits, pretend tomorrow,
 * another ship, a pirate fight, starting as a brand-new pupil (Bolt forgets too), and 30 jumps made (Bolt's help drops to Some).
 * Run it: npx vite --config vite.trader-preview.config.ts
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { traderApi } from '../../src/data/trader';
import { TraderGame } from '../../src/games/trader/TraderGame';
import { trialBackend } from '../../src/games/trader/trialBackend';
import { PRETEND_CLASSMATES } from '../../src/games/trader/trialClassmates';
import { drawGalleryPicture } from '../../src/games/trader/forge/galleryPicture';
import { ProjectorTour } from '../../src/games/trader/forge/ProjectorTour';
import '../../src/styles.css';
import './preview.css';

const params = new URLSearchParams(location.search);
const trial = trialBackend({ seed: params.get('seed') ?? 'preview-season' });
const api = traderApi(trial.transport);

/** Pretend classmates join the gallery, each (but the last) with a picture drawn here as the real game would. */
async function classmates(reload: () => void) {
  trial.tools.classmates();
  reload();
  for (const c of PRETEND_CLASSMATES.slice(0, -1)) {
    const webp = await drawGalleryPicture(c.design, 'normal');
    if (webp) trial.tools.classmatePicture(c.id, `data:image/webp;base64,${webp}`);
  }
  reload();
}

/** The teacher's projector tour, with the pupil's system and the pretend classmates' (the real one reads the class's). */
function TourButton() {
  const [on, setOn] = useState(params.has('tour'));
  const systems = async () => [...(trial.data.game?.game.system?.sun?.built ? [trial.data.game.game.system] : []), ...PRETEND_CLASSMATES.map((c) => c.design)];
  return (
    <>
      <button type="button" onClick={() => setOn(true)}>Teacher&apos;s projector tour</button>
      {on && <ProjectorTour classId="preview" load={systems} onClose={() => setOn(false)} />}
    </>
  );
}

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
          <button type="button" onClick={() => { trial.tools.setSystem({ ...PRETEND_CLASSMATES[2].design, label: 'Aurora' }); h.reload(); }} title="Your system, as if built">Pretend I built a system</button>
          <button type="button" onClick={() => void classmates(h.reload)} title="Six classmates with systems join the Gallery; some give you stickers">Pretend classmates (Gallery)</button>
          <TourButton />
          <button type="button" onClick={() => { trial.tools.endSeason(); h.reload(); }} title="Needs a built sun in the Forge: shows the New Season choice">End the season (Forge)</button>
          <button type="button" onClick={() => { trial.tools.restart(); h.reload(); }}>Start again</button>
          <button type="button" onClick={() => { localStorage.removeItem('sgh-trader-coach'); location.reload(); }} title="A new game, and Bolt forgets everything: First Flight, tips and help level">Start as a new pupil</button>
          <button
            type="button"
            title="Bolt moves from Lots of help to Some after 30 jumps"
            onClick={() => { if (trial.data.game) trial.data.game.game.stats.jumps = Math.max(trial.data.game.game.stats.jumps, 30); h.reload(); }}
          >Pretend 30 jumps made</button>
        </details>
      )}
    />
  </StrictMode>,
);
