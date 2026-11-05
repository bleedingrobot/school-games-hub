import { useEffect, useState } from 'react';
import { fetchDecreeEnabled } from '../../data/decree';

/**
 * Is Royal Decree in the hub? On since 6 Nov 2026 (James: "Go live now"), replacing Kingdom Keeper. Once
 * it is in the build, the card hides itself until the pupil's class has the game switched on (the database starts with it
 * on everywhere). Set VITE_DECREE_ON=true in .env.local to try it on your own computer.
 */
const ON = true;

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
