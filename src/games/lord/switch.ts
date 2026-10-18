import { useEffect, useState } from 'react';
import { fetchLordEnabled } from '../../data/lord';
import { DRAGON_MATHS_ON } from '../registry';

/**
 * Is Dragon Maths switched on by the teacher? null while loading (treated as off, so the card never flashes up).
 * Nothing is asked of the server while the code switch (DRAGON_MATHS_ON) is off, because the card isn't there at all.
 */
export function useLordEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(DRAGON_MATHS_ON ? null : false);
  useEffect(() => {
    if (!DRAGON_MATHS_ON) return;
    let current = true;
    fetchLordEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
