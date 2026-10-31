import { nzDayNumber } from '../../../shared/clans/clock';

/** The weekday of a New Zealand day number (days since 1970), like "Thursday". */
export const weekdayOf = (day: number) => new Date(day * 86_400_000).toLocaleDateString('en-NZ', { weekday: 'long', timeZone: 'UTC' });

/** Is a shield that ends on this day still up? (A clan can't be raided on or before its `shieldUntil`.) */
export const shielded = (shieldUntil: number, now = Date.now()) => shieldUntil > 0 && nzDayNumber(now) <= shieldUntil;

/** "the end of Thursday": the shield's last day, so a child knows exactly when it stops. */
export const shieldEnds = (shieldUntil: number) => `the end of ${weekdayOf(shieldUntil)}`;
