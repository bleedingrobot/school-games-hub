import { useEffect, useState } from 'react';
import { fetchMineEnabled } from '../../data/mine';

/**
 * Is Mine Runner on the dashboard? Off: the game is not in the build at all (docs/MINE-PLAN.md, section 8). Going live
 * turns this on, only with James's word. `VITE_MINE_ON=true` in .env.local shows it on your own computer only.
 * Even when this is on, the card hides itself while the teacher's switch (the Mine Runner panel on the teacher page) is
 * off for the pupil's class, and the database starts with that switch off everywhere.
 */
const ON = true;

export const mineOn = (): boolean => ON || import.meta.env.VITE_MINE_ON === 'true';

/** Is Mine Runner switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useMineEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!mineOn()) return;
    let current = true;
    fetchMineEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
