import { useEffect, useState } from 'react';
import { fetchDecreeEnabled } from '../../data/decree';

/**
 * Is Royal Decree in the hub? Off in code while it is built (docs/DECREE-PLAN.md); the go-live PR sets this to true. Once
 * it is in the build, the card hides itself until the pupil's class has the game switched on (the database starts with it
 * on everywhere). Set VITE_DECREE_ON=true in .env.local to try it on your own computer.
 */
const ON = false;

export const decreeOn = (): boolean => ON || import.meta.env.VITE_DECREE_ON === 'true';

/** Is Royal Decree switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useDecreeEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!decreeOn()) return;
    let current = true;
    fetchDecreeEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
