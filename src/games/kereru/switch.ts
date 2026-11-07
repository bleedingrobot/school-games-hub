import { useEffect, useState } from 'react';
import { fetchKereruEnabled } from '../../data/kereru';

/**
 * Is Kererū’s Number Line in the hub at all? `VITE_KERERU_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const KERERU_ON = true;

export const kereruOn = (): boolean => KERERU_ON || import.meta.env.VITE_KERERU_ON === 'true';

/** Is Kererū’s Number Line switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useKereruEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!kereruOn()) return;
    let current = true;
    fetchKereruEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
