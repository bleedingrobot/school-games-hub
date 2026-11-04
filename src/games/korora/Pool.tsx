/**
 * Two-Shoes' crossing: ten magic stepping stones in a line across the water, from the near bank on the left to the far
 * bank on the right, where the next pair of dancing shoes waits. Whoever is crossing stands on the last stone that
 * changed. The light turns to sparkling silver on silver days and a golden evening on gold days.
 */
import type { CSSProperties } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/korora/progress';
import { paint, type Pose } from './art';
import { DancingShoes, Friend, Pebble } from './KororaArt';

export type Scenery = 'bronze' | 'silver' | 'gold';

const BACK: Record<Scenery, string> = { bronze: 'back/across-day', silver: 'back/across-silver', gold: 'back/across-evening' };

/** Where the scene's painted background is, if it has been painted, as a CSS value. */
export const backFor = (scenery: Scenery): CSSProperties => {
  const src = paint(BACK[scenery]);
  return src ? ({ '--kr-back': `url("${src}")` } as CSSProperties) : {};
};

/** Stone i's place across the water, in % of the scene: left to right, with a gentle wave so it looks hand-laid. */
export const pebblePlace = (i: number) => ({ x: 15 + i * 7.8, y: 66 + (i % 2 === 0 ? -2 : 2) });

/** Where the walker stands: on the near bank before the first stone, on a stone, or on the far bank with the shoes. */
const standAt = (at: number) => (at < 0 ? { x: 6, y: 56 } : at >= 10 ? { x: 93, y: 56 } : { ...pebblePlace(at), y: pebblePlace(at).y - 3 });

interface Props {
  scenery: Scenery;
  pebbles: { metal: Metal; glow?: boolean }[];
  friend: FriendName;
  pose: Pose;
  /** The stone the walker stands on (-1 the near bank, 10 the far bank). */
  at: number;
  /** The shoes waiting on the far bank, or null when they have just been won (the walker holds them). */
  shoes: Exclude<Metal, 'grey'> | null;
}

export function Pool({ scenery, pebbles, friend, pose, at, shoes }: Props) {
  const stand = standAt(at);
  return (
    <div className={`kr-pool kr-pool--${scenery}`} style={backFor(scenery)}>
      <div className="kr-pool__water" aria-hidden="true" />
      {pebbles.map((p, i) => (
        <span key={i} className="kr-pool__spot" style={{ left: `${pebblePlace(i).x}%`, top: `${pebblePlace(i).y}%` }}>
          <Pebble metal={p.metal} glow={p.glow} />
        </span>
      ))}
      {shoes && (
        <span className="kr-pool__shoes" aria-hidden="true">
          <DancingShoes metal={shoes} />
        </span>
      )}
      <span className="kr-pool__friend" style={{ left: `${stand.x}%`, top: `${stand.y}%` }}>
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}
