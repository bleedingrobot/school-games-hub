/**
 * Shark Bay: the power-ups and hazards page (a copy of Four Corners' guide in sea words). Opened from the big screen's
 * lobby and setup card, and from a pupil's lobby screen. Pictures are the painted ones (drawn emoji until painted);
 * names follow the chosen bay, with tabs for the other bays.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { POWERS } from '../../../shared/classlive/corners';
import { BAYS, BAY_WORDS, SHARK, SHARK_POWER_WORDS, SHARK_UNLOCK, type BayMap } from '../../../shared/classlive/shark';
import { sharkHazardPic, sharkPowerPic } from './SharkBoard';

type Hazard = 'storm' | 'ice' | 'roller' | 'teleport';
const HAZARDS: { key: Hazard; emoji: string; how: string }[] = [
  { key: 'storm', emoji: '🌿', how: 'Slows you right down while you are in it.' },
  { key: 'teleport', emoji: '🌀', how: 'Comes in pairs: swim into one and pop out of the other.' },
  { key: 'ice', emoji: '💨', how: 'Slippery! You slide and can’t stop quickly.' },
  { key: 'roller', emoji: '🌊', how: 'Rolls across the bay. Get hit and you go flying! Swim back quickly.' },
];

function Pic({ src, emoji }: { src: string | null; emoji: string }) {
  return src ? <img className="fc-guide__pic" src={src} alt="" /> : <span className="fc-guide__pic fc-guide__pic--emoji" aria-hidden="true">{emoji}</span>;
}

export function SharkGuide({ bay, onClose }: { bay: BayMap; onClose: () => void }) {
  const [shown, setShown] = useState<BayMap>(bay);
  const w = BAY_WORDS[shown];
  // On document.body, so a card with a transform (the setup card) can't trap the fixed overlay.
  return createPortal(
    <div className="fc-guide" role="dialog" aria-modal="true" aria-label="Power-ups and hazards">
      <div className="fc-guide__card">
        <header className="fc-guide__head">
          <h2>Power-ups and hazards</h2>
          <button type="button" className="cl-btn cl-btn--small" onClick={onClose}>Close ✕</button>
        </header>
        <h3 className="fc-guide__title">🦈 How it works</h3>
        <ul className="fc-guide__grid">
          <li>
            <Pic src={null} emoji="🌀" />
            <b>Spinning quarters</b>
            <span>The bay has four coloured quarters: Red, Yellow, Green and Purple. From round 2 they slowly spin round, so keep checking where your colour is.</span>
          </li>
          <li>
            <Pic src={sharkHazardPic(shown, 'dock')} emoji="🪵" />
            <b>The {w.dock.toLowerCase()}</b>
            <span>Everyone starts on it. It is not a safe place: if you are still on it when {SHARK} strikes, you are caught!</span>
          </li>
          <li>
            <Pic src={sharkHazardPic(shown, 'boat')} emoji="⛵" />
            <b>{w.boat}s</b>
            <span>They drift round the bay and only have a few seats. Swim close to the middle of one to hide under it: you are safe, even on the {w.dock.toLowerCase()} or in the struck colour. Only the nearest pupils fit!</span>
          </li>
          <li>
            <Pic src={sharkHazardPic(shown, 'fin')} emoji="🦈" />
            <b>{SHARK} the shark</b>
            <span>A fin circles the bay. Then {SHARK} leaps out of one quarter with a big splash, or the water goes dark and a spotlight hops round before {SHARK} snaps. Anyone in that quarter goes to the {w.jail.toLowerCase()}.</span>
          </li>
        </ul>
        <h3 className="fc-guide__title">⚡ Power-ups <small>from round {SHARK_UNLOCK.items}</small></h3>
        <p className="fc-guide__note">Swim over one to pick it up (you can carry one). Answer a question right, in the water, to switch it on.</p>
        <ul className="fc-guide__grid">
          {POWERS.map((p) => (
            <li key={p}>
              <Pic src={sharkPowerPic(p)} emoji={SHARK_POWER_WORDS[p].emoji} />
              <b>{SHARK_POWER_WORDS[p].name}</b>
              <span>{SHARK_POWER_WORDS[p].how}</span>
            </li>
          ))}
        </ul>
        <h3 className="fc-guide__title">⚠️ Hazards</h3>
        <div className="cl-chips fc-guide__maps" role="group" aria-label="Bay">
          {BAYS.map((m) => (
            <button key={m} type="button" className={`cl-choice ${shown === m ? 'cl-choice--on' : ''}`} aria-pressed={shown === m} onClick={() => setShown(m)}>{BAY_WORDS[m].name}</button>
          ))}
        </div>
        <p className="fc-guide__note">A new one joins in each round, so the game gets wilder as it goes.</p>
        <ul className="fc-guide__grid">
          {HAZARDS.map((h) => (
            <li key={h.key}>
              <Pic src={sharkHazardPic(shown, h.key)} emoji={h.emoji} />
              <b>{w[h.key]} <small>round {SHARK_UNLOCK[h.key]}</small></b>
              <span>{h.how}</span>
            </li>
          ))}
          <li>
            <Pic src={null} emoji="🌫️" />
            <b>{w.fog} <small>round {SHARK_UNLOCK.fog}</small></b>
            <span>The big screen can’t see anyone near the end of the run. Watch your own iPad!</span>
          </li>
          <li>
            <Pic src={null} emoji="🦈" />
            <b>Twist strikes <small>round {SHARK_UNLOCK.twist}</small></b>
            <span>Two sharks might strike two quarters at once, or {SHARK} might be too full to bite so nobody is caught.</span>
          </li>
        </ul>
      </div>
    </div>,
    document.body,
  );
}
