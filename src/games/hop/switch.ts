import { useEffect, useState } from 'react';
import { fetchHopEnabled } from '../../data/hop';

/**
 * Is Hop's Glow-worm Pond in the hub at all? Off until James says to go live (docs/HOP-PLAN.md, Stage 5).
 * `VITE_HOP_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class.
 */
const HOP_ON = false;

export const hopOn = (): boolean => HOP_ON || import.meta.env.VITE_HOP_ON === 'true';

/** Is Hop's Glow-worm Pond switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useHopEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!hopOn()) return;
    let current = true;
    fetchHopEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
