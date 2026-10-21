import { useEffect, useState } from 'react';
import { fetchArcheryEnabled } from '../../data/archery';

/**
 * Is Archery Challenge in the hub? On since the merge to main (James, 22 Oct 2026: going live without Stage 8).
 * The card still hides itself while the teacher's switch is off for the pupil's class, and the database started
 * with that switch off everywhere. Set this to false to take the game out of the build completely.
 */
const ON = true;

export const archeryOn = (): boolean => ON || import.meta.env.VITE_ARCHERY_ON === 'true';

/** Is Archery switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useArcheryEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!archeryOn()) return;
    let current = true;
    fetchArcheryEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
