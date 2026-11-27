/**
 * Real-life Four Corners on the Class Live picker page and in the lobby (docs/JAIL-PLAN.md). Kept out of Projector.tsx
 * so other Class Live games built at the same time don't clash with it there.
 */
import { useState, type ComponentType } from 'react';
import { MAP_WORDS, MAPS, type CornerMap } from '../../../shared/classlive/corners';
import { DEFAULT_NEED, NEEDS, type Need } from '../../../shared/classlive/jail';
import { painted } from './paintedArt';
import './jail.css';

export const jailPic = () => painted('pick', 'jail', true) ?? painted('corners', 'jail-jungle', true) ?? painted('pick', 'corners', true);

export function JailCard({ busy, hostOk, onOpen, Timer, Art }: {
  busy: boolean;
  hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  Timer: ComponentType<{ length: number; setLength: (m: number) => void }>;
  Art: ComponentType<{ pic: string | null }>;
}) {
  const [map, setMap] = useState<CornerMap | 'any'>('any');
  const [need, setNeed] = useState<Need>(DEFAULT_NEED);
  const [length, setLength] = useState(0);
  return (
    <section className="cl-card cl-card--active" aria-label="Real-life Four Corners">
      <Art pic={jailPic()} />
      <h2 className="cl-card__name">🏫 Real-life Four Corners</h2>
      <p className="cl-card__blurb">Play Four Corners for real in the room. The big screen runs the countdown and the dice.</p>
      <ul className="jl-card-how">
        <li>Put a few iPads in the middle as jail stations. Pupils sign in and join as usual.</li>
        <li>Out? Tap your name on any station (no sign-in) and get the questions right.</li>
        <li>The big screen flashes their name: back in the game!</li>
      </ul>
      <div className="cl-opt">
        <span className="cl-opt__label">Right answers to get out</span>
        <div className="cl-chips" role="group" aria-label="Right answers to get out">
          {NEEDS.map((n) => (
            <button key={n} type="button" className={`cl-choice ${need === n ? 'cl-choice--on' : ''}`} aria-pressed={need === n} onClick={() => setNeed(n)}>{n}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Which map?</span>
        <div className="cl-chips" role="group" aria-label="Map">
          <button type="button" className={`cl-choice ${map === 'any' ? 'cl-choice--on' : ''}`} aria-pressed={map === 'any'} onClick={() => setMap('any')}>Surprise me</button>
          {MAPS.map((m) => (
            <button key={m} type="button" className={`cl-choice ${map === m ? 'cl-choice--on' : ''}`} aria-pressed={map === m} onClick={() => setMap(m)}>{MAP_WORDS[m].name}</button>
          ))}
        </div>
      </div>
      <Timer length={length} setLength={setLength} />
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length, need, ...(map === 'any' ? {} : { map }) })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function JailLobbyHead({ need }: { need: Need }) {
  return (
    <>
      <h1 className="cl-lobby__title">Real-life Four Corners</h1>
      <div className="cl-lobby__fact">{need} right answers to get out of jail</div>
      <div className="jl-lobby-icons" aria-hidden="true">{['🏃', '🎲', '📱', '🎉'].map((x, i) => <i key={i} style={{ animationDelay: `${i * 0.18}s` }}>{x}</i>)}</div>
      <p className="cl-lobby__ask">Join on an iPad, then put it in the jail. Everyone's name is on every jail station.</p>
    </>
  );
}
