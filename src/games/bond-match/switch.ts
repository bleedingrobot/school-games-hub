import { useEffect, useState } from 'react';
import { fetchBondMatchEnabled } from '../../data/bondMatch';

/**
 * Is Bond Match on the dashboard? The card still hides itself while the teacher's switch (the Bond Match panel on the
 * teacher page) is off for the pupil's class, and the database starts with that switch off everywhere. Turn this off to
 * remove the card completely. Needs migrations 20261019001000 and 20261020000200 and the `bond-match` function first.
 */
export const BOND_MATCH_ON = true;

/** Is Bond Match switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useBondMatchEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    fetchBondMatchEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
