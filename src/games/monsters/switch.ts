import { useEffect, useState } from 'react';
import { fetchMonstersEnabled } from '../../data/monsters';

/** Is Maths Monsters switched on? null while loading (treated as off, so the card never flashes up). */
export function useMonstersEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    fetchMonstersEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
