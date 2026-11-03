/**
 * The beanstalk picture every screen is built on: the stalk (drawn in CSS) growing from the farm up to a cloud, the
 * friend stuck on top, the child at the bottom, and leaves along the stalk.
 */
import type { CSSProperties } from 'react';
import { LEAVES_ON_STALK, type Friend, type Metal } from '../../../shared/beanstalk/progress';
import { childArt, friendArt, leafArt, paint, type ChildPose, type Pose } from './art';
import type { Child } from './backend';

export interface StalkLeaf {
  metal: Metal;
  /** Just changed: it sparkles. */
  glow?: boolean;
}

interface Props {
  /** How far up the stalk has grown, 0 to 1 (1 reaches the cloud). */
  grow: number;
  leaves: StalkLeaf[];
  friend: Friend;
  friendPose: Pose;
  child: Child | null;
  childPose: ChildPose;
  /** 'clouds' for the egg: the land on top of the cloud. */
  back?: 'garden' | 'clouds';
}

export function Scene({ grow, leaves, friend, friendPose, child, childPose, back = 'garden' }: Props) {
  const backUrl = paint(`backs/${back}`);
  return (
    <div className={`bs-scene bs-scene--${back}`} style={backUrl ? ({ '--bs-back': `url("${backUrl}")` } as CSSProperties) : undefined}>
      {back === 'garden' && (
        <>
          <div className="bs-stalk" style={{ height: `calc(var(--bs-stalk-length) * ${Math.min(1, Math.max(0, grow))})` }} />
          {leaves.map((leaf, i) => {
            // Leaves sit evenly up the stalk, left and right in turn, the first just above the ground.
            const at = (i + 0.6) / LEAVES_ON_STALK;
            if (at > grow) return null;
            return (
              <img
                key={i}
                src={leafArt(leaf.metal)}
                alt=""
                className={`bs-stalk-leaf ${i % 2 ? 'bs-stalk-leaf--right' : 'bs-stalk-leaf--left'}${leaf.glow ? ' bs-stalk-leaf--glow' : ''}`}
                style={{ bottom: `calc(var(--bs-ground) + var(--bs-stalk-length) * ${at})` }}
              />
            );
          })}
        </>
      )}
      <div className={`bs-cloud${back === 'clouds' ? ' bs-cloud--low' : ''}`}>
        <img className="bs-friend" src={friendArt(friend, friendPose)} alt="" />
      </div>
      {child && <img className="bs-child" src={childArt(child, childPose)} alt="" />}
    </div>
  );
}
