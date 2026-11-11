import { useEffect, useState } from 'react';
import { fetchToonFlapEnabled } from '../../data/toonflap';

/**
 * Is Toon Flap in the hub at all? On since 11 Nov 2026 (James). `VITE_TOONFLAP_ON=true` in .env.local shows it on your
 * own computer. Even when on, the card hides until the teacher switches the game on for the class (on for every class to start).
 */
const TOONFLAP_ON = true;

export const toonflapOn = (): boolean => TOONFLAP_ON || import.meta.env.VITE_TOONFLAP_ON === 'true';

/** Is Toon Flap switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useToonFlapEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!toonflapOn()) return;
    let current = true;
    fetchToonFlapEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
