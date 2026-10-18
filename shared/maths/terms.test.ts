import { describe, expect, it } from 'vitest';
import { TERM_STARTS, termStart } from './terms';

describe('this term', () => {
  it('starts at midnight on the first day of the term, New Zealand time', () => {
    // 19 Oct 2026 is in Term 4, which began Monday 12 October (daylight time, 13 hours ahead of UTC).
    expect(termStart(new Date('2026-10-19T02:00:00Z')).toISOString()).toBe('2026-10-11T11:00:00.000Z');
    // The first day itself counts as this term.
    expect(termStart(new Date('2026-10-12T00:30:00+13:00')).toISOString()).toBe('2026-10-11T11:00:00.000Z');
    // The day before is still Term 3.
    expect(termStart(new Date('2026-10-11T23:30:00+13:00')).toISOString()).toBe('2026-07-19T12:00:00.000Z');
    // Winter time is 12 hours ahead.
    expect(termStart(new Date('2026-05-01T10:00:00Z')).toISOString()).toBe('2026-04-19T12:00:00.000Z');
  });

  it('keeps the last term for the holidays that follow it', () => {
    expect(termStart(new Date('2026-12-30T00:00:00Z')).toISOString()).toBe('2026-10-11T11:00:00.000Z');
  });

  it('falls back to the last ten weeks when the list is out of date or the date is early', () => {
    const late = new Date('2027-08-01T00:00:00Z');
    expect(termStart(late).getTime()).toBe(late.getTime() - 70 * 86_400_000);
    const early = new Date('2025-06-01T00:00:00Z');
    expect(termStart(early).getTime()).toBe(early.getTime() - 70 * 86_400_000);
  });

  it('lists the terms in order', () => {
    expect([...TERM_STARTS].sort()).toEqual([...TERM_STARTS]);
  });
});
