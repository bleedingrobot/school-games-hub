/**
 * Ghost Tag's map (docs/GHOST-PLAN.md), drawn the same on the big screen and on each pupil's device: the painted map
 * (or a drawn stand-in), the crypt the ghosts start in, the stones pupils bump into, sticky patches, teleports, the
 * swooping bats and the power-ups. Positions are board units (0 to 1), placed in % of the square board.
 */
import type { ReactNode } from 'react';
import { rollerAt } from '../../../shared/classlive/corners';
import { CRYPT, GRAB_R, MAP_WORDS, POWER_WORDS, TELEPORT_R, type GhostMap, type GhostPower, type MoveRoundG } from '../../../shared/classlive/ghost';
import { painted } from './paintedArt';
import './corners.css';
import './ghost.css';

/** Each map's stand-ins for its stones and teleports. */
const STAND_IN: Record<GhostMap, { stone: string; teleport: string; bats: string; crypt: string }> = {
  graveyard: { stone: '🪦', teleport: '🕳️', bats: '🦇', crypt: '⚰️' },
  mansion: { stone: '🪑', teleport: '🪞', bats: '📚', crypt: '🔥' },
  pumpkin: { stone: '🎃', teleport: '🪵', bats: '🐦‍⬛', crypt: '🧑‍🌾' },
  ship: { stone: '🛢️', teleport: '🚪', bats: '🕊️', crypt: '☸️' },
};

export const ghostPic = (name: string) => painted('ghost-fx', name);
export const powerPicG = (p: GhostPower) => painted('ghost-fx', `power-${p}`);

export interface GhostBoardRound extends MoveRoundG {
  readyAt: number;
  endAt: number;
  fog: boolean;
  items: { id: number; x: number; y: number; power: GhostPower }[];
}

const pct = (v: number) => `${v * 100}%`;

function Disc({ x, y, r, className, pic, children }: { x: number; y: number; r: number; className: string; pic?: string | null; children?: ReactNode }) {
  return (
    <div className={className} style={{ left: pct(x - r), top: pct(y - r), width: pct(r * 2), height: pct(r * 2), ...(pic ? { backgroundImage: `url(${pic})` } : {}) }}>
      {children}
    </div>
  );
}

export function GhostBoard({ map, round, t, children, dark }: {
  map: GhostMap;
  round: GhostBoardRound | null;
  /** Session time (ms since the start), for the bats and the crypt door. */
  t: number;
  children?: ReactNode;
  /** The fog is down (darkens the board; the big screen hides pupils under it). */
  dark?: boolean;
}) {
  const pic = painted('ghost', `map-${map}`);
  const s = STAND_IN[map];
  const open = !round || t >= round.startAt;
  return (
    <div className={`fc-board gt-board gt-board--${map} ${pic ? 'fc-board--painted' : ''}`} style={pic ? { backgroundImage: `url(${pic})` } : undefined}>
      {!pic && <div className="gt-board__ground" aria-hidden="true" />}
      <Disc x={CRYPT.x} y={CRYPT.y} r={CRYPT.r} className={`gt-crypt ${open ? 'gt-crypt--open' : ''}`} pic={ghostPic(`${map}-crypt`)}>
        {!ghostPic(`${map}-crypt`) && <span aria-hidden="true">{s.crypt}</span>}
      </Disc>
      {round?.slows.map((c, i) => <Disc key={`s${i}`} {...c} className="gt-slow" pic={ghostPic(`${map}-slow`)} />)}
      {round?.teleports.map((tp, i) => (
        <span key={`t${i}`}>
          <Disc x={tp.a.x} y={tp.a.y} r={TELEPORT_R * 1.5} className="gt-warp" pic={ghostPic(`${map}-teleport`)}>{!ghostPic(`${map}-teleport`) && <span aria-hidden="true">{s.teleport}</span>}</Disc>
          <Disc x={tp.b.x} y={tp.b.y} r={TELEPORT_R * 1.5} className="gt-warp gt-warp--b" pic={ghostPic(`${map}-teleport`)}>{!ghostPic(`${map}-teleport`) && <span aria-hidden="true">{s.teleport}</span>}</Disc>
        </span>
      ))}
      {round?.stones.map((c, i) => (
        <Disc key={`st${i}`} {...c} className="gt-stone" pic={ghostPic(`${map}-stone`)}>
          {!ghostPic(`${map}-stone`) && <span aria-hidden="true">{s.stone}</span>}
        </Disc>
      ))}
      {round?.items.map((it) => (
        <Disc key={`it${it.id}`} x={it.x} y={it.y} r={GRAB_R * 0.75} className="fc-item gt-item">
          {powerPicG(it.power) ? <img src={powerPicG(it.power) as string} alt="" /> : <span aria-hidden="true">{POWER_WORDS[it.power].emoji}</span>}
        </Disc>
      ))}
      {round?.bats.map((b, i) => {
        const p = rollerAt(b, t);
        return (
          <Disc key={`b${i}`} x={p.x} y={p.y} r={b.r} className="gt-bats" pic={ghostPic(`${map}-bats`)}>
            {!ghostPic(`${map}-bats`) && <span aria-hidden="true">{s.bats}{s.bats}</span>}
          </Disc>
        );
      })}
      <div className="fc-board__people">{children}</div>
      {dark && <div className="gt-fog" aria-label={MAP_WORDS[map].fog} />}
    </div>
  );
}

/** A player on the board: their avatar, dressed as a ghost when they are one. */
export function GhostToken({ x, y, size, ghost, children, className = '', label }: {
  x: number; y: number; size: number; ghost: boolean; children: ReactNode; className?: string; label?: string | null;
}) {
  return (
    <div className={`fc-token gt-token ${ghost ? 'gt-token--ghost' : ''} ${className}`} style={{ left: pct(x), top: pct(y), width: pct(size), height: pct(size) }}>
      <div className="fc-token__body">{children}</div>
      {ghost && (ghostPic('sheet') ? <img className="gt-token__sheet" src={ghostPic('sheet') as string} alt="" /> : <span className="gt-token__sheet gt-token__sheet--emoji" aria-hidden="true">👻</span>)}
      {label && <span className="fc-token__name">{label}</span>}
    </div>
  );
}
