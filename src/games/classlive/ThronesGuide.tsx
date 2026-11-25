/**
 * Musical Thrones: the power-ups and hazards page, like Four Corners' guide. Opened from the big screen's lobby and from
 * a pupil's lobby screen. Pictures are the painted ones (drawn emoji until a painting is there).
 */
import { createPortal } from 'react-dom';
import { CROWNS, HALL_WORDS, POWERS, POWER_WORDS, UNLOCK, type Hall } from '../../../shared/classlive/thrones';
import { throneHazardPic, thronePowerPic } from './ThronesBoard';
import { painted } from './paintedArt';
import './thrones.css';

type Hazard = 'storm' | 'teleport' | 'ice' | 'roller';
const HAZARDS: { key: Hazard; emoji: string; how: string }[] = [
  { key: 'storm', emoji: '🌪️', how: 'Slows you right down while you are in it.' },
  { key: 'teleport', emoji: '🌀', how: 'Comes in pairs: step in one and pop out of the other.' },
  { key: 'ice', emoji: '🧊', how: 'Slippery! You slide and can’t stop quickly.' },
  { key: 'roller', emoji: '🪨', how: 'Rolls across the hall. Get hit and you go flying!' },
];

function Pic({ src, emoji }: { src: string | null; emoji: string }) {
  return src ? <img className="fc-guide__pic" src={src} alt="" /> : <span className="fc-guide__pic fc-guide__pic--emoji" aria-hidden="true">{emoji}</span>;
}

export function ThronesGuide({ hall, onClose }: { hall: Hall; onClose: () => void }) {
  const w = HALL_WORDS[hall];
  // On document.body, so a card with a transform can't trap the fixed overlay.
  return createPortal(
    <div className="fc-guide mt-guide" role="dialog" aria-modal="true" aria-label="Power-ups and hazards">
      <div className="fc-guide__card">
        <header className="fc-guide__head">
          <h2>Power-ups and hazards</h2>
          <button type="button" className="cl-btn cl-btn--small" onClick={onClose}>Close ✕</button>
        </header>
        <h3 className="fc-guide__title">👑 Crowns</h3>
        <ul className="mt-rules">
          <li>🪑 A throne: {CROWNS.throne} crown</li>
          <li>🌟 A golden throne: {CROWNS.golden} crowns</li>
          <li>💃 On a glowing dance tile when the music stops: +{CROWNS.dance}</li>
          <li>🗡️ Stealing a throne: take 1 crown</li>
        </ul>
        <p className="fc-guide__note">Dance while the music plays. When it stops (nobody knows when!) run and sit on a throne. There are fewer thrones every round, and anyone left standing goes to the {w.court.toLowerCase()} until they answer 3 questions right.</p>
        <h3 className="fc-guide__title">⚡ Power-ups <small>from round {UNLOCK.items}</small></h3>
        <p className="fc-guide__note">Run over one to pick it up (you can carry one). Press “Switch on” and answer a question right while the music plays.</p>
        <ul className="fc-guide__grid">
          {POWERS.map((p) => (
            <li key={p}>
              <Pic src={thronePowerPic(p)} emoji={POWER_WORDS[p].emoji} />
              <b>{POWER_WORDS[p].name}</b>
              <span>{POWER_WORDS[p].how}</span>
            </li>
          ))}
        </ul>
        <h3 className="fc-guide__title">⚠️ Hazards in the {w.name}</h3>
        <p className="fc-guide__note">A new one joins in each round, so the game gets wilder as it goes.</p>
        <ul className="fc-guide__grid">
          {HAZARDS.map((h) => (
            <li key={h.key}>
              <Pic src={throneHazardPic(hall, h.key)} emoji={h.emoji} />
              <b>{w[h.key]} <small>round {UNLOCK[h.key]}</small></b>
              <span>{h.how}</span>
            </li>
          ))}
          <li>
            <Pic src={painted('thrones-fx', 'tile')} emoji="💃" />
            <b>Dance tiles</b>
            <span>Be standing on a glowing tile when the music stops for a bonus crown.</span>
          </li>
          <li>
            <Pic src={null} emoji="🔒" />
            <b>{w.court}</b>
            <span>No throne? You sit out a round. Answer 3 right to come back; 3 right in a row wins a Crown thief scroll!</span>
          </li>
        </ul>
      </div>
    </div>,
    document.body,
  );
}
