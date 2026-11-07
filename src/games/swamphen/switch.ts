import { useEffect, useState } from 'react';
import { fetchSwamphenEnabled } from '../../data/swamphen';

/**
 * Is Swamp Hen’s Reed Rows in the hub at all? `VITE_SWAMPHEN_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const SWAMPHEN_ON = true;

export const swamphenOn = (): boolean => SWAMPHEN_ON || import.meta.env.VITE_SWAMPHEN_ON === 'true';

/** Is Swamp Hen’s Reed Rows switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useSwamphenEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!swamphenOn()) return;
    let current = true;
    fetchSwamphenEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
