/**
 * The Wormholes & Black Holes board: squares, wormholes, black holes and stars drawn in
 * SVG, with the rockets on top as HTML (so CSS can move them). The board never works out
 * any rules: it draws the state it's given and puts each rocket where `positions` says,
 * which the game screen updates step by step from the engine's events.
 */
import { memo, type CSSProperties, type MouseEvent } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { ROW_LENGTH, squareXY, cometTail, type Board, type BoardSize, type Square } from '../../../shared/space/board';
import type { SpaceState } from '../../../shared/space/engine';
import { randomFromSeed } from '../../../shared/space/random';
import type { SeatShape } from './text';

export interface Seat {
  name: string;
  avatar: unknown;
  colour: string;
  shape: SeatShape;
  isStudent: boolean;
}

/** Rocket effects the game screen switches on for a moment. */
export type RocketFx = 'hop' | 'slide' | 'swirl' | 'spaghetti' | 'shield' | 'sparkle' | 'bump' | 'docked' | null;

const CELL = 100;

function centre(n: number, size: BoardSize) {
  const { row, col } = squareXY(n, size);
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

/** The square under a point on the board (0–1 across and down), the opposite of squareXY. */
function squareAt(fx: number, fy: number, size: BoardSize): number | null {
  const rows = size / ROW_LENGTH;
  const col = Math.floor(fx * ROW_LENGTH);
  const row = Math.floor(fy * rows);
  if (col < 0 || col >= ROW_LENGTH || row < 0 || row >= rows) return null;
  const fromBottom = rows - 1 - row;
  const along = fromBottom % 2 === 0 ? col : ROW_LENGTH - 1 - col;
  return fromBottom * ROW_LENGTH + along + 1;
}

export function SeatShapeIcon({ shape, colour, size = 18 }: { shape: SeatShape; colour: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="seat-shape">
      <ShapePath shape={shape} cx={10} cy={10} r={8} fill={colour} />
    </svg>
  );
}

function ShapePath({ shape, cx, cy, r, fill }: { shape: SeatShape; cx: number; cy: number; r: number; fill: string }) {
  const stroke = { fill, stroke: '#14112e', strokeWidth: r * 0.28, strokeLinejoin: 'round' as const };
  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={r * 0.9} {...stroke} />;
    case 'triangle':
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}`} {...stroke} />;
    case 'square':
      return <rect x={cx - r * 0.8} y={cy - r * 0.8} width={r * 1.6} height={r * 1.6} {...stroke} />;
    case 'diamond':
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} {...stroke} />;
  }
}

// ---------- Square pictures (each kind has its own shape, never colour alone) ----------

function starPoints(cx: number, cy: number, points: number, outer: number, inner: number) {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}

/** One square's picture on its own, for How to play and the Star chart. */
export function SquarePicture({ square, size = 52 }: { square: Square; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="space-square-picture">
      <rect x={3} y={3} width={94} height={94} rx={14} fill="#1d1850" />
      <SquareIcon square={square} cx={50} cy={50} />
    </svg>
  );
}

function SquareIcon({ square, cx, cy }: { square: Square; cx: number; cy: number }) {
  switch (square.kind) {
    case 'wormhole':
      return (
        <g className="sq-wormhole">
          <ellipse cx={cx} cy={cy} rx={30} ry={22} fill="#0b3b4a" stroke="#3ff2e0" strokeWidth={4} />
          <ellipse cx={cx} cy={cy} rx={20} ry={14} fill="none" stroke="#7ffcf0" strokeWidth={3} />
          <ellipse cx={cx} cy={cy} rx={10} ry={7} fill="#c9fffa" />
          <path d={`M${cx - 9} ${cy - 30} L${cx} ${cy - 40} L${cx + 9} ${cy - 30}`} fill="none" stroke="#7ffcf0" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    case 'black-hole':
      return (
        <g className="sq-black-hole">
          <ellipse cx={cx} cy={cy} rx={34} ry={13} fill="none" stroke="#ff8a3d" strokeWidth={5} />
          <circle cx={cx} cy={cy} r={18} fill="#000" stroke="#ffb36b" strokeWidth={2.5} />
          <path d={`M${cx - 34} ${cy} A34 13 0 0 0 ${cx + 34} ${cy}`} fill="none" stroke="#ffcf8a" strokeWidth={4} />
        </g>
      );
    case 'star':
      switch (square.star) {
        case 'red-dwarf':
          return <circle cx={cx} cy={cy} r={14} fill="#ff5a4e" stroke="#ffb3a8" strokeWidth={4} />;
        case 'yellow-star':
          return <polygon points={starPoints(cx, cy, 5, 28, 12)} fill="#ffd84a" stroke="#fff3b0" strokeWidth={3} />;
        case 'blue-giant':
          return (
            <g>
              <polygon points={starPoints(cx, cy, 8, 34, 22)} fill="#7fb8ff" />
              <circle cx={cx} cy={cy} r={21} fill="#3d7bff" stroke="#cfe3ff" strokeWidth={3} />
            </g>
          );
        case 'white-dwarf':
          return (
            <g>
              <path d={`M${cx} ${cy - 28} L${cx + 22} ${cy - 18} L${cx + 18} ${cy + 12} L${cx} ${cy + 26} L${cx - 18} ${cy + 12} L${cx - 22} ${cy - 18} Z`} fill="none" stroke="#bfe9ff" strokeWidth={4} />
              <circle cx={cx} cy={cy} r={10} fill="#fff" />
            </g>
          );
        case 'binary-star':
          return (
            <g>
              <ellipse cx={cx} cy={cy} rx={28} ry={10} fill="none" stroke="#ffffff88" strokeWidth={2.5} strokeDasharray="5 5" />
              <circle cx={cx - 15} cy={cy} r={11} fill="#ffb03b" stroke="#fff" strokeWidth={2} />
              <circle cx={cx + 15} cy={cy} r={8} fill="#8fd0ff" stroke="#fff" strokeWidth={2} />
            </g>
          );
        case 'neutron-star':
          return (
            <g>
              <ellipse cx={cx} cy={cy} rx={30} ry={11} fill="none" stroke="#c8b6ff" strokeWidth={3} transform={`rotate(30 ${cx} ${cy})`} />
              <ellipse cx={cx} cy={cy} rx={30} ry={11} fill="none" stroke="#c8b6ff" strokeWidth={3} transform={`rotate(-30 ${cx} ${cy})`} />
              <circle cx={cx} cy={cy} r={8} fill="#fff" stroke="#9b7bff" strokeWidth={3} />
            </g>
          );
        case 'pulsar':
          return (
            <g>
              <polygon points={`${cx},${cy} ${cx - 10},${cy - 36} ${cx + 10},${cy - 36}`} fill="#9ef0ff" opacity={0.8} />
              <polygon points={`${cx},${cy} ${cx - 10},${cy + 36} ${cx + 10},${cy + 36}`} fill="#9ef0ff" opacity={0.8} />
              <circle cx={cx} cy={cy} r={10} fill="#fff" stroke="#3fd0ff" strokeWidth={3} />
            </g>
          );
        case 'supernova':
          return (
            <g>
              <polygon points={starPoints(cx, cy, 12, 36, 18)} fill="#ff7b2e" />
              <polygon points={starPoints(cx, cy, 12, 22, 11)} fill="#ffe14d" />
            </g>
          );
        case 'matariki':
          return (
            <g fill="#e8f1ff">
              {[[0, -16], [-14, -6], [12, -8], [-6, 6], [10, 8], [-18, 14], [2, 22], [20, 20], [-2, -2]].map(([dx, dy], i) => (
                <circle key={i} cx={cx + dx} cy={cy + dy} r={i === 8 ? 6 : 4.5} />
              ))}
            </g>
          );
      }
      return null;
    case 'gravity':
      if (square.gravity === 'heavy') {
        return (
          <g fill="none" stroke="#ff9f6b" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
            <path d={`M${cx - 18} ${cy - 18} L${cx} ${cy - 2} L${cx + 18} ${cy - 18}`} />
            <path d={`M${cx - 18} ${cy + 2} L${cx} ${cy + 18} L${cx + 18} ${cy + 2}`} />
          </g>
        );
      }
      if (square.gravity === 'low') {
        return (
          <g fill="none" stroke="#9dffb0" strokeWidth={4}>
            <circle cx={cx - 10} cy={cy + 12} r={9} />
            <circle cx={cx + 12} cy={cy} r={7} />
            <circle cx={cx - 2} cy={cy - 16} r={5} />
          </g>
        );
      }
      return (
        <g fill="none" stroke="#ffd36b" strokeWidth={5} strokeLinecap="round">
          <circle cx={cx - 6} cy={cy + 6} r={9} fill="#ffd36b" />
          <path d={`M${cx - 24} ${cy + 8} A20 20 0 1 1 ${cx + 20} ${cy - 18}`} />
          <path d={`M${cx + 8} ${cy - 22} L${cx + 22} ${cy - 20} L${cx + 22} ${cy - 6}`} />
        </g>
      );
    case 'gate':
      return (
        <g>
          <rect x={cx - 22} y={cy - 26} width={44} height={52} rx={22} fill="#3a0f4f" stroke="#ff6bf0" strokeWidth={5} />
          <rect x={cx - 11} y={cy - 15} width={22} height={30} rx={11} fill="#ffb3f6" opacity={0.75} />
        </g>
      );
    case 'mystery':
      return (
        <g>
          <rect x={cx - 20} y={cy - 26} width={40} height={52} rx={7} fill="#2f2a7a" stroke="#b9b2ff" strokeWidth={4} />
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={34} fontWeight={900} fill="#fff">?</text>
        </g>
      );
    case 'nebula':
      return (
        <g fill="#c58bff" opacity={0.45}>
          <ellipse cx={cx - 10} cy={cy} rx={20} ry={13} />
          <ellipse cx={cx + 12} cy={cy - 6} rx={16} ry={11} />
          <ellipse cx={cx + 6} cy={cy + 10} rx={14} ry={9} />
        </g>
      );
  }
}

/** A wavy "spaghetti" line for a black hole, or a smooth tunnel for a wormhole. */
function linkPath(from: { x: number; y: number }, to: { x: number; y: number }, wavy: boolean) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const [nx, ny] = [-dy / length, dx / length];
  if (!wavy) {
    const bend = Math.min(60, length * 0.18);
    const mx = (from.x + to.x) / 2 + nx * bend;
    const my = (from.y + to.y) / 2 + ny * bend;
    return `M${from.x} ${from.y} Q${mx.toFixed(1)} ${my.toFixed(1)} ${to.x} ${to.y}`;
  }
  const waves = Math.max(2, Math.round(length / 70));
  const points: string[] = [];
  for (let i = 0; i <= waves * 8; i++) {
    const t = i / (waves * 8);
    const wobble = Math.sin(t * waves * Math.PI * 2) * 12 * Math.sin(t * Math.PI);
    points.push(`${(from.x + dx * t + nx * wobble).toFixed(1)},${(from.y + dy * t + ny * wobble).toFixed(1)}`);
  }
  return `M${points.join(' L')}`;
}

/** The starfield behind the board: the same every time. */
const STARS = (() => {
  const random = randomFromSeed('starfield');
  return Array.from({ length: 140 }, () => ({ x: random() * 1000, y: random() * 1000, r: 0.8 + random() * 2.2, o: 0.3 + random() * 0.6 }));
})();

const BoardDrawing = memo(function BoardDrawing({ board, size }: { board: Board; size: BoardSize }) {
  const rows = size / ROW_LENGTH;
  const height = rows * CELL;
  const entries = Object.entries(board.squares).map(([n, sq]) => [Number(n), sq] as const);
  const gates = entries.filter(([n, sq]) => sq.kind === 'gate' && n < sq.twin);
  return (
    <>
      <defs>
        <radialGradient id="space-bg" cx="30%" cy="20%" r="100%">
          <stop offset="0" stopColor="#2c1f6b" />
          <stop offset="0.55" stopColor="#141038" />
          <stop offset="1" stopColor="#07061a" />
        </radialGradient>
        <radialGradient id="space-nebula" cx="75%" cy="70%" r="45%">
          <stop offset="0" stopColor="#d4427a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#d4427a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="space-station" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset="1" stopColor="#ffb703" />
        </radialGradient>
      </defs>
      <rect width={1000} height={height} fill="url(#space-bg)" />
      <rect width={1000} height={height} fill="url(#space-nebula)" />
      {STARS.filter((s) => s.y < height).map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      ))}
      {Array.from({ length: size }, (_, i) => {
        const n = i + 1;
        const { row, col } = squareXY(n, size);
        return (
          <rect
            key={n}
            x={col * CELL + 3}
            y={row * CELL + 3}
            width={CELL - 6}
            height={CELL - 6}
            rx={14}
            className="space-square"
            fill={(row + col) % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(150,140,255,0.11)'}
          />
        );
      })}
      {/* Earth and the space station */}
      {(() => {
        const earth = centre(1, size);
        const station = centre(size, size);
        return (
          <>
            <circle cx={earth.x} cy={earth.y + 6} r={30} fill="#2f8fff" stroke="#bfe0ff" strokeWidth={3} />
            <path d={`M${earth.x - 20} ${earth.y - 4} q12 -10 22 0 q8 8 -4 14 q-10 4 -18 -4 Z M${earth.x + 8} ${earth.y + 16} q10 -4 16 4 q-6 10 -16 6 Z`} fill="#3ddc84" />
            <rect x={station.x - 36} y={station.y - 4} width={72} height={10} rx={3} fill="#9fb4d8" />
            <circle cx={station.x} cy={station.y + 1} r={20} fill="url(#space-station)" stroke="#fff" strokeWidth={3} />
            <rect x={station.x - 44} y={station.y - 18} width={14} height={38} rx={3} fill="#5c8dd6" stroke="#cfe0ff" strokeWidth={2} />
            <rect x={station.x + 30} y={station.y - 18} width={14} height={38} rx={3} fill="#5c8dd6" stroke="#cfe0ff" strokeWidth={2} />
          </>
        );
      })()}
      {/* Links first, so the squares' pictures sit on top */}
      <g className="space-links" pointerEvents="none">
        {entries.map(([n, sq]) => {
          if (sq.kind !== 'wormhole' && sq.kind !== 'black-hole') return null;
          const from = centre(n, size);
          const to = centre(sq.to, size);
          const wavy = sq.kind === 'black-hole';
          const d = linkPath(from, to, wavy);
          return (
            <g key={n}>
              {wavy ? (
                <>
                  <path d={d} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={14} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#ff8a3d" strokeOpacity={0.6} strokeWidth={6} strokeLinecap="round" />
                </>
              ) : (
                <>
                  <path d={d} fill="none" stroke="#3ff2e0" strokeOpacity={0.16} strokeWidth={22} strokeLinecap="round" />
                  <path d={d} fill="none" stroke="#7ffcf0" strokeOpacity={0.75} strokeWidth={5} strokeDasharray="2 12" strokeLinecap="round" />
                </>
              )}
              <circle cx={to.x} cy={to.y} r={9} fill={wavy ? '#ff8a3d' : '#7ffcf0'} stroke="#07061a" strokeWidth={3} />
            </g>
          );
        })}
        {gates.map(([n, sq]) => {
          const a = centre(n, size);
          const b = centre((sq as { twin: number }).twin, size);
          return <path key={n} d={linkPath(a, b, false)} fill="none" stroke="#ff6bf0" strokeOpacity={0.55} strokeWidth={4} strokeDasharray="10 10" />;
        })}
      </g>
      {entries.map(([n, sq]) => {
        const c = centre(n, size);
        return <SquareIcon key={n} square={sq} cx={c.x} cy={c.y + 6} />;
      })}
      {Array.from({ length: size }, (_, i) => {
        const n = i + 1;
        const { row, col } = squareXY(n, size);
        return (
          <text key={n} x={col * CELL + 11} y={row * CELL + 27} className="space-square__number">
            {n}
          </text>
        );
      })}
    </>
  );
});

function Rocket({ seat, fx, isTurn, style, target, onTarget, bubble }: {
  seat: Seat;
  fx: RocketFx;
  isTurn: boolean;
  style: CSSProperties;
  target: boolean;
  onTarget?: () => void;
  /** An emoji reaction popping up over the rocket for a moment. */
  bubble?: string | null;
}) {
  const className = ['rocket', fx && `fx-${fx}`, isTurn && 'is-turn', target && 'is-target'].filter(Boolean).join(' ');
  const body = (
    <svg viewBox="0 0 60 100" className="rocket__svg" aria-hidden="true">
      <path className="rocket__flame" d="M20 76 Q30 112 40 76 Z" fill={seat.colour} />
      <path className="rocket__flame" d="M25 76 Q30 98 35 76 Z" fill="#fff3a6" />
      <path d="M12 50 L2 80 L16 72 Z M48 50 L58 80 L44 72 Z" fill={seat.colour} stroke="#14112e" strokeWidth={3} strokeLinejoin="round" />
      <path d="M30 3 C47 18 51 44 47 74 L13 74 C9 44 13 18 30 3 Z" fill="#f4f2ff" stroke="#14112e" strokeWidth={3} strokeLinejoin="round" />
      <path d="M30 3 C38 10 43 18 45 26 L15 26 C17 18 22 10 30 3 Z" fill={seat.colour} stroke="#14112e" strokeWidth={3} strokeLinejoin="round" />
      <circle cx={30} cy={40} r={14.5} fill="#14112e" />
      <g transform="translate(17 27)">
        <AvatarImage avatar={seat.avatar} size={26} />
      </g>
      <circle cx={30} cy={40} r={14.5} fill="none" stroke={seat.colour} strokeWidth={3} />
      <ShapePath shape={seat.shape} cx={30} cy={63} r={7} fill={seat.colour} />
    </svg>
  );
  const pop = bubble ? (
    <span key={bubble} className="rocket__bubble">
      {bubble}
    </span>
  ) : null;
  if (target) {
    return (
      <button type="button" className={className} style={style} tabIndex={-1} aria-label={`Aim at ${seat.name}`} onClick={onTarget}>
        {body}
        {pop}
      </button>
    );
  }
  return (
    <div className={className} style={style} aria-hidden="true">
      {body}
      {pop}
    </div>
  );
}

/** Where each rocket sits: in the middle of its square, or in a corner if it's sharing. */
function rocketPlaces(positions: readonly number[], size: BoardSize) {
  const rows = size / ROW_LENGTH;
  return positions.map((n, seat) => {
    const { row, col } = squareXY(Math.min(size, Math.max(1, n)), size);
    const sharing = positions.map((p, i) => [p, i] as const).filter(([p]) => p === n).map(([, i]) => i);
    const alone = sharing.length === 1;
    const slot = sharing.indexOf(seat);
    const [ox, oy] = alone ? [0.5, 0.5] : [[0.3, 0.32], [0.7, 0.32], [0.3, 0.72], [0.7, 0.72]][slot];
    return {
      left: `${((col + ox) / ROW_LENGTH) * 100}%`,
      top: `${((row + oy) / rows) * 100}%`,
      width: alone ? '7.2%' : '4.6%',
      z: alone ? 2 : 3 + slot,
    };
  });
}

export function SpaceBoard({
  state,
  seats,
  positions,
  fx,
  moveMs,
  turn,
  targets,
  onTarget,
  onSquare,
  selected,
  label,
  bubbles,
}: {
  state: SpaceState;
  seats: readonly Seat[];
  positions: readonly number[];
  fx: readonly RocketFx[];
  moveMs: readonly number[];
  turn: number | null;
  /** Rockets the student can aim at right now (tap to pick). */
  targets: readonly number[];
  onTarget: (seat: number) => void;
  onSquare: (n: number) => void;
  selected: number | null;
  label: string;
  /** Emoji reactions to show over rockets (classmates games). */
  bubbles?: readonly (string | null)[];
}) {
  const { board } = state;
  const size = board.size;
  const rows = size / ROW_LENGTH;
  const height = rows * CELL;
  const places = rocketPlaces(positions, size);
  const tail = state.comet ? cometTail(state.comet).filter((n) => n >= 2) : [];

  function click(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const n = squareAt((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height, size);
    if (n) onSquare(n);
  }

  return (
    <div className="space-board" style={{ aspectRatio: `${ROW_LENGTH} / ${rows}` } as CSSProperties}>
      <svg viewBox={`0 0 1000 ${height}`} className="space-board__svg" role="img" aria-label={label} onClick={click}>
        <BoardDrawing board={board} size={size} />
        {/* Things that change during a game */}
        {state.comet && (
          <g className="space-comet" pointerEvents="none">
            <polyline
              points={[...tail].reverse().concat(state.comet.head).map((n) => { const c = centre(n, size); return `${c.x},${c.y}`; }).join(' ')}
              fill="none" stroke="#bdf3ff" strokeOpacity={0.35} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round"
            />
            {(() => { const c = centre(state.comet.head, size); return (
              <>
                <circle cx={c.x} cy={c.y} r={22} fill="#e6fbff" opacity={0.5} />
                <circle cx={c.x} cy={c.y} r={13} fill="#ffffff" stroke="#7fe3ff" strokeWidth={4} />
              </>
            ); })()}
          </g>
        )}
        {state.asteroids.map((n) => {
          const c = centre(n, size);
          return (
            <g key={`a${n}`} className="space-asteroid" pointerEvents="none">
              <path d={`M${c.x - 24} ${c.y + 2} L${c.x - 12} ${c.y - 20} L${c.x + 10} ${c.y - 22} L${c.x + 26} ${c.y - 4} L${c.x + 18} ${c.y + 20} L${c.x - 10} ${c.y + 22} Z`} fill="#8c8278" stroke="#3b342d" strokeWidth={4} />
              <circle cx={c.x - 4} cy={c.y - 4} r={5} fill="#5e554c" />
              <circle cx={c.x + 10} cy={c.y + 8} r={4} fill="#5e554c" />
            </g>
          );
        })}
        {state.mines.map((m) => {
          const c = centre(m.square, size);
          return (
            <g key={`m${m.square}`} className="space-mine" pointerEvents="none">
              <polygon points={starPoints(c.x + 26, c.y - 24, 8, 17, 10)} fill="#ff3b3b" stroke="#2b0000" strokeWidth={3} />
              <circle cx={c.x + 26} cy={c.y - 24} r={6} fill="#ffd0d0" />
              <ShapePath shape={seats[m.owner].shape} cx={c.x + 26} cy={c.y + 2} r={7} fill={seats[m.owner].colour} />
            </g>
          );
        })}
        {selected !== null && (() => {
          const { row, col } = squareXY(selected, size);
          return <rect x={col * CELL + 3} y={row * CELL + 3} width={CELL - 6} height={CELL - 6} rx={14} fill="none" stroke="#ffd23f" strokeWidth={6} pointerEvents="none" />;
        })()}
      </svg>
      {seats.map((seat, i) => (
        <Rocket
          key={i}
          seat={seat}
          fx={fx[i]}
          isTurn={turn === i}
          target={targets.includes(i)}
          onTarget={() => onTarget(i)}
          bubble={bubbles?.[i]}
          style={{
            left: places[i].left,
            top: places[i].top,
            width: places[i].width,
            zIndex: turn === i ? 10 : places[i].z,
            '--move-ms': `${moveMs[i]}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
