/**
 * Four Corners' board (docs/CORNERS-PLAN.md), drawn the same on the big screen and on each pupil's device: the map
 * (painted, or a drawn stand-in for each map), the four coloured corners, the round's hazards, items and avatars.
 * Positions are board units (0 to 1); everything is placed in % of the square board.
 */
import type { ReactNode } from 'react';
import { CORNERS, FOG_SHARE, GRAB_R, gateShut, HOLE_R, MAP_WORDS, POWER_WORDS, rollerAt, rollersOf, TELEPORT_R, ZONE, type Corner, type CornerMap, type MoveRound, type Power } from '../../../shared/classlive/corners';
import { painted } from './paintedArt';
import './corners.css';

export const CORNER_NAMES = ['Red', 'Blue', 'Green', 'Yellow'] as const;
export const CORNER_COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15'] as const;
/** Each map's corner buildings (drawn stand-ins). */
const CORNER_ICONS: Record<CornerMap, string[]> = {
  snow: ['🛖', '🏔️', '🌲', '⛄'],
  jungle: ['🛕', '🌴', '🐍', '🗿'],
  castle: ['🏰', '🦇', '🕯️', '👻'],
  space: ['🛰️', '🪐', '🚀', '👽'],
};

export const powerPic = (p: Power) => painted('corners-fx', `power-${p}`);
export const hazardPic = (map: CornerMap, h: 'storm' | 'ice' | 'hole' | 'roller' | 'teleport') => painted('corners-fx', `${map}-${h}`);

export interface BoardRound extends MoveRound {
  startAt: number;
  fog: boolean;
  items: { id: number; x: number; y: number; power: Power }[];
}

const pct = (v: number) => `${v * 100}%`;

/** A circle on the board. */
function Disc({ x, y, r, className, pic, spin, children }: { x: number; y: number; r: number; className: string; pic?: string | null; spin?: number; children?: ReactNode }) {
  return (
    <div className={className} style={{ left: pct(x - r), top: pct(y - r), width: pct(r * 2), height: pct(r * 2), ...(pic ? { backgroundImage: `url(${pic})` } : {}), ...(spin !== undefined ? { transform: `rotate(${spin}deg)` } : {}) }}>
      {children}
    </div>
  );
}

export function CornersBoard({ map, round, t, flash, crystal, banned, children, fogOn, onCorner, cornerLabel = true }: {
  map: CornerMap;
  round: BoardRound | null;
  /** Session time (ms since the start), for the roller, the gate and the fog. */
  t: number;
  /** Corners the dice picked (flashing). */
  flash?: Corner[] | null;
  /** A Crystal ball's safe corner, for this pupil only. */
  crystal?: Corner | null;
  /** Avatars and anything else on the board. */
  children?: ReactNode;
  /** Fog covers the board (the big screen: avatars hide under it). */
  fogOn?: boolean;
  /** Second half: the corner this pupil can't stay in (their pad only). */
  banned?: Corner | null;
  /** Corners become buttons (a Jump). */
  onCorner?: (c: Corner) => void;
  cornerLabel?: boolean;
}) {
  const pic = painted('corners', `map-${map}`);
  const words = MAP_WORDS[map];
  const shut = round ? gateShut(round, t) : false;
  const runShare = round ? (t - round.startAt) / Math.max(1, round.runEnd - round.startAt) : 0;
  const fogShows = !!round?.fog && (fogOn ?? true) && runShare >= 1 - FOG_SHARE && t < round.runEnd + 300;
  return (
    <div className={`fc-board fc-board--${map} ${pic ? 'fc-board--painted' : ''}`} style={pic ? { backgroundImage: `url(${pic})` } : undefined}>
      {!pic && <div className="fc-board__ground" aria-hidden="true" />}
      {CORNERS.map((c) => {
        const flashing = flash?.includes(c);
        const left = c === 0 || c === 3;
        const top = c < 2;
        const style = { left: left ? 0 : pct(1 - ZONE), top: top ? 0 : pct(1 - ZONE), width: pct(ZONE), height: pct(ZONE), ['--cc' as string]: CORNER_COLOURS[c] };
        const cls = `fc-corner fc-corner--${c} ${flashing ? 'fc-corner--hit' : ''} ${crystal === c ? 'fc-corner--crystal' : ''} ${shut && round?.gate === c ? 'fc-corner--shut' : ''} ${banned === c ? 'fc-corner--banned' : ''}`;
        const inner = (
          <>
            {!pic && <span className="fc-corner__icon" aria-hidden="true">{CORNER_ICONS[map][c]}</span>}
            {cornerLabel && <span className="fc-corner__name">{CORNER_NAMES[c]}</span>}
            {crystal === c && <span className="fc-corner__badge" aria-label="Crystal ball: safe here">🔮</span>}
            {banned === c && <span className="fc-corner__ban" aria-label="You were here last round: change corners">🔁</span>}
            {shut && round?.gate === c && <span className="fc-corner__bars" aria-label={`${words.gate} shut`} />}
          </>
        );
        return onCorner
          ? <button key={c} type="button" className={`${cls} fc-corner--btn`} style={style} onClick={() => onCorner(c)} aria-label={`Jump to the ${CORNER_NAMES[c]} corner`}>{inner}</button>
          : <div key={c} className={cls} style={style} aria-label={`${CORNER_NAMES[c]} corner`}>{inner}</div>;
      })}
      {round?.hole && <Disc x={0.5} y={0.5} r={HOLE_R} className="fc-hole" pic={hazardPic(map, 'hole')} />}
      {round?.storms.map((s, i) => <Disc key={`s${i}`} {...s} className="fc-storm" pic={hazardPic(map, 'storm')}><i /><i /><i /></Disc>)}
      {round?.ice.map((s, i) => <Disc key={`i${i}`} {...s} className="fc-ice" pic={hazardPic(map, 'ice')} />)}
      {round?.teleports.map((tp, i) => (
        <span key={`t${i}`}>
          <Disc x={tp.a.x} y={tp.a.y} r={TELEPORT_R * 1.4} className="fc-warp" pic={hazardPic(map, 'teleport')} />
          <Disc x={tp.b.x} y={tp.b.y} r={TELEPORT_R * 1.4} className="fc-warp fc-warp--b" pic={hazardPic(map, 'teleport')} />
        </span>
      ))}
      {round?.items.map((it) => (
        <Disc key={`it${it.id}`} x={it.x} y={it.y} r={GRAB_R * 0.7} className="fc-item">
          {powerPic(it.power) ? <img src={powerPic(it.power) as string} alt="" /> : <span aria-hidden="true">{POWER_WORDS[it.power].emoji}</span>}
        </Disc>
      ))}
      {round && rollersOf(round).map((ro, i) => {
        const p = rollerAt(ro, t);
        // Turns as it rolls (one turn per 2πr of board crossed).
        const spin = (((ro.axis === 'x' ? p.x : p.y) / (2 * Math.PI * ro.r)) * 360) % 360;
        return <Disc key={`r${i}`} x={p.x} y={p.y} r={ro.r} className="fc-roller" pic={hazardPic(map, 'roller')} spin={spin} />;
      })}
      <div className="fc-board__people">{children}</div>
      {fogShows && <div className="fc-fog" aria-label={words.fog} />}
    </div>
  );
}

/** One avatar on the board (placed by the caller in board units). */
export function Token({ x, y, size, children, className = '', label }: { x: number; y: number; size: number; children: ReactNode; className?: string; label?: string | null }) {
  return (
    <div className={`fc-token ${className}`} style={{ left: pct(x), top: pct(y), width: pct(size), height: pct(size) }}>
      <div className="fc-token__body">{children}</div>
      {label && <span className="fc-token__name">{label}</span>}
    </div>
  );
}
