import type { CSSProperties } from 'react';
import burstGold from './art/burst-gold.webp';
import burstSilver from './art/burst-silver.webp';
import burstBronze from './art/burst-bronze.webp';
import sparklesGold from './art/sparkles-gold.webp';
import sparklesSilver from './art/sparkles-silver.webp';
import sparklesBronze from './art/sparkles-bronze.webp';
import './earn.css';

const BURSTS = { 1: burstBronze, 2: burstSilver, 3: burstGold } as const;
const SPARKLES = { 1: sparklesBronze, 2: sparklesSilver, 3: sparklesGold } as const;

/**
 * The painted burst behind a new medallion, in its tier's metal: a starburst that flashes out, a ring of sparkles that
 * spreads and spins, and a dozen sparks flying off. `play` restarts it (a new key per medallion). Hidden for reduced motion.
 */
export function EarnBurst({ tier, size, play }: { tier: 1 | 2 | 3; size: number; play: string }) {
  return (
    <span className={`ach-burst ach-burst--t${tier}`} style={{ '--ach-burst': `${size}px` } as CSSProperties} aria-hidden="true" key={play}>
      <img className="ach-burst__rays" src={BURSTS[tier]} alt="" draggable={false} />
      <img className="ach-burst__ring" src={SPARKLES[tier]} alt="" draggable={false} />
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="ach-burst__spark" style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}
