/**
 * New Zealand school terms, for "this term" on the focus history. The dates are the Ministry of Education's published term dates;
 * add the next year's here when they are out. A date outside the list (or long after the last listed term began) falls back to
 * the last 10 weeks, so the history never shows nothing just because this list was not updated.
 */
import { nzLocalToIso } from './focus';

/** The day each term starts (a Monday or, after a public holiday, the day after), in New Zealand time, oldest first. */
export const TERM_STARTS: readonly string[] = [
  '2026-02-02', // Term 1
  '2026-04-20', // Term 2
  '2026-07-20', // Term 3
  '2026-10-12', // Term 4
];

const FALLBACK_DAYS = 70;
/** A term is at most this long (with holidays that follow it) before the list is treated as out of date. */
const LONGEST_GAP_DAYS = 130;

/** The moment this term began (midnight at the start of its first day, New Zealand time). */
export function termStart(now: Date = new Date()): Date {
  const today = now.getTime();
  const starts = TERM_STARTS.map((day) => nzLocalToIso(`${day}T00:00`))
    .filter((iso): iso is string => iso !== null)
    .map((iso) => new Date(iso));
  const latest = [...starts].reverse().find((d) => d.getTime() <= today);
  if (latest && today - latest.getTime() <= LONGEST_GAP_DAYS * 86_400_000) return latest;
  return new Date(today - FALLBACK_DAYS * 86_400_000);
}
