/** Clan Quest's days are New Zealand calendar days, like the other daily games. */
const nz = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Whole days since 1970 of the New Zealand date at this moment (milliseconds since 1970). */
export function nzDayNumber(ms: number): number {
  const [y, m, d] = nz.format(new Date(ms)).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

// The season clock the database sends, here (not in season.ts) so the home page can read it without the clan rules (dashboard
// plan D7).
export interface SeasonClock {
  number: number;
  /** Day of the season, 1 to CONFIG.season.length. */
  day: number;
  daysLeft: number;
  clockOn: boolean;
}

const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Read the clock the database sends. Anything odd (missing, wrong types) gives null. */
export function readClock(raw: unknown): SeasonClock | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!whole(r.number) || !whole(r.day) || !whole(r.daysLeft) || typeof r.clockOn !== 'boolean') return null;
  return { number: r.number, day: r.day, daysLeft: r.daysLeft, clockOn: r.clockOn };
}
