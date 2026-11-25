/**
 * Musical Thrones' hall (docs/THRONES-PLAN.md), drawn the same on the big screen and on each pupil's device: the hall
 * (painted, or a drawn stand-in for each hall), lit dance tiles, thrones (sheeted while the music plays, glowing when it
 * stops), items, hazards and avatars. Positions are board units (0 to 1), placed in % of the square hall. The courtyard
 * strip (when asked for) hangs below the square, so avatars sent there sit at y > 1.
 */
import type { ReactNode } from 'react';
import { GRAB_R, rollerAt, rollersOf, TELEPORT_R, type Circle, type Roller, type Teleport } from '../../../shared/classlive/corners';
import { HALL_WORDS, POWER_WORDS, THRONE_R, type Hall, type ThronePower } from '../../../shared/classlive/thrones';
import { Token } from './CornersBoard';
import { painted } from './paintedArt';
import './corners.css';
import './thrones.css';

export { Token };

export const throneHall = (hall: Hall) => painted('thrones', `hall-${hall}`);
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
/** Thrones are drawn this much bigger than the sitting circle, so they read from the back of the room. */
const THRONE_SCALE = 1.5;

function Disc({ x, y, r, className, pic, spin, children }: { x: number; y: number; r: number; className: string; pic?: string | null; spin?: number; children?: ReactNode }) {
  return (
    <div className={className} style={{ left: pct(x - r), top: pct(y - r), width: pct(r * 2), height: pct(r * 2), ...(pic ? { backgroundImage: `url(${pic})` } : {}), ...(spin !== undefined ? { transform: `rotate(${spin}deg)` } : {}) }}>
      {children}
    </div>
  );
}

export function ThronesBoard({ hall, round, t, covered, crowned, chomping, mySeat, courtLabel, courtCount, children }: {
  hall: Hall;
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
  /** Show the courtyard strip below the hall, with this name. */
  courtLabel?: string | null;
  courtCount?: number;
  /** Avatars and pops on the board (and below it, in the courtyard). */
  children?: ReactNode;
}) {
  const pic = throneHall(hall);
  const words = HALL_WORDS[hall];
  const size = THRONE_R * 2 * THRONE_SCALE;
  const courtPic = painted('thrones', `court-${hall}`);
  return (
    <div className={`mt-hall ${courtLabel ? 'mt-hall--court' : ''}`}>
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
            <div key={`th${th.id}`} className={cls} style={{ left: pct(th.x - size / 2), top: pct(th.y - size / 2), width: pct(size), height: pct(size) }} aria-label={th.golden ? 'Golden throne' : 'Throne'}>
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
            <div key={`mm${mm.id}`} className={`mt-throne mt-throne--lit mt-mimic ${bit ? 'mt-mimic--bite' : ''} ${chomping?.includes(mm.id) ? 'mt-mimic--chomp' : ''}`} style={{ left: pct(mm.x - size / 2), top: pct(mm.y - size / 2), width: pct(size), height: pct(size) }} aria-label="Throne">
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
  );
}
