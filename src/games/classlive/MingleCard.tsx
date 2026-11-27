/**
 * Maths Mingle on the Class Live picker page and in the lobby (docs/MINGLE-PLAN.md). Kept out of Projector.tsx so other
 * Class Live games built at the same time don't clash with it there.
 */
import { useState, type ComponentType } from 'react';
import { DEFAULT_NEED, NEEDS, type Need } from '../../../shared/classlive/jail';
import { MINGLE_LEVELS, type MingleLevel } from '../../../shared/classlive/mingle';
import { painted } from './paintedArt';
import './mingle.css';

export const minglePic = () => painted('pick', 'mingle', true) ?? painted('pick', 'thrones', true) ?? painted('thrones', 'back-castle', true);

const LEVEL_WORDS: Record<MingleLevel, string> = { junior: 'Junior (groups of 2 to 5)', senior: 'Senior (groups of 2 to 8)' };

export function MingleCard({ busy, hostOk, onOpen, Timer, Art }: {
  busy: boolean;
  hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  Timer: ComponentType<{ length: number; setLength: (m: number) => void }>;
  Art: ComponentType<{ pic: string | null }>;
}) {
  const [level, setLevel] = useState<MingleLevel>('senior');
  const [need, setNeed] = useState<Need>(DEFAULT_NEED);
  const [twists, setTwists] = useState(true);
  const [length, setLength] = useState(0);
  return (
    <section className="cl-card cl-card--active" aria-label="Maths Mingle">
      <Art pic={minglePic()} />
      <h2 className="cl-card__name">🕺 Maths Mingle</h2>
      <p className="cl-card__blurb">Music plays and everyone mingles. When it stops, the screen calls "Get into groups of 24 ÷ 6!"</p>
      <ul className="mg-card-how">
        <li>Clear some space. Put a few iPads to one side as stations. Pupils sign in and join as usual.</li>
        <li>The sums start easy and get harder each round.</li>
        <li>Left over? Tap your name on a station and get the questions right to get back in.</li>
      </ul>
      <div className="cl-opt">
        <span className="cl-opt__label">Group calls</span>
        <div className="cl-chips" role="group" aria-label="Group calls">
          {MINGLE_LEVELS.map((l) => (
            <button key={l} type="button" className={`cl-choice ${level === l ? 'cl-choice--on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>{LEVEL_WORDS[l]}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Right answers to get back in</span>
        <div className="cl-chips" role="group" aria-label="Right answers to get back in">
          {NEEDS.map((n) => (
            <button key={n} type="button" className={`cl-choice ${need === n ? 'cl-choice--on' : ''}`} aria-pressed={need === n} onClick={() => setNeed(n)}>{n}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Silly twists ("…standing on one leg!")</span>
        <div className="cl-chips" role="group" aria-label="Silly twists">
          <button type="button" className={`cl-choice ${twists ? 'cl-choice--on' : ''}`} aria-pressed={twists} onClick={() => setTwists(true)}>On</button>
          <button type="button" className={`cl-choice ${!twists ? 'cl-choice--on' : ''}`} aria-pressed={!twists} onClick={() => setTwists(false)}>Off</button>
        </div>
      </div>
      <Timer length={length} setLength={setLength} />
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length, need, level, twists })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function MingleLobbyHead({ need, level }: { need: Need; level: MingleLevel }) {
  return (
    <>
      <h1 className="cl-lobby__title">Maths Mingle</h1>
      <div className="cl-lobby__fact">Groups of 2 to {level === 'junior' ? 5 : 8}</div>
      <div className="jl-lobby-icons" aria-hidden="true">{['🎵', '🕺', '👥', '📱'].map((x, i) => <i key={i} style={{ animationDelay: `${i * 0.18}s` }}>{x}</i>)}</div>
      <p className="cl-lobby__ask">Join on an iPad, then put it at the side as a station. Left over? Tap your name there and get {need} right.</p>
    </>
  );
}
