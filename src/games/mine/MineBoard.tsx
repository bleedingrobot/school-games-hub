/**
 * The school board for one mine: the ten fastest in the pupil's own school (display names and avatars only) and the
 * pupil's own place, with or without maths. Hard mode is its own board.
 */
import { useEffect, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { loadBoard, type Board } from '../../data/mine';
import { formatClock, type LevelInfo } from './levels';

export function MineBoard({
  level, defaultMaths, showMaths, onBack,
}: {
  level: LevelInfo;
  /** Which board to open first: the one for the pupil’s own way of playing. */
  defaultMaths: boolean;
  /** Both boards are offered unless the teacher has settled it for the class. */
  showMaths: boolean;
  onBack: () => void;
}) {
  const [maths, setMaths] = useState(defaultMaths);
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    let current = true;
    setBoard(undefined);
    void loadBoard(level.id, maths).then((b) => current && setBoard(b));
    return () => {
      current = false;
    };
  }, [level.id, maths]);

  return (
    <section className="mn-picker" aria-label={`${level.name}: school board`}>
      <h2 ref={heading} tabIndex={-1}>{level.name}: school board</h2>
      <div className="mn-card">
        {showMaths && (
          <div className="mn-row" role="group" aria-label="With or without maths">
            <button type="button" className="button button--light mn-btn" aria-pressed={!maths} onClick={() => setMaths(false)}>Without maths</button>
            <button type="button" className="button button--light mn-btn" aria-pressed={maths} onClick={() => setMaths(true)}>With maths</button>
          </div>
        )}
        {board === undefined && <p role="status">Loading…</p>}
        {board === null && <p>The board can’t be reached right now.</p>}
        {board && board.top.length === 0 && <p>No times yet. Be the first!</p>}
        {board && board.top.length > 0 && (
          <ol className="mn-board__list">
            {board.top.map((row) => (
              <li key={row.rank} className={row.me ? 'mn-board__me' : undefined}>
                <span className="mn-board__rank" aria-label={`Place ${row.rank}`}>{row.rank}</span>
                <AvatarImage avatar={row.avatar} size={24} />
                <span className="mn-board__name">{row.name}{row.me ? ' (you)' : ''}</span>
                <span className="mn-board__time">{formatClock(row.steps)}</span>
              </li>
            ))}
          </ol>
        )}
        {board?.me && board.me.rank > 10 && <p>You are number {board.me.rank} of {board.total}: {formatClock(board.me.steps)}.</p>}
        {board && !board.me && board.total > 0 && <p>Finish this mine to get on the board.</p>}
        <p className="mn-hint">Only pupils in your school are on this board. It shows names and avatars, nothing else.</p>
      </div>
      <div className="mn-row">
        <button type="button" className="button button--play mn-btn" onClick={onBack}>Back to the mines</button>
      </div>
    </section>
  );
}
