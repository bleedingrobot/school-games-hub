/** Clan Quest's days are New Zealand calendar days, like the other daily games. */
const nz = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Whole days since 1970 of the New Zealand date at this moment (milliseconds since 1970). */
export function nzDayNumber(ms: number): number {
  const [y, m, d] = nz.format(new Date(ms)).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
