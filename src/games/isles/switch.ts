import { useEffect, useState } from 'react';
import { fetchIslesEnabled } from '../../data/isles';

/**
 * Is Sky Isles in the hub? Off while it's being built (docs/ISLES-PLAN.md): nothing is live yet. Put
 * VITE_ISLES_ON=true in .env.local to see it on your own computer. Switching it on is the go-live step (S.8), with
 * James's yes, and adds the game to registry.ts.
 */
const ON = false;

export const islesOn = (): boolean => ON || import.meta.env.VITE_ISLES_ON === 'true';

/** Is Sky Isles switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useIslesEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!islesOn()) return;
    let current = true;
    fetchIslesEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
