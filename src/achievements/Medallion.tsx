import type { CSSProperties } from 'react';
import type { Achievement } from '../data/progress';
import { share } from './hall';
import bronze from './art/frame-bronze.webp';
import silver from './art/frame-silver.webp';
import gold from './art/frame-gold.webp';
import locked from './art/frame-locked.webp';
import './medallion.css';

const FRAMES = { 1: bronze, 2: silver, 3: gold } as const;
export const TIER_WORDS = { 1: 'Bronze', 2: 'Silver', 3: 'Gold' } as const;

/** Round progress ring: 100 units round, so the dash is just the percentage. */
const RING = 100;

/**
 * One achievement as a painted medallion: its emoji on a bronze, silver or gold frame (by tier). Earned ones shine, with
 * a slow shine sweep and twinkles; not yet earned ones are a dim stone silhouette with a progress ring round the edge, in
 * the tier's colour. Nothing is ever hidden.
 */
export function Medallion({ a, size }: { a: Achievement; size: number }) {
  const tier = a.tier ?? 2;
  const done = a.earnedAt !== null;
  const style = { '--ah-size': `${size}px`, '--ah-done': share(a) * RING } as CSSProperties;
  return (
    <span className={`ah-medal ah-medal--t${tier}${done ? ' is-earned' : ''}`} style={style} aria-hidden="true">
      <img className="ah-medal__frame" src={done ? FRAMES[tier] : locked} alt="" draggable={false} />
      <span className="ah-medal__emoji">{a.emoji}</span>
      {done ? (
        <>
          <span className="ah-medal__shine" />
          <span className="ah-medal__twinkle ah-medal__twinkle--a">✦</span>
          <span className="ah-medal__twinkle ah-medal__twinkle--b">✦</span>
        </>
      ) : (
        <svg className="ah-medal__ring" viewBox="0 0 40 40">
          <circle className="ah-medal__track" cx="20" cy="20" r="18.2" pathLength={RING} />
          {a.progress > 0 && <circle className="ah-medal__fill" cx="20" cy="20" r="18.2" pathLength={RING} />}
        </svg>
      )}
    </span>
  );
}
