import { useState } from 'react';
import { pip, shell, type PipPose } from './art';

/**
 * Pip the crab: a painted picture that is only decoration (the words around it carry the meaning). Until Pip is painted
 * (or if the picture fails) the 🦀 shows. Pip never says or points at an answer or a card.
 */
export function Pip({ pose, className = '', still = false }: { pose: PipPose; className?: string; still?: boolean }) {
  const src = pip(pose);
  const [failed, setFailed] = useState<string[]>([]);
  const painted = src && !failed.includes(src);
  return (
    <span className={`bm-pip bm-pip--${pose}${still ? ' bm-pip--still' : ''} ${className}`.trim()} aria-hidden="true" data-testid="bm-pip" data-pose={pose}>
      {painted
        ? <img key={src} className="bm-pip__img" src={src} alt="" draggable={false} onError={() => setFailed((was) => [...was, src])} />
        : <span className="bm-pip__emoji">🦀</span>}
    </span>
  );
}

/** A player's badge: the painted shell, or the old emoji if the shell isn't painted or fails to load. */
export function ShellBadge({ colour, fallback, className = '' }: { colour: 'pink' | 'blue'; fallback: string; className?: string }) {
  const src = shell(colour);
  const [failed, setFailed] = useState(false);
  return (
    <span className={`bm-shell bm-shell--${colour} ${className}`.trim()} aria-hidden="true">
      {src && !failed
        ? <img className="bm-shell__img" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
        : <span className="bm-shell__emoji">{fallback}</span>}
    </span>
  );
}
