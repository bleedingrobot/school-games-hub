import { useEffect, useState } from 'react';
import { fetchIslesEnabled } from '../../data/isles';

/**
 * Is Sky Isles in the hub? On since 4 Nov 2026 (James's yes, stage S.8). Each class still has its own teacher switch,
 * off until the teacher turns it on. Set back to false to take the card out of the build again.
 */
const ON = true;

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
