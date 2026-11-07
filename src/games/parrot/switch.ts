import { useEffect, useState } from 'react';
import { fetchParrotEnabled } from '../../data/parrot';

/**
 * Is Parrot’s See-saw in the hub at all? `VITE_PARROT_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const PARROT_ON = true;

export const parrotOn = (): boolean => PARROT_ON || import.meta.env.VITE_PARROT_ON === 'true';

/** Is Parrot’s See-saw switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useParrotEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!parrotOn()) return;
    let current = true;
    fetchParrotEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
