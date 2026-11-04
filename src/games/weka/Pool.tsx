/**
 * Weka's rock pool: the ten magic pebbles in a ring around the water, and the friend on the rock. The light turns to
 * sparkling silver on silver days and a golden evening on gold days.
 */
import type { CSSProperties } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/weka/progress';
import { paint, type Pose } from './art';
import { Friend, Pebble } from './WekaArt';

export type Scenery = 'bronze' | 'silver' | 'gold';

const BACK: Record<Scenery, string> = { bronze: 'back/day', silver: 'back/silver', gold: 'back/evening' };

/** Where the scene's painted background is, if it has been painted, as a CSS value. */
export const backFor = (scenery: Scenery): CSSProperties => {
  const src = paint(BACK[scenery]);
  return src ? ({ '--wk-back': `url("${src}")` } as CSSProperties) : {};
};

/** Pebble i's place around the pool, in % of the scene: an oval ring, starting at the friend's rock on the left. */
export const pebblePlace = (i: number) => {
  const a = Math.PI * (0.85 + (i / 10) * 1.3);
  return { x: 50 + Math.cos(a) * 40, y: 66 - Math.sin(a) * 22 };
};

interface Props {
  scenery: Scenery;
  pebbles: { metal: Metal; glow?: boolean }[];
  friend: FriendName;
  pose: Pose;
}

export function Pool({ scenery, pebbles, friend, pose }: Props) {
  return (
    <div className={`wk-pool wk-pool--${scenery}`} style={backFor(scenery)}>
      <div className="wk-pool__water" aria-hidden="true" />
      {pebbles.map((p, i) => (
        <span key={i} className="wk-pool__spot" style={{ left: `${pebblePlace(i).x}%`, top: `${pebblePlace(i).y}%` }}>
          <Pebble metal={p.metal} glow={p.glow} />
        </span>
      ))}
      <span className="wk-pool__friend">
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}
