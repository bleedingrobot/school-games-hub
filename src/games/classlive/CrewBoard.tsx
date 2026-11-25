/**
 * Glitches' factory floor (docs/CREW-PLAN.md), drawn the same on the big screen and on each pupil's device: the
 * painted map (or a drawn stand-in), the Canteen in the middle, the 8 machines (sparking ones flash, with a fix bar),
 * conveyor belts, power-up crates and, in the dark, a torch circle. Positions are board units (0 to 1), in % of the board.
 */
import type { ReactNode } from 'react';
import { CANTEEN, CONTROL, fixNeed, GRAB_R, MACHINES, POWER_WORDS, type Belt, type CrewPower } from '../../../shared/classlive/crew';
import { painted } from './paintedArt';
import './corners.css';
import './ghost.css';
import './crew.css';

export const crewPic = (name: string) => painted('crew-fx', name);
const pct = (v: number) => `${v * 100}%`;

export interface CrewBoardRound {
  machines: { sparked: boolean; fix: number }[];
  belts: Belt[];
  items: { id: number; x: number; y: number; power: CrewPower }[];
}

export function CrewBoard({ round, children, highlight = [], dark = null, meeting = false }: {
  round: CrewBoardRound | null;
  children?: ReactNode;
  /** Machines to mark (a pupil's jobs). */
  highlight?: number[];
  /** Lights out: the spot to light up around (a pupil's device), or 'all' for the big screen's dimmed floor. */
  dark?: { x: number; y: number; r: number } | 'all' | null;
  meeting?: boolean;
}) {
  const pic = painted('crew', 'map-factory');
  return (
    <div className={`fc-board sc-board ${pic ? 'fc-board--painted' : ''} ${meeting ? 'sc-board--meeting' : ''}`} style={pic ? { backgroundImage: `url(${pic})` } : undefined}>
      {!pic && <div className="sc-board__ground" aria-hidden="true" />}
      <div className="sc-canteen" style={{ left: pct(CANTEEN.x - CANTEEN.r), top: pct(CANTEEN.y - CANTEEN.r), width: pct(CANTEEN.r * 2), height: pct(CANTEEN.r * 2) }}>
        {crewPic('canteen') ? <img src={crewPic('canteen') as string} alt="" /> : <span aria-hidden="true">🍽️</span>}
        <small>Canteen</small>
      </div>
      {round?.belts.map((b, i) => (
        <div key={`b${i}`} className={`sc-belt ${b.dx < 0 ? 'sc-belt--left' : ''}`} style={{ left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) }} aria-label="Conveyor belt" />
      ))}
      {MACHINES.map((mc) => {
        const st = round?.machines[mc.id];
        const sparked = !!st?.sparked;
        const own = crewPic(`machine-${mc.key}${sparked ? '-broken' : ''}`) ?? crewPic(`machine-${mc.key}`);
        return (
          <div key={mc.id} className={`sc-machine ${mc.big ? 'sc-machine--big' : ''} ${sparked ? 'sc-machine--sparked' : ''} ${highlight.includes(mc.id) ? 'sc-machine--job' : ''}`}
            style={{ left: pct(mc.x - mc.r), top: pct(mc.y - mc.r), width: pct(mc.r * 2), height: pct(mc.r * 2) }}>
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
        <div key={`it${it.id}`} className="fc-item sc-item" style={{ left: pct(it.x - GRAB_R * 0.8), top: pct(it.y - GRAB_R * 0.8), width: pct(GRAB_R * 1.6), height: pct(GRAB_R * 1.6) }}>
          {crewPic(`power-${it.power}`) ? <img src={crewPic(`power-${it.power}`) as string} alt="" /> : <span aria-hidden="true">📦{POWER_WORDS[it.power].emoji}</span>}
        </div>
      ))}
      <div className="fc-board__people">{children}</div>
      {dark === 'all' && <div className="sc-dark sc-dark--all" aria-label="Lights out" />}
      {dark && dark !== 'all' && (
        <div className="sc-dark" aria-label="Lights out" style={{ background: `radial-gradient(circle at ${pct(dark.x)} ${pct(dark.y)}, transparent ${dark.r * 100}%, rgba(2, 6, 23, 0.94) ${dark.r * 100 + 4}%)` }} />
      )}
    </div>
  );
}

/** A player on the board: their avatar in a hard hat, or as a little hover drone once voted off. */
export function CrewToken({ x, y, size, drone, children, className = '', label }: {
  x: number; y: number; size: number; drone: boolean; children: ReactNode; className?: string; label?: string | null;
}) {
  return (
    <div className={`fc-token sc-token ${drone ? 'sc-token--drone' : ''} ${className}`} style={{ left: pct(x), top: pct(y), width: pct(size), height: pct(size) }}>
      <div className="fc-token__body">{children}</div>
      {drone && (crewPic('drone') ? <img className="sc-token__drone" src={crewPic('drone') as string} alt="" /> : <span className="sc-token__drone sc-token__drone--emoji" aria-hidden="true">🛸</span>)}
      {label && <span className="fc-token__name">{label}</span>}
    </div>
  );
}
