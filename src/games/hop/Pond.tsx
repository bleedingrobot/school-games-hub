/**
 * The pond at night: the ten magic lily pads in a gentle curve from Hop's bank to the Glow-worm Party on the far bank.
 * The water turns into a silver river on silver days and the bush lights up on gold days (extra scenery: the pads are
 * what to watch, James, 4 Nov 2026).
 */
import type { CSSProperties } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/hop/progress';
import { paint, type Pose } from './art';
import { Friend, LilyPad } from './HopArt';

export type Scenery = 'bronze' | 'silver' | 'gold';

const BACK: Record<Scenery, string> = { bronze: 'back/pond', silver: 'back/river', gold: 'back/forest' };

/** Where the scene's painted background is, if it has been painted, as a CSS value. */
export const backFor = (scenery: Scenery): CSSProperties => {
  const src = paint(BACK[scenery]);
  return src ? ({ '--hp-back': `url("${src}")` } as CSSProperties) : {};
};

interface Props {
  scenery: Scenery;
  pads: { metal: Metal; glow?: boolean }[];
  friend: FriendName;
  pose: Pose;
  /** Where the friend sits: on the near bank (-1), on a pad (0 to 9), or at the party (10). */
  at?: number;
}

/** Pad i's place across the pond, in % of the scene: a gentle wave from bottom left to the far bank on the right. */
export const padPlace = (i: number) => ({ x: 13 + i * 6.8, y: 74 - i * 3.4 + Math.sin(i * 1.1) * 3 });

export function Pond({ scenery, pads, friend, pose, at = -1 }: Props) {
  const party = paint('things/party');
  const place = at < 0 ? { x: 5, y: 76 } : at >= pads.length ? { x: 92, y: 36 } : padPlace(at);
  return (
    <div className={`hp-pond hp-pond--${scenery}`} style={backFor(scenery)}>
      <div className="hp-stars" aria-hidden="true" />
      <div className="hp-bank hp-bank--near" aria-hidden="true" />
      <div className="hp-party" aria-hidden="true">
        {party ? <img src={party} alt="" /> : (
          <>
            <span className="hp-party__cave" />
            {Array.from({ length: 7 }, (_, i) => <span key={i} className="hp-party__thread" style={{ left: `${18 + i * 10}%`, height: `${30 + ((i * 37) % 40)}%` }} />)}
          </>
        )}
      </div>
      {pads.map((p, i) => (
        <span key={i} className="hp-pond__spot" style={{ left: `${padPlace(i).x}%`, top: `${padPlace(i).y}%` }}>
          <LilyPad metal={p.metal} glow={p.glow} />
        </span>
      ))}
      <span className="hp-pond__friend" style={{ left: `${place.x}%`, top: `${place.y}%` }}>
        <Friend friend={friend} pose={pose} />
      </span>
    </div>
  );
}
