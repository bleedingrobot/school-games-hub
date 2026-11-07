import { useEffect, useState } from 'react';
import { fetchRobinEnabled } from '../../data/robin';

/**
 * Is Robin’s Berry Basket in the hub at all? `VITE_ROBIN_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const ROBIN_ON = true;

export const robinOn = (): boolean => ROBIN_ON || import.meta.env.VITE_ROBIN_ON === 'true';

/** Is Robin’s Berry Basket switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useRobinEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!robinOn()) return;
    let current = true;
    fetchRobinEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
