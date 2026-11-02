import { useEffect, useState } from 'react';
import { fetchDiamondEnabled } from '../../data/diamond';

/**
 * Is Diamond Drop in the hub at all? On since 2 Nov 2026 (docs/DIAMOND-PLAN.md). `VITE_DIAMOND_ON=true` in .env.local
 * shows it on your own computer if this is ever false. Even when on, the card hides until the teacher switches the
 * game on for the class.
 */
const ON = true;

export const diamondOn = (): boolean => ON || import.meta.env.VITE_DIAMOND_ON === 'true';

/** Is Diamond Drop switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useDiamondEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!diamondOn()) return;
    let current = true;
    fetchDiamondEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
