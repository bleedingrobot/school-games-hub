import { useState } from 'react';
import { paint } from './art';

/**
 * A painted icon or portrait (docs/GOBLINSTORM-ART-PLAN.md) with its emoji stand-in as the fallback: shown while the
 * picture isn't painted, and if it fails to download. `small` uses the smaller copy, for little spots on screen.
 */
export function Pic({ path, fallback, small = false, className }: { path: string; fallback: string; small?: boolean; className?: string }) {
  const url = (small ? paint(`${path}-small`) : undefined) ?? paint(path);
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <>{fallback}</>;
  return <img className={`gs-pic${className ? ` ${className}` : ''}`} src={url} alt="" draggable={false} onError={() => setBroken(true)} />;
}
