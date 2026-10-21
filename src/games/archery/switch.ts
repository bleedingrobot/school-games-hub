import { useEffect, useState } from 'react';
import { fetchArcheryEnabled } from '../../data/archery';

/**
 * Is Archery Challenge in the hub? Off: the game isn't in the build at all (docs/ARCHERY-PLAN.md, section 7).
 * Going live turns this on, only with James's word. `VITE_ARCHERY_ON=true` in .env.local shows it on your
 * own computer only. Even when this is on, the card hides itself while the teacher's switch is off for the
 * pupil's class, and the database starts with that switch off everywhere.
 */
const ON = false;

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
