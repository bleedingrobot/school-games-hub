/**
 * The puzzle screen (docs/MONSTERS-QUESTS-PLAN.md section 7), opened from a puzzle on the map. The
 * moves are the pure rules in shared/monsters/quests/puzzles.ts; this only draws them and keeps the
 * state while the screen is open. Solving calls solvePuzzle once. Arrow keys work on the slide and
 * crate puzzles, every move also has a button (Chromebook touch screens), and the boards can be swiped.
 *
 * The look (docs/MONSTERS-PUZZLE-ART-PLAN.md): each puzzle is a little painted scene. The area's
 * landscape is behind it (MapMenu), the local person says the instructions, the pupil's own walker is the
 * player, things move, and a prize card shows what was won. Every painted piece is optional: when a file
 * is missing the CSS draws a plain stand-in.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import {
  cratesStart, crateSpots, light, lockStart, push, puzzleById, slide, slideStart, stepStone, stonesGrid, tryLock, turnDial,
  type CratesState, type LanternState, type LockState, type Puzzle, type SlideDir, type SlideState, type StonesState,
} from '../../../../shared/monsters/quests/puzzles';
import type { WorldState } from '../../../../shared/monsters/world/types';
import { solvePuzzle, type QuestOptions, type QuestResult } from '../../../../shared/monsters/world/questWorld';
import { useSound } from '../../../sound';
import { playSound, type GameSound } from '../../sounds';
import { badgePic, DEFAULT_LOOK, eggPic, personPic, propPic, walkerPic } from '../art/painted';
import { lookOf, type PuzzleLook } from './puzzleLook';
import './puzzles.css';

// Painted on the gaming computer (scripts/monsters-puzzle-paint.py, then monsters-puzzle-pick.py). The styles use them as CSS variables.
const ART = import.meta.glob('./assets/puzzles/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const artUrl = (name: string): string | undefined => ART[`./assets/puzzles/${name}.webp`];
const ART_VARS = Object.fromEntries(
  Object.entries(ART).map(([path, url]) => [`--mz-${path.slice(path.lastIndexOf('/') + 1, -5)}`, `url("${url}")`]),
) as CSSProperties;

type Of<K extends Puzzle['kind']> = Extract<Puzzle, { kind: K }>;
type Report = (s: { tries: number; done: boolean; note?: string; progress?: string }) => void;
type Facing = 'up' | 'down' | 'left' | 'right';
interface BoardProps<K extends Puzzle['kind']> { p: Of<K>; report: Report; look: PuzzleLook; me: string; sfx: (s: GameSound) => void }

const ARROWS: Record<string, SlideDir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const ARROW_GLYPH: Record<SlideDir, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
const ARROW_NAME: Record<SlideDir, string> = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };

/** The pupil's own walker (their chosen look), or a plain child if the picture isn't there. */
function Me({ look, facing, className = '' }: { look: string; facing: Facing; className?: string }) {
  const src = walkerPic(look, facing) ?? walkerPic(DEFAULT_LOOK, facing);
  return src
    ? <img className={`mz-me ${className}`} src={src} alt="" draggable={false} />
    : <span className={`mz-me mz-me--emoji ${className}`} aria-hidden="true">🧒</span>;
}

/** Four round arrow buttons, and the arrow keys while the board has the keyboard. */
function Arrows({ onMove }: { onMove: (d: SlideDir) => void }) {
  return (
    <div className="mz-arrows" role="group" aria-label="Move">
      {(['up', 'left', 'right', 'down'] as const).map((d) => (
        <button key={d} type="button" className={`mz-arrow mz-arrows__${d}`} aria-label={ARROW_NAME[d]} onClick={() => onMove(d)}>{ARROW_GLYPH[d]}</button>
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

/** A swipe on a board moves that way (iPads). */
function useSwipe(move: (d: SlideDir) => void) {
  const from = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => { from.current = { x: e.clientX, y: e.clientY }; },
    onPointerUp: (e: PointerEvent) => {
      const f = from.current;
      from.current = null;
      if (!f) return;
      const dx = e.clientX - f.x;
      const dy = e.clientY - f.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    },
  };
}

const FACING: Record<SlideDir, Facing> = { up: 'up', down: 'down', left: 'left', right: 'right' };
const pct = (i: number, n: number) => `${(i / n) * 100}%`;

// ---- Stepping stones ----

const STONE_MISS = {
  start: 'Start on a stone on the left side of the pool.',
  far: 'Too far! Step to a stone right next to you: up, down, left or right.',
} as const;
const ROCKS = ['stone-round', 'stone-oval', 'stone-flat', 'stone-moss'];
const LAGOON = ['lily-1', 'coral-1', 'lily-2', 'coral-2'];

function Stones({ p, report, look, me, sfx }: BoardProps<'stones'>) {
  const grid = stonesGrid(p);
  const [s, set] = useState<StonesState>({ at: null, tries: 0, done: false });
  const [path, setPath] = useState<[number, number][]>([]);
  const [splash, setSplash] = useState<{ r: number; c: number; n: number } | null>(null);
  const [facing, setFacing] = useState<Facing>('right');
  const width = grid[0].length;
  const go = (r: number, c: number) => {
    const next = stepStone(p, s, r, c);
    set(next);
    let trail = path;
    if (next.splash) {
      trail = [];
      setSplash({ r, c, n: (splash?.n ?? 0) + 1 });
      sfx('knock');
    } else if (next.at && (next.at[0] !== s.at?.[0] || next.at[1] !== s.at?.[1])) {
      if (s.at) setFacing(r < s.at[0] ? 'up' : r > s.at[0] ? 'down' : c < s.at[1] ? 'left' : 'right');
      trail = [...path, next.at];
      sfx('hop');
    } else if (next.done) sfx('win');
    setPath(trail);
    const note = next.splash ? 'Splash! Back to the start.' : next.miss ? STONE_MISS[next.miss] : undefined;
    report({ tries: next.tries, done: next.done, note, progress: trail.length ? trail.map(([a, b]) => grid[a][b]).join(' → ') : undefined });
  };
  const near = (r: number, c: number) => (s.at ? Math.abs(s.at[0] - r) + Math.abs(s.at[1] - c) === 1 : c === 0);
  const kinds = look.stones === 'lagoon' ? LAGOON : ROCKS;
  return (
    <div className={`mz-pool${look.stones === 'lagoon' ? ' mz-pool--lagoon' : ''}`} style={{ '--cols': width } as CSSProperties} role="group" aria-label="Stepping stones">
      <div className="mz-shore" aria-hidden="true">{!s.at && !s.done && <Me look={me} facing="right" className="mz-me--shore" />}</div>
      {grid.map((row, r) =>
        row.map((n, c) => {
          const here = s.at?.[0] === r && s.at?.[1] === c;
          const trod = path.some(([a, b]) => a === r && b === c);
          const sunk = splash?.r === r && splash?.c === c;
          const kind = kinds[(r * 3 + c * 5 + (r * c) % 3) % 4];
          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={`mz-stone mz-stone--${kind}${here ? ' is-here' : ''}${trod ? ' is-trod' : ''}${near(r, c) && !s.done ? ' is-near' : ''}`}
              style={{ gridRow: r + 1, gridColumn: c + 2, '--tilt': `${((r * 7 + c * 11) % 9) - 4}deg`, '--bob': `${((r + c) % 4) * 0.6}s` } as CSSProperties}
              aria-pressed={here}
              onClick={() => go(r, c)}
            >
              <span className="mz-stone__n">{n}</span>
              {here && <Me key={`${r}-${c}`} look={me} facing={facing} className="mz-me--hop" />}
              {sunk && <span key={splash!.n} className="mz-splash" aria-hidden="true" />}
            </button>
          );
        }),
      )}
      {grid.map((_, r) => (
        <button key={`${r}-bank`} type="button" className={`mz-bank${r === 0 ? ' mz-bank--flag' : ''}`} style={{ gridRow: r + 1, gridColumn: width + 2 }} onClick={() => go(r, width)} aria-label={`Far bank, row ${r + 1}`}>
          {s.done && r === Math.floor(grid.length / 2) && <Me look={me} facing="right" className="mz-me--hop" />}
        </button>
      ))}
    </div>
  );
}

// ---- Lanterns ----

function Lanterns({ p, report, sfx }: BoardProps<'lanterns'>) {
  const [s, set] = useState<LanternState>({ lit: [], tries: 0, done: false });
  const [puff, setPuff] = useState(0);
  const order = [...p.numbers].sort((a, b) => a - b);
  const tap = (i: number) => {
    const next = light(p, s, i);
    set(next);
    const out = next.tries > s.tries;
    if (out) { setPuff((n) => n + 1); sfx('knock'); } else if (next.lit.length > s.lit.length) sfx(next.done ? 'door' : 'zap');
    report({ tries: next.tries, done: next.done, note: out ? 'Whoosh! The lanterns all went out.' : undefined, progress: next.lit.length ? next.lit.map((j) => p.numbers[j]).join(', ') : undefined });
  };
  return (
    <div className={`mz-door${s.done ? ' is-open' : ''}`}>
      <div className="mz-door__beam" aria-hidden="true" />
      <div className="mz-lanterns" role="group" aria-label="Lanterns">
        {p.numbers.map((n, i) => (
          <button key={i} type="button" className={`mz-lantern${s.lit.includes(i) ? ' is-lit' : ''}`} style={{ '--chain': `${i % 2 ? 46 : 26}px`, '--sway': `${(i % 3) * 0.4}s` } as CSSProperties} aria-pressed={s.lit.includes(i)} onClick={() => tap(i)}>
            <span className="mz-lantern__chain" aria-hidden="true" />
            <span className="mz-lantern__glass" aria-hidden="true">{puff > 0 && <span key={puff} className="mz-smoke" />}</span>
            <span className="mz-lantern__tag">{n}</span>
          </button>
        ))}
      </div>
      <ol className="mz-order" aria-label="Lit so far">
        {order.map((n, i) => <li key={i} className={i < s.lit.length ? 'is-on' : ''}>{i < s.lit.length ? n : '?'}</li>)}
      </ol>
    </div>
  );
}

// ---- Ice slide ----

const ROCK_KINDS = ['rock-a', 'rock-b', 'rock-c'];

function Slide({ p, report, look, me, sfx }: BoardProps<'slide'>) {
  const [s, set] = useState<SlideState>(() => slideStart(p));
  const [facing, setFacing] = useState<Facing>('down');
  const [ms, setMs] = useState(0);
  const [bump, setBump] = useState(0);
  const rows = p.grid.length;
  const cols = p.grid[0].length;
  const move = (d: SlideDir) => {
    const next = slide(p, s, d);
    const dist = Math.abs(next.at[0] - s.at[0]) + Math.abs(next.at[1] - s.at[1]);
    setFacing(FACING[d]);
    setMs(dist * 90 + 60);
    set(next);
    if (!dist) { setBump((n) => n + 1); sfx('knock'); } else sfx(next.done ? 'chest' : 'move');
    report({ tries: next.tries, done: next.done });
  };
  const again = () => {
    const next = { ...slideStart(p), tries: s.tries + 1 };
    setMs(0);
    set(next);
    report({ tries: next.tries, done: false });
  };
  const swipe = useSwipe(move);
  return (
    <>
      <div className="mz-play">
        <div className={`mz-rink${look.night ? ' mz-rink--night' : ''}`}>
          <div className="mz-grid mz-grid--ice" tabIndex={0} onKeyDown={onArrow(move)} {...swipe} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="img" aria-label={`Ice. You are in row ${s.at[0] + 1}, column ${s.at[1] + 1}.`}>
            {p.grid.flatMap((row, r) => [...row].map((ch, c) => (
              <span key={`${r}-${c}`} className={`mz-cell${ch === '#' ? ` mz-cell--rock mz-cell--${ROCK_KINDS[(r + c * 2) % 3]}` : ''}`}>
                {ch === 'C' && <img className={`mz-chest${s.done ? ' is-open' : ''}`} src={(s.done ? propPic('chest-open') : undefined) ?? propPic('chest') ?? artUrl('chest')} alt="" draggable={false} />}
              </span>
            )))}
            <span key={bump} className={`mz-walker${bump ? ' is-bump' : ''}`} style={{ left: pct(s.at[1], cols), top: pct(s.at[0], rows), width: pct(1, cols), height: pct(1, rows), transitionDuration: `${ms}ms` }}>
              <Me look={me} facing={facing} />
              {ms > 150 && <span key={`${s.at}`} className={`mz-spray mz-spray--${facing}`} aria-hidden="true" />}
            </span>
          </div>
        </div>
        <Arrows onMove={move} />
      </div>
      <button type="button" className="mz-btn" onClick={again}>↺ Start again</button>
    </>
  );
}

// ---- Number lock ----

/** Glowworms spread over a patch of cave roof, the same places every time. */
function Glowworms({ n, seed }: { n: number; seed: number }) {
  return (
    <span className="mz-worms" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="mz-worm" style={{ left: `${6 + ((i * 37 + seed * 17) % 86)}%`, '--drop': `${8 + ((i * 23 + seed * 7) % 26)}px`, '--twinkle': `${((i + seed) % 5) * 0.5}s` } as CSSProperties} />
      ))}
    </span>
  );
}

function Lock({ p, report, look, sfx }: BoardProps<'lock'>) {
  const [s, set] = useState<LockState>(() => lockStart(p));
  const check = () => {
    const next = tryLock(p, s);
    set(next);
    sfx(next.done ? (look.chest ? 'chest' : 'door') : 'knock');
    report({ tries: next.tries, done: next.done, note: next.done ? undefined : 'Clunk. That’s not the code.' });
  };
  const turn = (i: number, by: 1 | -1) => { set(turnDial(s, i, by)); sfx('tap'); };
  return (
    <div className="mz-lockwrap">
      {look.glow ? (
        <div className="mz-roof">
          <ul className="mz-clues mz-sr">{p.clues.map((c) => <li key={c}>{c}</li>)}</ul>
          {look.glow.map((n, i) => (
            <div key={i} className="mz-roof__group" aria-hidden="true"><b>{i + 1}</b><Glowworms n={n} seed={i + 1} /></div>
          ))}
        </div>
      ) : (
        <ul className="mz-clues mz-signs">{p.clues.map((c) => <li key={c}>{c}</li>)}</ul>
      )}
      <div className={`mz-lock${look.chest ? ' mz-lock--chest' : ''}${s.done ? ' is-open' : ''}${s.tries ? ` is-wrong-${s.tries % 2}` : ''}`}>
        <div className="mz-dials" role="group" aria-label="The lock">
          {s.digits.map((d, i) => (
            <div key={i} className="mz-dial">
              <button type="button" className="mz-knob" aria-label={`Number ${i + 1} up`} onClick={() => turn(i, 1)}>▲</button>
              <output className="mz-drum" aria-label={`Number ${i + 1}`}>
                <span aria-hidden="true">{(d + 9) % 10}</span>
                <span key={d} className="mz-drum__now">{d}</span>
                <span aria-hidden="true">{(d + 1) % 10}</span>
              </output>
              <button type="button" className="mz-knob" aria-label={`Number ${i + 1} down`} onClick={() => turn(i, -1)}>▼</button>
            </div>
          ))}
        </div>
        <button type="button" className="mz-btn mz-btn--gold" onClick={check}>Try the code</button>
      </div>
    </div>
  );
}

// ---- Crates ----

function Crates({ p, report, me, sfx }: BoardProps<'crates'>) {
  const [s, set] = useState<CratesState>(() => cratesStart(p));
  const [facing, setFacing] = useState<Facing>('down');
  const spots = crateSpots(p);
  const rows = p.grid.length;
  const cols = p.grid[0].length;
  const on = ([r, c]: [number, number]) => spots.some(([a, b]) => a === r && b === c);
  const placed = s.crates.filter(on).length;
  const move = (d: SlideDir) => {
    const next = push(p, s, d);
    setFacing(FACING[d]);
    set(next);
    const pushed = next.crates.some((x, i) => x[0] !== s.crates[i][0] || x[1] !== s.crates[i][1]);
    if (next.done) sfx('win'); else if (pushed) sfx('tap'); else if (next.moves === s.moves) sfx('knock');
    report({ tries: next.tries, done: next.done, progress: `Crates: ${next.crates.filter(on).length} of ${spots.length}` });
  };
  const again = () => {
    set(cratesStart(p, s.tries + 1));
    report({ tries: s.tries + 1, done: false, progress: `Crates: ${cratesStart(p).crates.filter(on).length} of ${spots.length}` });
  };
  const swipe = useSwipe(move);
  const at = ([r, c]: [number, number]): CSSProperties => ({ left: pct(c, cols), top: pct(r, rows), width: pct(1, cols), height: pct(1, rows) });
  return (
    <>
      <div className="mz-play">
        <div className="mz-grid mz-grid--wharf" tabIndex={0} onKeyDown={onArrow(move)} {...swipe} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="img" aria-label={`The wharf. ${placed} of ${spots.length} crates in place.`}>
          {p.grid.flatMap((row, r) => [...row].map((ch, c) => {
            const water = ch === '#';
            const edge = !water && (p.grid[r + 1]?.[c] ?? '#') === '#' ? ' is-edge' : '';
            return <span key={`${r}-${c}`} className={`mz-cell mz-cell--${water ? 'wall' : 'wharf'}${edge}${on([r, c]) ? ' is-spot' : ''}`} />;
          }))}
          {s.crates.map((x, i) => <span key={i} className={`mz-crate${on(x) ? ' is-on' : ''}`} style={at(x)} />)}
          <span className="mz-walker" style={at(s.you)}><Me look={me} facing={facing} /></span>
        </div>
        <Arrows onMove={move} />
      </div>
      <button type="button" className="mz-btn" onClick={again}>↺ Start again</button>
    </>
  );
}

// ---- The prize card ----

function Prize({ p }: { p: Puzzle }) {
  if ('egg' in p.prize) {
    const src = eggPic(p.prize.egg);
    return src ? <img className="mz-prize__egg" src={src} alt="" /> : null;
  }
  const src = artUrl(`bit-${p.prize.bits}`) ?? badgePic(p.prize.bits);
  return src ? <>{Array.from({ length: Math.min(p.prize.n, 5) }, (_, i) => <img key={i} className="mz-prize__bit" style={{ '--i': i } as CSSProperties} src={src} alt="" />)}</> : null;
}

function WinCard({ p, message, onDone }: { p: Puzzle; message: string; onDone?: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { button.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="mz-win">
      <div className="mz-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--x': `${(i * 41) % 100}%`, '--d': `${(i % 9) * 0.15}s`, '--c': i % 6 } as CSSProperties} />)}</div>
      <div className="mz-win__card">
        <span className="mz-win__rays" aria-hidden="true" />
        <h3>You solved it!</h3>
        <div className="mz-prize" aria-hidden="true"><Prize p={p} /></div>
        <p role="status">{message.replace(/^Solved!\s*/, '') || 'Well done!'}</p>
        {onDone && <button ref={button} type="button" className="mz-btn mz-btn--gold" onClick={onDone}>Back to the map</button>}
      </div>
    </div>
  );
}

export function PuzzlePage({ world, apply, id, opts, onDone }: { world: WorldState; apply: (r: QuestResult) => void; id: string; opts: QuestOptions; onDone?: () => void }) {
  const p = puzzleById(id);
  const look = lookOf(id);
  const { soundOn } = useSound();
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState('');
  const [hint, setHint] = useState(false);
  const [won, setWon] = useState<string | null>(null);
  const paid = useRef(false);
  const sfx = (s: GameSound) => { if (soundOn) playSound(s); };
  if (!p) return <p className="mb-empty">There is no puzzle here.</p>;
  const report: Report = (s) => {
    setTries(s.tries);
    setNote(s.note ?? '');
    if (s.progress !== undefined || s.done) setProgress(s.progress ?? '');
    // Solved: count it once (the flag, the prize and any quest step).
    if (s.done && !paid.current) {
      paid.current = true;
      const r = solvePuzzle(world, id, opts);
      apply(r);
      setWon(r.ok ? r.message : '');
      window.setTimeout(() => sfx('badge'), 450);
    }
  };
  const face = look.person ? personPic(look.person, true) : undefined;
  const me = world.look ?? DEFAULT_LOOK;
  const board: Record<Puzzle['kind'], ReactNode> = {
    stones: p.kind === 'stones' && <Stones p={p} report={report} look={look} me={me} sfx={sfx} />,
    lanterns: p.kind === 'lanterns' && <Lanterns p={p} report={report} look={look} me={me} sfx={sfx} />,
    slide: p.kind === 'slide' && <Slide p={p} report={report} look={look} me={me} sfx={sfx} />,
    lock: p.kind === 'lock' && <Lock p={p} report={report} look={look} me={me} sfx={sfx} />,
    crates: p.kind === 'crates' && <Crates p={p} report={report} look={look} me={me} sfx={sfx} />,
    pods: null,
  };
  return (
    <div className={`mq mz mz--${p.kind} mz--${look.theme}`} style={ART_VARS}>
      <div className="mz-says">
        {face && <img className="mz-says__face" src={face} alt="" />}
        <p className="mz-says__bubble">
          {hint ? <><b>Show me:</b> {p.hint}</> : p.says}
        </p>
      </div>
      <div className="mz-board">{board[p.kind]}</div>
      <div className="mz-bar">
        {progress && <span className="mz-chip">{progress}</span>}
        <p className={`mz-note${note ? ' is-on' : ''}`} role="status">{won !== null ? 'You solved it!' : note}</p>
        <span className="mz-pips" aria-label={`Tries: ${tries}`}>
          {[0, 1, 2].map((i) => <i key={i} className={i < tries ? 'is-on' : ''} />)}
        </span>
        {tries >= 3 && won === null && (
          <button type="button" className={`mz-btn mz-btn--hint${hint ? '' : ' is-new'}`} aria-pressed={hint} onClick={() => setHint(!hint)}>💡 Show me</button>
        )}
      </div>
      {won !== null && <WinCard p={p} message={won} onDone={onDone} />}
    </div>
  );
}
