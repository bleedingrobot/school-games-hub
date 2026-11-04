import { useEffect, useState } from 'react';
import { fetchKororaEnabled } from '../../data/korora';

/**
 * Is Penguin Pairs in the hub at all? `VITE_KORORA_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const KORORA_ON = true;

export const kororaOn = (): boolean => KORORA_ON || import.meta.env.VITE_KORORA_ON === 'true';

/** Is Penguin Pairs switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useKororaEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!kororaOn()) return;
    let current = true;
    fetchKororaEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
