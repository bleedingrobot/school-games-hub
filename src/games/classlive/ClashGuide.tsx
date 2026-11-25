/**
 * Colour Clash: the power-ups and hazards page (as Four Corners' CornersGuide, whose fc-guide look it reuses). Opened from
 * the big screen's lobby, the teacher's card and a pupil's lobby screen.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CLASH_MAPS, GOLDEN_WORTH, MAP_WORDS, POWERS, POWER_WORDS, UNLOCK, type ClashMap } from '../../../shared/classlive/clash';
import { clashPowerPic } from './ClashBoard';
import { painted } from './paintedArt';
import './corners.css';

type Hazard = 'goo' | 'slip' | 'roller' | 'fountain' | 'portal';
const HAZARDS: { key: Hazard; emoji: string; how: string }[] = [
  { key: 'portal', emoji: '🌀', how: 'Comes in pairs: step in one and pop out of the other.' },
  { key: 'goo', emoji: '🟤', how: 'Slows you right down while you are in it.' },
  { key: 'slip', emoji: '🧊', how: 'Slippery! You slide and can’t stop quickly.' },
  { key: 'roller', emoji: '🛞', how: 'Two roll across the board. Get hit and you go flying!' },
  { key: 'fountain', emoji: '⛲', how: 'Sits in the middle: you can’t cross it or paint it, so go round.' },
];

function Pic({ src, emoji }: { src: string | null; emoji: string }) {
  return src ? <img className="fc-guide__pic" src={src} alt="" /> : <span className="fc-guide__pic fc-guide__pic--emoji" aria-hidden="true">{emoji}</span>;
}

const hazardSrc = (map: ClashMap, h: Hazard) => (h === 'portal' ? painted('clash-fx', 'portal') : painted('clash-fx', `${h}-${map}`));

export function ClashGuide({ map, onClose }: { map: ClashMap; onClose: () => void }) {
  const [shown, setShown] = useState<ClashMap>(map);
  const w = MAP_WORDS[shown];
  return createPortal(
    <div className="fc-guide" role="dialog" aria-modal="true" aria-label="Power-ups and hazards">
      <div className="fc-guide__card">
        <header className="fc-guide__head">
          <h2>Power-ups and hazards</h2>
          <button type="button" className="cl-btn cl-btn--small" onClick={onClose}>Close ✕</button>
        </header>
        <h3 className="fc-guide__title">💣 Paint bombs</h3>
        <p className="fc-guide__note">Tap 💣 and answer a question. Right: a splat of your colour round where you stand (you stand still while you answer). Get 3 in a row for a bigger splat, 5 for a huge one.</p>
        <h3 className="fc-guide__title">⚡ Power-ups <small>from round {UNLOCK.items}</small></h3>
        <p className="fc-guide__note">Run over one to pick it up (you can carry one). Your next right answer switches it on, with the bomb.</p>
        <ul className="fc-guide__grid">
          {POWERS.map((p) => (
            <li key={p}>
              <Pic src={clashPowerPic(p)} emoji={POWER_WORDS[p].emoji} />
              <b>{POWER_WORDS[p].name}</b>
              <span>{POWER_WORDS[p].how}</span>
            </li>
          ))}
        </ul>
        <h3 className="fc-guide__title">⚠️ On the map</h3>
        <div className="cl-chips fc-guide__maps" role="group" aria-label="Map">
          {CLASH_MAPS.map((m) => (
            <button key={m} type="button" className={`cl-choice ${shown === m ? 'cl-choice--on' : ''}`} aria-pressed={shown === m} onClick={() => setShown(m)}>{MAP_WORDS[m].name}</button>
          ))}
        </div>
        <p className="fc-guide__note">A new one joins in each round, so the game gets wilder as it goes.</p>
        <ul className="fc-guide__grid">
          <li>
            <Pic src={painted('clash-fx', 'golden')} emoji="✨" />
            <b>Golden tiles <small>round {UNLOCK.golden}</small></b>
            <span>Each one counts {GOLDEN_WORTH} tiles for the team that paints it last.</span>
          </li>
          {HAZARDS.map((h) => (
            <li key={h.key}>
              <Pic src={hazardSrc(shown, h.key)} emoji={h.emoji} />
              <b>{w[h.key]} <small>round {UNLOCK[h.key]}</small></b>
              <span>{h.how}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
