/**
 * Musical Thrones' hall (docs/THRONES-PLAN.md), drawn the same on the big screen and on each pupil's device: the hall
 * (painted, or a drawn stand-in for each hall), lit dance tiles, thrones (sheeted while the music plays, glowing when it
 * stops), items, hazards and avatars. Positions are board units (x 0 to w, y 0 to 1), placed in % of the hall, which is
 * w wide and 1 high (widescreen since 27 Nov 2026; square for older games). On the square hall the courtyard strip (when
 * asked for) hangs below it, so avatars sent there sit at y > 1; on a wide hall the courtyard is a panel beside it
 * (ThronesScene), so the board never draws one.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { GRAB_R, rollerAt, rollersOf, TELEPORT_R, type Circle, type Roller, type Teleport } from '../../../shared/classlive/corners';
import { HALL_WORDS, POWER_WORDS, THRONE_R, type Hall, type ThronePower } from '../../../shared/classlive/thrones';
import { painted } from './paintedArt';
import './corners.css';
import './thrones.css';


/** The hall's painting: a wide one (hall-<hall>-wide) for a wide hall, else the square one (cropped to fit). */
export const throneHall = (hall: Hall, w = 1) => (w > 1 ? painted('thrones', `hall-${hall}-wide`) : null) ?? painted('thrones', `hall-${hall}`);
export const thronePowerPic = (p: ThronePower) => painted('thrones-fx', `power-${p}`);
export const throneHazardPic = (hall: Hall, h: 'storm' | 'ice' | 'roller' | 'teleport') => painted('thrones-fx', `${hall}-${h}`);

export interface BoardThrone { id: number; x: number; y: number; golden: boolean; taken: boolean }

export interface ThronesBoardRound {
  thrones: BoardThrone[];
  tiles: Circle[];
  items: { id: number; x: number; y: number; power: ThronePower }[];
  storms: Circle[];
  ice: Circle[];
  teleports: Teleport[];
  roller: Roller | null;
  roller2: Roller | null;
  /** Trick thrones with little eyes (they pop up with the real ones and bite). */
  mimics?: { id: number; x: number; y: number; ate: number }[];
}

const pct = (v: number) => `${v * 100}%`;
/** The hall's width (height 1), for the tokens and dots drawn on it. */
const Wide = createContext(1);
export const useHallW = () => useContext(Wide);
/** Where a spot goes on the hall, as CSS left/top. */
export const at = (x: number, y: number, w: number) => ({ left: pct(x / w), top: pct(y) });

/** One avatar on the hall (placed by the caller in board units). */
export function Token({ x, y, size, children, className = '', label }: { x: number; y: number; size: number; children: ReactNode; className?: string; label?: string | null }) {
  const w = useContext(Wide);
  return (
    <div className={`fc-token ${className}`} style={{ ...at(x, y, w), width: pct(size / w), height: pct(size) }}>
      <div className="fc-token__body">{children}</div>
      {label && <span className="fc-token__name">{label}</span>}
    </div>
  );
}
/** Thrones are drawn this much bigger than the sitting circle, so they read from the back of the room. */
const THRONE_SCALE = 1.5;

function Disc({ x, y, r, className, pic, spin, children }: { x: number; y: number; r: number; className: string; pic?: string | null; spin?: number; children?: ReactNode }) {
  const w = useContext(Wide);
  return (
    <div className={className} style={{ left: pct((x - r) / w), top: pct(y - r), width: pct((r * 2) / w), height: pct(r * 2), ...(pic ? { backgroundImage: `url(${pic})` } : {}), ...(spin !== undefined ? { transform: `rotate(${spin}deg)` } : {}) }}>
      {children}
    </div>
  );
}

export function ThronesBoard({ hall, w = 1, round, t, covered, crowned, chomping, mySeat, courtLabel, courtCount, children }: {
  hall: Hall;
  /** The hall's width (height 1). */
  w?: number;
  round: ThronesBoardRound | null;
  /** Session time (ms since the start), for the rollers. */
  t: number;
  /** The music is playing: thrones are under sheets. */
  covered: boolean;
  /** Mimics that just ate someone (their teeth snap). */
  chomping?: number[];
  /** Thrones that just got a king or queen (a crown pops over them). */
  crowned?: number[];
  /** The throne this pupil sits on (their pad). */
  mySeat?: number | null;
  /** Show the courtyard strip below the (square) hall, with this name. A wide hall has none: its courtyard is a side panel. */
  courtLabel?: string | null;
  courtCount?: number;
  /** Avatars and pops on the board (and below it, in the courtyard). */
  children?: ReactNode;
}) {
  const pic = throneHall(hall, w);
  const wide = w > 1;
  if (wide) courtLabel = null;
  const words = HALL_WORDS[hall];
  const size = THRONE_R * 2 * THRONE_SCALE;
  const courtPic = painted('thrones', `court-${hall}`);
  return (
    <Wide.Provider value={w}>
    <div className={`mt-hall ${courtLabel ? 'mt-hall--court' : ''} ${wide ? 'mt-hall--wide' : ''}`} style={wide ? { aspectRatio: `${w} / 1`, ['--mt-w' as string]: w } : undefined}>
      <div className={`mt-board mt-board--${hall}`} style={pic ? { backgroundImage: `url(${pic})` } : undefined} aria-label={words.name}>
        {!pic && <div className="mt-board__ground" aria-hidden="true" />}
        {round?.tiles.map((tl, i) => <Disc key={`tl${i}`} {...tl} className="mt-tile" pic={painted('thrones-fx', 'tile')} />)}
        {round?.storms.map((s, i) => <Disc key={`s${i}`} {...s} className="mt-storm" pic={throneHazardPic(hall, 'storm')}><i /><i /><i /></Disc>)}
        {round?.ice.map((s, i) => <Disc key={`i${i}`} {...s} className="mt-ice" pic={throneHazardPic(hall, 'ice')} />)}
        {round?.teleports.map((tp, i) => (
          <span key={`t${i}`}>
            <Disc x={tp.a.x} y={tp.a.y} r={TELEPORT_R * 1.4} className="mt-warp" pic={throneHazardPic(hall, 'teleport')} />
            <Disc x={tp.b.x} y={tp.b.y} r={TELEPORT_R * 1.4} className="mt-warp mt-warp--b" pic={throneHazardPic(hall, 'teleport')} />
          </span>
        ))}
        {/* While the music plays there are no thrones: they appear in new spots when it stops (thrones.ts scatterThrones). */}
        {!covered && round?.thrones.map((th) => {
          const img = painted('thrones-fx', th.golden ? 'throne-gold' : 'throne');
          const mine = mySeat === th.id;
          const cls = `mt-throne ${th.golden ? 'mt-throne--gold' : ''} ${covered ? 'mt-throne--covered' : 'mt-throne--lit'} ${th.taken ? 'mt-throne--taken' : ''} ${mine ? 'mt-throne--mine' : ''}`;
          return (
            <div key={`th${th.id}`} className={cls} style={{ left: pct((th.x - size / 2) / w), top: pct(th.y - size / 2), width: pct(size / w), height: pct(size) }} aria-label={th.golden ? 'Golden throne' : 'Throne'}>
              <div className="mt-throne__seat">
                {img ? <img src={img} alt="" /> : <span className="mt-throne__emoji" aria-hidden="true">{th.golden && <i className="mt-throne__crown">👑</i>}🪑</span>}
              </div>
              {covered && <span className="mt-throne__sheet" aria-hidden="true" />}
              {th.taken && !covered && !mine && <span className="mt-throne__tag">taken</span>}
              {crowned?.includes(th.id) && <span className="mt-throne__pop" aria-hidden="true">{th.golden ? '👑👑👑' : '👑'}</span>}
            </div>
          );
        })}
        {!covered && round?.mimics?.map((mm) => {
          const bit = mm.ate > 0 || !!chomping?.includes(mm.id);
          const img = painted('thrones-fx', bit ? 'mimic-bite' : 'mimic') ?? painted('thrones-fx', 'throne');
          const own = !!painted('thrones-fx', 'mimic');
          return (
            <div key={`mm${mm.id}`} className={`mt-throne mt-throne--lit mt-mimic ${bit ? 'mt-mimic--bite' : ''} ${chomping?.includes(mm.id) ? 'mt-mimic--chomp' : ''}`} style={{ left: pct((mm.x - size / 2) / w), top: pct(mm.y - size / 2), width: pct(size / w), height: pct(size) }} aria-label="Throne">
              <div className="mt-throne__seat">
                {img ? <img src={img} alt="" /> : <span className="mt-throne__emoji" aria-hidden="true">🪑</span>}
              </div>
              {!own && <span className="mt-mimic__eyes" aria-hidden="true"><i /><i /></span>}
              {!own && bit && <span className="mt-mimic__teeth" aria-hidden="true" />}
            </div>
          );
        })}
        {round?.items.map((it) => {
          const img = thronePowerPic(it.power);
          return (
            <Disc key={`it${it.id}`} x={it.x} y={it.y} r={GRAB_R * 0.7} className="mt-item">
              {img ? <img src={img} alt="" /> : <span aria-hidden="true">{POWER_WORDS[it.power].emoji}</span>}
            </Disc>
          );
        })}
        {round && rollersOf(round).map((ro, i) => {
          const p = rollerAt(ro, t);
          const spin = (((ro.axis === 'x' ? p.x : p.y) / (2 * Math.PI * ro.r)) * 360) % 360;
          return <Disc key={`r${i}`} x={p.x} y={p.y} r={ro.r} className="mt-roller" pic={throneHazardPic(hall, 'roller')} spin={spin} />;
        })}
      </div>
      {courtLabel && (
        <div className={`mt-court mt-court--${hall}`} style={courtPic ? { backgroundImage: `url(${courtPic})` } : undefined} aria-label={courtLabel}>
          <span className="mt-court__label">🔒 {courtLabel}{courtCount !== undefined && <b>{courtCount}</b>}</span>
        </div>
      )}
      <div className="mt-board__people">{children}</div>
    </div>
    </Wide.Provider>
  );
}
