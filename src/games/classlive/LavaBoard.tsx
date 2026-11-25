/**
 * Floor is Lava's floor (docs/LAVA-PLAN.md), drawn the same on the big screen and on each pupil's device: a lake of
 * lava (painted, or a drawn stand-in) under a grid of rock tiles. Tiles glow before they sink, shake and crack when the
 * run ends, and leave lava behind for two rounds; frozen tiles shine blue. Positions are board units (0 to 1).
 */
import type { ReactNode } from 'react';
import { fireballAt, GRAB_R, GRID, isLava, LATE_MS, LAVA_POWER_WORDS, LAVA_WORDS, sinking, TILES, type LavaMap, type LavaPower, type LavaRound } from '../../../shared/classlive/lava';
import { painted } from './paintedArt';
import './corners.css';
import './lava.css';

export const lavaPowerPic = (p: LavaPower) => painted('lava-fx', `power-${p}`);
export const lavaFxPic = (map: LavaMap, h: 'bubbles' | 'crust' | 'fireball' | 'raft') => painted('lava-fx', `${map}-${h}`);

/** What the floor needs of a round (the pupils' copy has these). */
export type FloorRound = Pick<LavaRound, 'n' | 'startAt' | 'runEnd' | 'crackEnd' | 'showEnd' | 'glow' | 'late' | 'frozen' | 'bubbles' | 'crust' | 'fireball'> & {
  items: { id: number; x: number; y: number; power: LavaPower }[];
  /** The run has ended (the floor cracked). */
  ended: boolean;
};

const pct = (v: number) => `${v * 100}%`;

function Disc({ x, y, r, className, pic, children, spin }: { x: number; y: number; r: number; className: string; pic?: string | null; children?: ReactNode; spin?: number }) {
  return (
    <div className={className} style={{ left: pct(x - r), top: pct(y - r), width: pct(r * 2), height: pct(r * 2), ...(pic ? { backgroundImage: `url(${pic})` } : {}), ...(spin !== undefined ? { transform: `rotate(${spin}deg)` } : {}) }}>
      {children}
    </div>
  );
}

/** Each tile's look right now. */
export function tileLooks(sunk: number[], r: FloorRound | null, t: number): string[] {
  const n = r?.n ?? 0;
  const sinkingNow = new Set(r && r.ended ? sinking(r) : []);
  const glowNow = new Set(r && !r.ended ? [...r.glow, ...(t >= r.runEnd - LATE_MS ? r.late : [])] : []);
  const frozen = new Set(r?.frozen ?? []);
  return Array.from({ length: TILES }, (_, i) => {
    if (r && r.ended && sinkingNow.has(i)) return t < r.crackEnd ? 'is-cracking' : 'is-lava';
    if (n > 0 && isLava({ sunk }, i, n)) return sunk[i] === n ? 'is-lava is-cooling' : 'is-lava';
    if (frozen.has(i)) return 'is-frozen';
    if (glowNow.has(i)) {
      // Faster pulsing near the end.
      const left = r ? r.runEnd - t : 9999;
      return left < 2500 ? 'is-glow is-glow--hot' : 'is-glow';
    }
    return '';
  });
}

export function LavaBoard({ map, sunk, round, t, children, onTile, target }: {
  map: LavaMap;
  sunk: number[];
  round: FloorRound | null;
  /** Session time (ms since the start). */
  t: number;
  children?: ReactNode;
  /** Tiles become buttons (the pad: tap lava beside you to build). */
  onTile?: (i: number) => void;
  /** The tile a brick would rebuild (the pad shows it). */
  target?: number | null;
}) {
  const lake = painted('lava', `lake-${map}`);
  const rock = painted('lava', `tile-${map}`);
  const looks = tileLooks(sunk, round, t);
  const words = LAVA_WORDS[map];
  return (
    <div className={`lv-board lv-board--${map} ${lake ? 'lv-board--painted' : ''}`} style={lake ? { backgroundImage: `url(${lake})` } : undefined}>
      {!lake && <div className="lv-lake" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
      <div className="lv-grid" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }} aria-label="The floor">
        {looks.map((look, i) => {
          const cls = `lv-tile ${look} ${rock ? 'lv-tile--painted' : ''} ${target === i ? 'lv-tile--target' : ''}`;
          const style = rock ? { backgroundImage: `url(${rock})`, backgroundPosition: `${((i % GRID) * 37) % 100}% ${((Math.floor(i / GRID)) * 53) % 100}%` } : undefined;
          return onTile && target === i
            ? <button key={i} type="button" className={cls} style={style} onClick={() => onTile(i)} aria-label="Build a bridge here" />
            : <div key={i} className={cls} style={style} />;
        })}
      </div>
      {round?.bubbles.map((b, i) => <Disc key={`b${i}`} {...b} className="lv-bubbles" pic={lavaFxPic(map, 'bubbles')}><i /><i /><i /></Disc>)}
      {round?.crust.map((c, i) => <Disc key={`c${i}`} {...c} className="lv-crust" pic={lavaFxPic(map, 'crust')} />)}
      {round && !round.ended && round.items.map((it) => (
        <Disc key={`it${it.id}`} x={it.x} y={it.y} r={GRAB_R * 0.75} className="lv-item">
          {lavaPowerPic(it.power) ? <img src={lavaPowerPic(it.power) as string} alt="" /> : <span aria-hidden="true">{LAVA_POWER_WORDS[it.power].emoji}</span>}
        </Disc>
      ))}
      {round?.fireball && t < round.runEnd + 200 && (() => {
        const p = fireballAt(round.fireball, t);
        const f = round.fireball;
        const spin = (((f.axis === 'x' ? p.x : p.y) / (2 * Math.PI * f.r)) * 360) % 360;
        return <Disc x={p.x} y={p.y} r={f.r} className="lv-fireball" pic={lavaFxPic(map, 'fireball')} spin={spin} />;
      })()}
      <div className="lv-board__people">{children}</div>
      <span className="lv-sr">{words.name}</span>
    </div>
  );
}

/** Avatars use Four Corners' tokens (and its layout classes in corners.css). */
export { Token as LavaToken } from './CornersBoard';
