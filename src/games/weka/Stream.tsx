/**
 * Weka's stream on the home and finish screens: the far bank with the ten magic stones in a row, the stream, and the
 * friend on the near bank. The light turns to sparkling silver on silver days and a golden evening on gold days.
 */
import type { CSSProperties } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/weka/progress';
import { paint, type Pose } from './art';
import { Friend, Stone } from './WekaArt';

export type Scenery = 'bronze' | 'silver' | 'gold';

const BACK: Record<Scenery, string> = { bronze: 'back/morning', silver: 'back/silver', gold: 'back/evening' };

/** Where the scene's painted background is, if it has been painted, as a CSS value. */
export const backFor = (scenery: Scenery): CSSProperties => {
  const src = paint(BACK[scenery]);
  return src ? ({ '--wk-back': `url("${src}")` } as CSSProperties) : {};
};

interface Props {
  scenery: Scenery;
  stones: { metal: Metal; glow?: boolean }[];
  friend: FriendName;
  pose: Pose;
}

export function Stream({ scenery, stones, friend, pose }: Props) {
  return (
    <div className={`wk-stream wk-stream--${scenery}`} style={backFor(scenery)}>
      <div className="wk-stream__water" aria-hidden="true" />
      <div className="wk-stream__bank">
        {stones.map((s, i) => (
          <span key={i} className="wk-stream__spot">
            <Stone metal={s.metal} glow={s.glow} />
          </span>
        ))}
      </div>
      <span className="wk-stream__friend">
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}
