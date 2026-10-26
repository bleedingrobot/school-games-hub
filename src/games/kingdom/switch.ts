import { useEffect, useState } from 'react';
import { fetchKingdomEnabled } from '../../data/kingdom';

/**
 * Is Kingdom Keeper in the hub? Off until James says go (docs/KINGDOM-PLAN.md, K.7): the migration must be applied and
 * the `kingdom` function deployed first. Try it locally with VITE_KINGDOM_ON=true in .env.local. While it is on, the
 * card still hides itself until the teacher switches the game on for the pupil's class (the database starts with it off).
 */
const ON = false;

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
