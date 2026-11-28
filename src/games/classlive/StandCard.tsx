/**
 * Stand Up If on the Class Live picker page and in the lobby (docs/STAND-PLAN.md). Kept out of Projector.tsx so other
 * Class Live games built at the same time don't clash with it there.
 */
import { useState, type ComponentType } from 'react';
import { DEFAULT_STAND_LEVEL, DEFAULT_THINK, STAND_LEVELS, THINK_SECONDS, type StandLevel } from '../../../shared/classlive/stand';
import { painted } from './paintedArt';
import './stand.css';

export const standPic = () => painted('pick', 'stand', true) ?? painted('pick', 'mingle', true) ?? painted('back', 'star-sky', true);

const LEVEL_WORDS: Record<StandLevel, string> = { junior: 'Junior (> and <)', senior: 'Senior (> < ≥ ≤)' };

export function StandCard({ busy, hostOk, onOpen, Timer, Art }: {
  busy: boolean;
  hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  Timer: ComponentType<{ length: number; setLength: (m: number) => void }>;
  Art: ComponentType<{ pic: string | null }>;
}) {
  const [level, setLevel] = useState<StandLevel>(DEFAULT_STAND_LEVEL);
  const [think, setThink] = useState<number>(DEFAULT_THINK);
  const [length, setLength] = useState(5);
  return (
    <section className="cl-card cl-card--active" aria-label="Stand Up If">
      <Art pic={standPic()} />
      <h2 className="cl-card__name">🧍 Stand Up If</h2>
      <p className="cl-card__blurb">"Stand up if your answer &gt; your number!" Everyone answers on their own iPad, then stands or sits for real, all at once.</p>
      <ul className="su-card-how">
        <li>Every pupil needs an iPad: they sign in and join as usual.</li>
        <li>Each iPad gives a question at that pupil's own level, and their own number to compare it with.</li>
        <li>They tap Stand or Sit, then on 3, 2, 1 everyone shows it. Their iPad keeps their streak of right in a row.</li>
      </ul>
      <div className="cl-opt">
        <span className="cl-opt__label">Signs</span>
        <div className="cl-chips" role="group" aria-label="Signs">
          {STAND_LEVELS.map((l) => (
            <button key={l} type="button" className={`cl-choice ${level === l ? 'cl-choice--on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>{LEVEL_WORDS[l]}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Thinking time each round</span>
        <div className="cl-chips" role="group" aria-label="Thinking time each round">
          {THINK_SECONDS.map((n) => (
            <button key={n} type="button" className={`cl-choice ${think === n ? 'cl-choice--on' : ''}`} aria-pressed={think === n} onClick={() => setThink(n)}>{n} s</button>
          ))}
        </div>
      </div>
      <Timer length={length} setLength={setLength} />
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length, level, think })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function StandLobbyHead({ level, think }: { level: StandLevel; think: number }) {
  return (
    <>
      <h1 className="cl-lobby__title">Stand Up If</h1>
      <div className="cl-lobby__fact">{level === 'junior' ? 'Signs: > and <' : 'Signs: > < ≥ ≤'} · {think} seconds to think</div>
      <p className="cl-lobby__ask">Everyone: join on your own iPad. Answer, tap Stand or Sit, then show it for real!</p>
    </>
  );
}
