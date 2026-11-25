/**
 * Four Corners: the power-ups and hazards page (James, 25 Nov 2026 NZ: "a page that explains the hazards and power ups
 * with pictures"). Opened from the big screen's lobby and from a pupil's lobby screen. Pictures are the painted ones
 * (drawn emoji until a painting is there); hazards show the chosen map's names, with tabs for the other maps.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MAPS, MAP_WORDS, POWERS, POWER_WORDS, UNLOCK, type CornerMap } from '../../../shared/classlive/corners';
import { hazardPic, powerPic } from './CornersBoard';

type Hazard = 'storm' | 'ice' | 'hole' | 'roller' | 'teleport';
const HAZARDS: { key: Hazard; emoji: string; how: string }[] = [
  { key: 'storm', emoji: '🌨️', how: 'Slows you right down while you are in it.' },
  { key: 'teleport', emoji: '🌀', how: 'Comes in pairs: step in one and pop out of the other.' },
  { key: 'ice', emoji: '🧊', how: 'Slippery! You slide and can’t stop quickly.' },
  { key: 'roller', emoji: '🪨', how: 'Two roll through the corners, one across and one up and down. Get hit and you go flying! Jump back in quickly.' },
  { key: 'hole', emoji: '🕳️', how: 'Opens in the middle: you can’t cross it, so go round.' },
];
/** Drawn in code, no picture. */
const OTHERS: { key: 'fog' | 'gate'; emoji: string; how: string }[] = [
  { key: 'fog', emoji: '🌫️', how: 'The big screen can’t see anyone near the end of the run. Watch your own iPad!' },
  { key: 'gate', emoji: '🚪', how: 'One corner shuts 3 seconds before the end. Don’t leave it too late!' },
];

function Pic({ src, emoji }: { src: string | null; emoji: string }) {
  return src ? <img className="fc-guide__pic" src={src} alt="" /> : <span className="fc-guide__pic fc-guide__pic--emoji" aria-hidden="true">{emoji}</span>;
}

export function CornersGuide({ map, onClose }: { map: CornerMap; onClose: () => void }) {
  const [shown, setShown] = useState<CornerMap>(map);
  const w = MAP_WORDS[shown];
  // On document.body, so a card with a transform (the setup card) can't trap the fixed overlay.
  return createPortal(
    <div className="fc-guide" role="dialog" aria-modal="true" aria-label="Power-ups and hazards">
      <div className="fc-guide__card">
        <header className="fc-guide__head">
          <h2>Power-ups and hazards</h2>
          <button type="button" className="cl-btn cl-btn--small" onClick={onClose}>Close ✕</button>
        </header>
        <h3 className="fc-guide__title">⚡ Power-ups <small>from round {UNLOCK.items}</small></h3>
        <p className="fc-guide__note">Run over one to pick it up (you can carry one). Get to a corner and answer a question right to switch it on.</p>
        <ul className="fc-guide__grid">
          {POWERS.map((p) => (
            <li key={p}>
              <Pic src={powerPic(p)} emoji={POWER_WORDS[p].emoji} />
              <b>{POWER_WORDS[p].name}</b>
              <span>{POWER_WORDS[p].how}</span>
            </li>
          ))}
        </ul>
        <h3 className="fc-guide__title">⚠️ Hazards</h3>
        <div className="cl-chips fc-guide__maps" role="group" aria-label="Map">
          {MAPS.map((m) => (
            <button key={m} type="button" className={`cl-choice ${shown === m ? 'cl-choice--on' : ''}`} aria-pressed={shown === m} onClick={() => setShown(m)}>{MAP_WORDS[m].name}</button>
          ))}
        </div>
        <p className="fc-guide__note">A new one joins in each round, so the game gets wilder as it goes.</p>
        <ul className="fc-guide__grid">
          {HAZARDS.map((h) => (
            <li key={h.key}>
              <Pic src={hazardPic(shown, h.key)} emoji={h.emoji} />
              <b>{w[h.key]} <small>round {UNLOCK[h.key]}</small></b>
              <span>{h.how}</span>
            </li>
          ))}
          {OTHERS.map((h) => (
            <li key={h.key}>
              <Pic src={null} emoji={h.emoji} />
              <b>{w[h.key]} <small>round {UNLOCK[h.key]}</small></b>
              <span>{h.how}</span>
            </li>
          ))}
          <li>
            <Pic src={null} emoji="🔁" />
            <b>Second half <small>halfway</small></b>
            <span>Change corners every round: if you stay in the corner you were safe in last time, you’re caught.</span>
          </li>
          <li>
            <Pic src={null} emoji="🎲" />
            <b>Twist rolls <small>round {UNLOCK.twist}</small></b>
            <span>The dice might pick two corners, or land on a lucky star so nobody is caught.</span>
          </li>
        </ul>
      </div>
    </div>,
    document.body,
  );
}
