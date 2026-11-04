/**
 * The beach in layered paper: sky, a pōhutukawa on the dune, the sea, and the sand with the ten magic shells along the
 * high-tide line. Morning on bronze days, afternoon on silver days, sunset on gold days.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/pipi/progress';
import { paint, type FriendPose } from './art';
import { Friend, MagicShell } from './PipiArt';

export type Scenery = 'bronze' | 'silver' | 'gold';

const BACK: Record<Scenery, string> = { bronze: 'back/morning', silver: 'back/afternoon', gold: 'back/sunset' };

/** The scene's painted background, if it has been painted, as a CSS value. */
export const backFor = (scenery: Scenery): CSSProperties => {
  const src = paint(BACK[scenery]);
  return src ? ({ '--pp-back': `url("${src}")` } as CSSProperties) : {};
};

/** The paper layers drawn while there is no painted background. */
export function PaperLayers() {
  return (
    <div className="pp-layers" aria-hidden="true">
      <span className="pp-sun" />
      <span className="pp-cloud pp-cloud--a" />
      <span className="pp-cloud pp-cloud--b" />
      <span className="pp-dune" />
      <span className="pp-tree">
        <span className="pp-tree__trunk" />
        <span className="pp-tree__top" />
      </span>
      <span className="pp-sea" />
      <span className="pp-wet" />
      <span className="pp-sand" />
    </div>
  );
}

interface Props {
  scenery: Scenery;
  shells: { metal: Metal; glow?: boolean }[];
  friend: FriendName;
  pose: FriendPose;
  children?: ReactNode;
}

export function Beach({ scenery, shells, friend, pose, children }: Props) {
  return (
    <div className={`pp-beach pp-scene--${scenery}`} style={backFor(scenery)}>
      <PaperLayers />
      <div className="pp-tideline">
        {shells.map((s, i) => (
          <span key={i} className="pp-tideline__spot" style={{ ['--pp-i' as string]: i }}>
            <MagicShell metal={s.metal} glow={s.glow} />
          </span>
        ))}
      </div>
      <span className="pp-beach__friend">
        <Friend friend={friend} pose={pose} />
      </span>
      {children}
    </div>
  );
}
