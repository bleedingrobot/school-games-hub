import { useEffect, useState } from 'react';
import { fetchWekaEnabled } from '../../data/weka';

/**
 * Is Weka’s Stepping Stones in the hub at all? `VITE_WEKA_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const WEKA_ON = true;

export const wekaOn = (): boolean => WEKA_ON || import.meta.env.VITE_WEKA_ON === 'true';

/** Is Weka’s Stepping Stones switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useWekaEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!wekaOn()) return;
    let current = true;
    fetchWekaEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
