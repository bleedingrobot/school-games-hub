/**
 * The beanstalk picture every screen is built on: the stalk (drawn in CSS) growing from the farm up to a cloud, the
 * friend stuck on top, the child at the bottom, and leaves along the stalk.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
  // The painted clay cloud once there is one (scripts/beanstalk-art.py, 'cloud'); until then the CSS cloud.
  const cloudUrl = paint('things/cloud');
  // The same for the stalk: a painted clay stem repeated up it, and the sprout's two leaves riding on top as it grows.
  const stemUrl = paint('things/stem');
  const sproutUrl = paint('things/sprout-top');
  const height = Math.min(1, Math.max(0, grow));
  // The stalk, cloud and child are placed from the scene's size (beanstalk.css), so the stalk meets the painted sprout.
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const style = {
    ...(backUrl ? { '--bs-back': `url("${backUrl}")` } : {}),
    ...(size ? { '--bs-w': `${size.w}px`, '--bs-h': `${size.h}px` } : {}),
  } as CSSProperties;
  return (
    <div ref={box} className={`bs-scene bs-scene--${back}`} style={style}>
      {back === 'garden' && (
        <>
          <div
            className={`bs-stalk${stemUrl ? ' bs-stalk--painted' : ''}`}
            style={{ height: `calc(var(--bs-stalk-length) * ${height})`, ...(stemUrl ? { backgroundImage: `url("${stemUrl}")` } : {}) }}
          />
          {/* Not before the stalk starts: the farm picture's own sprout is there, and the two pairs of leaves doubled up. */}
          {sproutUrl && height > 0 && height < 1 && (
            <img className="bs-sprout" src={sproutUrl} alt="" style={{ bottom: `calc(var(--bs-ground) + var(--bs-stalk-length) * ${height})` }} />
          )}
          {leaves.map((leaf, i) => {
            // Leaves sit evenly up the stalk, left and right in turn, the first just above the ground and the last well below
            // the cloud, so none hides behind it (James, 4 Nov 2026). A little lower for the painted cloud, which hangs lower.
            const at = (i + 0.5) / (LEAVES_ON_STALK + 3.2);
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
      <div className={`bs-cloud${back === 'clouds' ? ' bs-cloud--low' : ''}${cloudUrl ? ' bs-cloud--painted' : ''}`}>
        {cloudUrl && <img className="bs-cloud__art" src={cloudUrl} alt="" />}
        <img className="bs-friend" src={friendArt(friend, friendPose)} alt="" />
      </div>
      {child && <img className="bs-child" src={childArt(child, childPose)} alt="" />}
    </div>
  );
}
