import { useEffect, useState } from 'react';
import { fetchPigeonEnabled } from '../../data/pigeon';

/**
 * Is Pigeon’s Number Line in the hub at all? `VITE_PIGEON_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const PIGEON_ON = true;

export const pigeonOn = (): boolean => PIGEON_ON || import.meta.env.VITE_PIGEON_ON === 'true';

/** Is Pigeon’s Number Line switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function usePigeonEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!pigeonOn()) return;
    let current = true;
    fetchPigeonEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
