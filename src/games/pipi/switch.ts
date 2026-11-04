import { useEffect, useState } from 'react';
import { fetchPipiEnabled } from '../../data/pipi';

/**
 * Is Pipi's Hidden Shells in the hub at all? On since 4 Nov 2026 (docs/PIPI-PLAN.md).
 * `VITE_PIPI_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class.
 */
const PIPI_ON = true;

export const pipiOn = (): boolean => PIPI_ON || import.meta.env.VITE_PIPI_ON === 'true';

/** Is Pipi's Hidden Shells switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function usePipiEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!pipiOn()) return;
    let current = true;
    fetchPipiEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
