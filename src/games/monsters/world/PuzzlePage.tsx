/**
 * The puzzle screen (docs/MONSTERS-QUESTS-PLAN.md section 7), opened from a puzzle on the map. The
 * moves are the pure rules in shared/monsters/quests/puzzles.ts; this only draws them and keeps the
 * state while the screen is open. Solving calls solvePuzzle once. Arrow keys work on the slide and
 * crate puzzles, and every move also has a button (Chromebook touch screens).
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  cratesStart, crateSpots, light, lockStart, push, puzzleById, slide, slideStart, stepStone, stonesGrid, tryLock, turnDial,
  type CratesState, type LanternState, type LockState, type Puzzle, type SlideDir, type SlideState, type StonesState,
} from '../../../../shared/monsters/quests/puzzles';
import type { WorldState } from '../../../../shared/monsters/world/types';
import { solvePuzzle, type QuestOptions, type QuestResult } from '../../../../shared/monsters/world/questWorld';

type Of<K extends Puzzle['kind']> = Extract<Puzzle, { kind: K }>;
type Report = (s: { tries: number; done: boolean; note?: string }) => void;

const ARROWS: Record<string, SlideDir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const ARROW_LABEL: Record<SlideDir, string> = { up: '↑ Up', down: '↓ Down', left: '← Left', right: '→ Right' };

/** Four arrow buttons, and the arrow keys while the grid has the keyboard. */
function Arrows({ onMove }: { onMove: (d: SlideDir) => void }) {
  return (
    <div className="mz-arrows" role="group" aria-label="Move">
      {(['up', 'left', 'right', 'down'] as const).map((d) => (
        <button key={d} type="button" className={`mb-btn mz-arrows__${d}`} onClick={() => onMove(d)}>{ARROW_LABEL[d]}</button>
      ))}
    </div>
  );
}

const onArrow = (move: (d: SlideDir) => void) => (e: KeyboardEvent) => {
  const d = ARROWS[e.key];
  if (!d) return;
  e.preventDefault();
  move(d);
};

function Stones({ p, report }: { p: Of<'stones'>; report: Report }) {
  const grid = stonesGrid(p);
  const [s, set] = useState<StonesState>({ at: null, tries: 0, done: false });
  const go = (r: number, c: number) => {
    const next = stepStone(p, s, r, c);
    set(next);
    report({ tries: next.tries, done: next.done, note: next.splash ? 'Splash! Back to the start.' : undefined });
  };
  const width = grid[0].length;
  return (
    <div className="mz-stones" style={{ gridTemplateColumns: `repeat(${width + 1}, minmax(0, 1fr))` }} role="group" aria-label="Stepping stones">
      {grid.map((row, r) => [
        ...row.map((n, c) => {
          const here = s.at?.[0] === r && s.at?.[1] === c;
          return (
            <button key={`${r}-${c}`} type="button" className={`mz-stone${here ? ' is-here' : ''}`} aria-pressed={here} onClick={() => go(r, c)}>
              {n}
            </button>
          );
        }),
        <button key={`${r}-bank`} type="button" className="mz-bank" onClick={() => go(r, width)} aria-label={`Far bank, row ${r + 1}`}>🏁</button>,
      ])}
    </div>
  );
}

function Slide({ p, report }: { p: Of<'slide'>; report: Report }) {
  const [s, set] = useState<SlideState>(() => slideStart(p));
  const move = (d: SlideDir) => {
    const next = slide(p, s, d);
    set(next);
    report({ tries: next.tries, done: next.done });
  };
  const again = () => {
    const next = { ...slideStart(p), tries: s.tries + 1 };
    set(next);
    report({ tries: next.tries, done: false });
  };
  return (
    <>
      <div className="mz-play">
        <div className="mz-grid" tabIndex={0} onKeyDown={onArrow(move)} style={{ gridTemplateColumns: `repeat(${p.grid[0].length}, 1fr)` }} role="img" aria-label={`Ice. You are in row ${s.at[0] + 1}, column ${s.at[1] + 1}.`}>
          {p.grid.flatMap((row, r) => [...row].map((ch, c) => {
            const you = s.at[0] === r && s.at[1] === c;
            return <span key={`${r}-${c}`} className={`mz-cell mz-cell--${ch === '#' ? 'rock' : ch === 'C' ? 'chest' : 'ice'}`}>{you ? '🧒' : ch === '#' ? '🪨' : ch === 'C' ? '🎁' : ''}</span>;
          }))}
        </div>
        <Arrows onMove={move} />
      </div>
      <button type="button" className="mb-btn" onClick={again}>Start again</button>
    </>
  );
}

function Lanterns({ p, report }: { p: Of<'lanterns'>; report: Report }) {
  const [s, set] = useState<LanternState>({ lit: [], tries: 0, done: false });
  const tap = (i: number) => {
    const next = light(p, s, i);
    set(next);
    report({ tries: next.tries, done: next.done, note: next.tries > s.tries ? 'Whoosh! The lanterns all went out.' : undefined });
  };
  return (
    <div className="mz-lanterns" role="group" aria-label="Lanterns">
      {p.numbers.map((n, i) => (
        <button key={i} type="button" className={`mz-lantern${s.lit.includes(i) ? ' is-lit' : ''}`} aria-pressed={s.lit.includes(i)} onClick={() => tap(i)}>
          {n}
        </button>
      ))}
    </div>
  );
}

function Lock({ p, report }: { p: Of<'lock'>; report: Report }) {
  const [s, set] = useState<LockState>(() => lockStart(p));
  const check = () => {
    const next = tryLock(p, s);
    set(next);
    report({ tries: next.tries, done: next.done, note: next.done ? undefined : 'Clunk. That’s not the code.' });
  };
  return (
    <>
      <ul className="mz-clues">{p.clues.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="mz-dials" role="group" aria-label="The lock">
        {s.digits.map((d, i) => (
          <div key={i} className="mz-dial">
            <button type="button" className="mb-btn" aria-label={`Number ${i + 1} up`} onClick={() => set(turnDial(s, i, 1))}>▲</button>
            <output aria-label={`Number ${i + 1}`}>{d}</output>
            <button type="button" className="mb-btn" aria-label={`Number ${i + 1} down`} onClick={() => set(turnDial(s, i, -1))}>▼</button>
          </div>
        ))}
      </div>
      <button type="button" className="mb-btn mb-btn--primary" onClick={check}>Try the code</button>
    </>
  );
}

function Crates({ p, report }: { p: Of<'crates'>; report: Report }) {
  const [s, set] = useState<CratesState>(() => cratesStart(p));
  const spots = crateSpots(p);
  const move = (d: SlideDir) => {
    const next = push(p, s, d);
    set(next);
    report({ tries: next.tries, done: next.done });
  };
  const again = () => {
    set(cratesStart(p, s.tries + 1));
    report({ tries: s.tries + 1, done: false });
  };
  const is = (list: [number, number][], r: number, c: number) => list.some(([a, b]) => a === r && b === c);
  return (
    <>
      <div className="mz-play">
        <div className="mz-grid" tabIndex={0} onKeyDown={onArrow(move)} style={{ gridTemplateColumns: `repeat(${p.grid[0].length}, 1fr)` }} role="img" aria-label={`The wharf. ${s.crates.filter(([r, c]) => is(spots, r, c)).length} of ${spots.length} crates in place.`}>
          {p.grid.flatMap((row, r) => [...row].map((ch, c) => {
            const crate = is(s.crates, r, c);
            const spot = is(spots, r, c);
            const you = s.you[0] === r && s.you[1] === c;
            return (
              <span key={`${r}-${c}`} className={`mz-cell mz-cell--${ch === '#' ? 'wall' : 'wharf'}${spot ? ' is-spot' : ''}`}>
                {you ? '🧒' : crate ? (spot ? '✅' : '📦') : ''}
              </span>
            );
          }))}
        </div>
        <Arrows onMove={move} />
      </div>
      <button type="button" className="mb-btn" onClick={again}>Start again</button>
    </>
  );
}

export function PuzzlePage({ world, apply, id, opts }: { world: WorldState; apply: (r: QuestResult) => void; id: string; opts: QuestOptions }) {
  const p = puzzleById(id);
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const paid = useRef(false);
  // Solved: count it once (the flag, the prize and any quest step).
  useEffect(() => {
    if (done && !paid.current) {
      paid.current = true;
      apply(solvePuzzle(world, id, opts));
    }
  }, [done, world, id, opts, apply]);
  if (!p) return <p className="mb-empty">There is no puzzle here.</p>;
  const report: Report = (s) => {
    setTries(s.tries);
    setNote(s.note ?? '');
    if (s.done) setDone(true);
  };
  return (
    <div className="mq mz">
      <p className="mz-says">{p.says}</p>
      {p.kind === 'stones' && <Stones p={p} report={report} />}
      {p.kind === 'slide' && <Slide p={p} report={report} />}
      {p.kind === 'lanterns' && <Lanterns p={p} report={report} />}
      {p.kind === 'lock' && <Lock p={p} report={report} />}
      {p.kind === 'crates' && <Crates p={p} report={report} />}
      <p className="mz-note" role="status">{done ? 'You solved it!' : note}</p>
      {tries >= 3 && !done && <p className="mz-hint"><b>Show me:</b> {p.hint}</p>}
    </div>
  );
}
