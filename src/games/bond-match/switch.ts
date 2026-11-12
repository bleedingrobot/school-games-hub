import { fetchBondMatchEnabled } from '../../data/bondMatch';
import { useSetting } from '../../teacher/useSetting';

/**
 * Is Bond Match on the dashboard? The card still hides itself while the teacher's switch (the Bond Match row on the
 * teacher's Games table) is off for the pupil's class, and the database starts with that switch off everywhere. Turn this off to
 * remove the card completely. Needs migrations 20261019001000 and 20261020000200 and the `bond-match` function first.
 */
export const BOND_MATCH_ON = true;

/** Is Bond Match on for this class? The teacher's switch on the Games table. */
export function useBondMatchClassSwitch(classId: string) {
  return useSetting(() => fetchBondMatchEnabled(classId), [classId]);
}
