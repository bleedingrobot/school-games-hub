/**
 * Glitches' factory floor (docs/CREW-PLAN.md), drawn the same on the big screen and on each pupil's device: the
 * painted map (or a drawn stand-in), the Canteen in the middle, the 8 machines (sparking ones flash, with a fix bar),
 * conveyor belts, power-up crates and, in the dark, a torch circle. Positions are board units (x 0 to w, y 0 to 1), in %
 * of the board, which is w wide and 1 high (widescreen since 27 Nov 2026 NZ; square for older games).
 */
import { createContext, useContext, type ReactNode } from 'react';
import { canteenOf, CONTROL, fixNeed, GRAB_R, machinesOf, POWER_WORDS, type Belt, type CrewPower } from '../../../shared/classlive/crew';
import { painted } from './paintedArt';
import './corners.css';
import './ghost.css';
import './crew.css';

export const crewPic = (name: string) => painted('crew-fx', name);
const pct = (v: number) => `${v * 100}%`;
/** The board's width (height 1), for the tokens and dots drawn on it. */
const Wide = createContext(1);
/** Where a spot goes on a board `w` wide, as CSS left/top. */
export const at = (x: number, y: number, w: number) => ({ left: pct(x / w), top: pct(y) });
/** A circle's box on a board `w` wide. */
const box = (x: number, y: number, r: number, w: number) => ({ left: pct((x - r) / w), top: pct(y - r), width: pct((r * 2) / w), height: pct(r * 2) });

export interface CrewBoardRound {
  machines: { sparked: boolean; fix: number }[];
  belts: Belt[];
  items: { id: number; x: number; y: number; power: CrewPower }[];
}

export function CrewBoard({ w = 1, round, children, highlight = [], dark = null, meeting = false }: {
  /** The factory's width (height 1). */
  w?: number;
  round: CrewBoardRound | null;
  children?: ReactNode;
  /** Machines to mark (a pupil's jobs). */
  highlight?: number[];
  /** Lights out: the spot to light up around (a pupil's device), or 'all' for the big screen's dimmed floor. */
  dark?: { x: number; y: number; r: number } | 'all' | null;
  meeting?: boolean;
}) {
  // The wide factory has its own wide painting (map-factory-wide); the square one, cropped, until then.
  const pic = (w > 1 ? painted('crew', 'map-factory-wide') : null) ?? painted('crew', 'map-factory');
  const canteen = canteenOf(w);
  return (
    <Wide.Provider value={w}>
    <div className={`fc-board sc-board ${w > 1 ? 'sc-board--wide' : ''} ${pic ? 'fc-board--painted' : ''} ${meeting ? 'sc-board--meeting' : ''}`} style={{ aspectRatio: `${w} / 1`, ...(pic ? { backgroundImage: `url(${pic})` } : {}) }}>
      {!pic && <div className="sc-board__ground" aria-hidden="true" />}
      <div className="sc-canteen" style={box(canteen.x, canteen.y, canteen.r, w)}>
        {crewPic('canteen') ? <img src={crewPic('canteen') as string} alt="" /> : <span aria-hidden="true">🍽️</span>}
        <small>Canteen</small>
      </div>
      {round?.belts.map((b, i) => (
        <div key={`b${i}`} className={`sc-belt ${b.dx < 0 ? 'sc-belt--left' : ''}`} style={{ left: pct(b.x / w), top: pct(b.y), width: pct(b.w / w), height: pct(b.h) }} aria-label="Conveyor belt" />
      ))}
      {machinesOf(w).map((mc) => {
        const st = round?.machines[mc.id];
        const sparked = !!st?.sparked;
        const own = crewPic(`machine-${mc.key}${sparked ? '-broken' : ''}`) ?? crewPic(`machine-${mc.key}`);
        return (
          <div key={mc.id} className={`sc-machine ${mc.big ? 'sc-machine--big' : ''} ${sparked ? 'sc-machine--sparked' : ''} ${highlight.includes(mc.id) ? 'sc-machine--job' : ''}`}
            style={box(mc.x, mc.y, mc.r, w)}>
            {own ? <img src={own} alt="" /> : <span className="sc-machine__emoji" aria-hidden="true">{mc.emoji}</span>}
            {sparked && <span className="sc-machine__sparks" aria-hidden="true">⚡</span>}
            {sparked && (
              <span className="sc-machine__fix" aria-label={`Fixing: ${st?.fix ?? 0} of ${fixNeed(mc)}`}>
                {Array.from({ length: fixNeed(mc) }, (_, i) => <i key={i} className={i < (st?.fix ?? 0) ? 'on' : ''} />)}
              </span>
            )}
            <small className="sc-machine__name">{mc.id === CONTROL ? '💡 ' : ''}{mc.room}</small>
          </div>
        );
      })}
      {round?.items.map((it) => (
        <div key={`it${it.id}`} className="fc-item sc-item" style={box(it.x, it.y, GRAB_R * 0.8, w)}>
          {crewPic(`power-${it.power}`) ? <img src={crewPic(`power-${it.power}`) as string} alt="" /> : <span aria-hidden="true">📦{POWER_WORDS[it.power].emoji}</span>}
        </div>
      ))}
      <div className="fc-board__people">{children}</div>
      {dark === 'all' && <div className="sc-dark sc-dark--all" aria-label="Lights out" />}
      {dark && dark !== 'all' && (
        <div className="sc-dark" aria-label="Lights out" style={{ background: w > 1
          // On the wide board the torch is a true circle dark.r across (an ellipse sized in % of the board's width and height).
          ? `radial-gradient(${pct(dark.r / w)} ${pct(dark.r)} at ${pct(dark.x / w)} ${pct(dark.y)}, transparent 100%, rgba(2, 6, 23, 0.94) 120%)`
          : `radial-gradient(circle at ${pct(dark.x)} ${pct(dark.y)}, transparent ${dark.r * 100}%, rgba(2, 6, 23, 0.94) ${dark.r * 100 + 4}%)` }} />
      )}
    </div>
    </Wide.Provider>
  );
}

/** A player on the board: their avatar in a hard hat, or as a little hover drone once voted off. */
export function CrewToken({ x, y, size, drone, children, className = '', label }: {
  x: number; y: number; size: number; drone: boolean; children: ReactNode; className?: string; label?: string | null;
}) {
  const w = useContext(Wide);
  return (
    <div className={`fc-token sc-token ${drone ? 'sc-token--drone' : ''} ${className}`} style={{ ...at(x, y, w), width: pct(size / w), height: pct(size) }}>
      <div className="fc-token__body">{children}</div>
      {drone && (crewPic('drone') ? <img className="sc-token__drone" src={crewPic('drone') as string} alt="" /> : <span className="sc-token__drone sc-token__drone--emoji" aria-hidden="true">🛸</span>)}
      {label && <span className="fc-token__name">{label}</span>}
    </div>
  );
}
