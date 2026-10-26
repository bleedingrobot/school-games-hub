import { useEffect, useState } from 'react';
import { fetchKingdomEnabled } from '../../data/kingdom';

/**
 * Is Kingdom Keeper in the hub? On since 27 Oct 2026 (James: "you do it all and switch it on"), after the migration and
 * the `kingdom` function went live (docs/KINGDOM-PLAN.md). The card still hides itself until the teacher switches the
 * game on for the pupil's class (the database started with it off everywhere). Set this to false to take the game out of
 * the build completely.
 */
const ON = true;

export const kingdomOn = (): boolean => ON || import.meta.env.VITE_KINGDOM_ON === 'true';

/** Is Kingdom Keeper switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useKingdomEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!kingdomOn()) return;
    let current = true;
    fetchKingdomEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
