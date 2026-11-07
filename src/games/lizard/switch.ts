import { useEffect, useState } from 'react';
import { fetchLizardEnabled } from '../../data/lizard';

/**
 * Is Lizard’s Bundles in the hub at all? `VITE_LIZARD_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const LIZARD_ON = true;

export const lizardOn = (): boolean => LIZARD_ON || import.meta.env.VITE_LIZARD_ON === 'true';

/** Is Lizard’s Bundles switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useLizardEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!lizardOn()) return;
    let current = true;
    fetchLizardEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
