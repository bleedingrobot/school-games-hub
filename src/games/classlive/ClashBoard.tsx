/**
 * Colour Clash's board (docs/CLASH-PLAN.md), the same on the big screen and each pupil's device: the map floor (painted,
 * or a drawn stand-in), the tiles in team colours (a canvas, drawn as blobs of wet paint), golden tiles, the round's
 * hazards, power-ups, splats and avatars. Positions are board units (x 0 to w, y 0 to 1), placed in % of the board, which
 * is w wide and 1 high (widescreen since 27 Nov 2026; square for older games).
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { colsOf, FOUNTAIN_R, GRAB_R, GRID, MAP_WORDS, POWER_WORDS, TEAM_WORDS, type ClashMap, type ClashPower, type ClashRound, type Team } from '../../../shared/classlive/clash';
import { rollerAt, TELEPORT_R, type Roller } from '../../../shared/classlive/corners';
import { painted } from './paintedArt';
import './clash.css';

export const teamColour = (t: number) => TEAM_WORDS[(Math.min(4, Math.max(1, t)) as Team)].colour;
export const clashPowerPic = (p: ClashPower) => painted('clash-fx', `power-${p}`);
const hazardPic = (map: ClashMap, h: 'goo' | 'slip' | 'roller' | 'fountain') => painted('clash-fx', `${h}-${map}`);

export type BoardRound = Pick<ClashRound, 'storms' | 'ice' | 'teleports' | 'roller' | 'roller2' | 'hole' | 'golden'> & { items: { id: number; x: number; y: number; power: ClashPower }[] };

const pct = (v: number) => `${v * 100}%`;
/** The board's width (height 1), for the tokens and dots drawn on it. */
const Wide = createContext(1);
export const useBoardW = () => useContext(Wide);
/** Where a spot goes on the board, as CSS left/top. */
export const at = (x: number, y: number, w: number) => ({ left: pct(x / w), top: pct(y) });
const ICONS: Record<ClashMap, string> = { park: '🌳', rooftops: '🏙️', beach: '🏖️', space: '🪐' };

function Disc({ x, y, r, className, pic, spin, children }: { x: number; y: number; r: number; className: string; pic?: string | null; spin?: number; children?: ReactNode }) {
  const w = useContext(Wide);
  return (
    <div className={className} style={{ left: pct((x - r) / w), top: pct(y - r), width: pct((r * 2) / w), height: pct(r * 2), ...(pic ? { backgroundImage: `url(${pic})` } : {}), ...(spin !== undefined ? { transform: `rotate(${spin}deg)` } : {}) }}>
      {children}
    </div>
  );
}

/** The paint, as blobs (each tile a rounded square plus a soft circle, so neighbours run together). */
function Paint({ tiles, w }: { tiles: string; w: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const cell = 20;
    const cols = colsOf(w);
    c.width = cols * cell;
    c.height = GRID * cell;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < cols * GRID; i++) {
      const team = Number(tiles[i] ?? '0');
      if (!team) continue;
      const x = (i % cols) * cell;
      const y = Math.floor(i / cols) * cell;
      ctx.fillStyle = teamColour(team);
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, cell + 2, cell + 2, 5);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.78, 0, Math.PI * 2);
      ctx.fill();
    }
    // A wet shine on top.
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over';
  }, [tiles, w]);
  return <canvas ref={ref} className="cc-paint" aria-hidden="true" />;
}

export interface Splat { key: number; x: number; y: number; r: number; team: number }

export function ClashBoard({ map, w = 1, round, t, tiles, splats, children, dim }: {
  map: ClashMap;
  /** The board's width (height 1). */
  w?: number;
  round: BoardRound | null;
  /** Session time (ms), for the rollers. */
  t: number;
  /** One character a tile ('0' blank, '1' to '4' a team). */
  tiles: string;
  /** Bombs going off just now. */
  splats?: Splat[];
  children?: ReactNode;
  /** Painting is off (ready, counting): the board dims a little. */
  dim?: boolean;
}) {
  // Wide boards have their own wide paintings (map-<map>-wide); the square one, cropped, until then.
  const pic = (w > 1 ? painted('clash', `map-${map}-wide`) : null) ?? painted('clash', `map-${map}`);
  const cols = colsOf(w);
  const gold = painted('clash-fx', 'golden');
  const portal = painted('clash-fx', 'portal');
  const rollers = round ? ([round.roller, round.roller2].filter(Boolean) as Roller[]) : [];
  return (
    <Wide.Provider value={w}>
    <div className={`cc-board cc-board--${map} ${w > 1 ? 'cc-board--wide' : ''} ${pic ? 'cc-board--painted' : ''} ${dim ? 'cc-board--dim' : ''}`} style={{ aspectRatio: `${w} / 1`, ['--cc-cols' as string]: cols, ...(pic ? { backgroundImage: `url(${pic})` } : {}) }} aria-label={MAP_WORDS[map].name}>
      {!pic && <div className="cc-board__ground" aria-hidden="true"><span>{ICONS[map]}</span></div>}
      <Paint tiles={tiles} w={w} />
      {round?.golden.map((i) => (
        <span key={`g${i}`} className={`cc-gold ${gold ? 'cc-gold--painted' : ''}`} style={{ left: pct((i % cols) / cols), top: pct(Math.floor(i / cols) / GRID), width: pct(1 / cols), height: pct(1 / GRID), ...(gold ? { backgroundImage: `url(${gold})` } : {}) }} />
      ))}
      {round?.hole && <Disc x={w / 2} y={0.5} r={FOUNTAIN_R} className="cc-fountain" pic={hazardPic(map, 'fountain')} />}
      {round?.storms.map((s, i) => <Disc key={`s${i}`} {...s} className="cc-goo" pic={hazardPic(map, 'goo')} />)}
      {round?.ice.map((s, i) => <Disc key={`i${i}`} {...s} className="cc-slip" pic={hazardPic(map, 'slip')} />)}
      {round?.teleports.map((tp, i) => (
        <span key={`t${i}`}>
          <Disc x={tp.a.x} y={tp.a.y} r={TELEPORT_R * 1.4} className="cc-portal" pic={portal} />
          <Disc x={tp.b.x} y={tp.b.y} r={TELEPORT_R * 1.4} className="cc-portal cc-portal--b" pic={portal} />
        </span>
      ))}
      {round?.items.map((it) => (
        <Disc key={`it${it.id}`} x={it.x} y={it.y} r={GRAB_R * 0.7} className="cc-item">
          {clashPowerPic(it.power) ? <img src={clashPowerPic(it.power) as string} alt="" /> : <span aria-hidden="true">{POWER_WORDS[it.power].emoji}</span>}
        </Disc>
      ))}
      {rollers.map((ro, i) => {
        const p = rollerAt(ro, t);
        const spin = (((ro.axis === 'x' ? p.x : p.y) / (2 * Math.PI * ro.r)) * 360) % 360;
        return <Disc key={`r${i}`} x={p.x} y={p.y} r={ro.r} className="cc-roller" pic={hazardPic(map, 'roller')} spin={spin} />;
      })}
      {splats?.map((s) => (
        <span key={s.key} className="cc-splat" style={{ ...at(s.x, s.y, w), width: pct((s.r * 2.4) / cols), height: pct((s.r * 2.4) / GRID), ['--tc' as string]: teamColour(s.team) }}>
          <i /><i /><i /><i /><i /><i />
        </span>
      ))}
      <div className="cc-board__people">{children}</div>
    </div>
    </Wide.Provider>
  );
}

/** One avatar on the board, ringed in its team's colour. */
export function ClashToken({ x, y, size, team, children, className = '', label }: { x: number; y: number; size: number; team: number; children: ReactNode; className?: string; label?: string | null }) {
  const w = useContext(Wide);
  return (
    <div className={`cc-token ${className}`} style={{ ...at(x, y, w), width: pct(size / w), height: pct(size), ['--tc' as string]: teamColour(team) }}>
      <div className="cc-token__body">{children}</div>
      {label && <span className="cc-token__name">{label}</span>}
    </div>
  );
}

/** Applies changed tiles to a tiles string. */
export function withTiles(tiles: string, changes: [number, number][]): string {
  if (!changes.length) return tiles;
  const a = tiles.split('');
  for (const [i, team] of changes) if (i >= 0 && i < a.length) a[i] = String(team);
  return a.join('');
}
