import { describe, expect, it } from 'vitest';
import { addDays, questWeek, weekday } from './week';

describe('a quest week', () => {
  it('marks each of the 7 days done, missed, today or still to come, across a month end', () => {
    const w = questWeek('2026-11-27', '2026-11-30', ['2026-11-27', '2026-11-29'], 5);
    expect(w.days.map((d) => d.state)).toEqual(['done', 'missed', 'done', 'today', 'later', 'later', 'later']);
    expect(w.days[6].date).toBe('2026-12-03');
    expect(w).toMatchObject({ done: 2, left: 4, running: true, outOfReach: false });
    expect(weekday('2026-11-30')).toBe('Mon');
  });

  it('says when 5 days can no longer be reached, and when the quest is over', () => {
    expect(questWeek('2026-11-18', '2026-11-22', ['2026-11-18'], 5).outOfReach).toBe(true);
    const over = questWeek('2026-11-18', addDays('2026-11-18', 8), ['2026-11-18'], 5);
    expect(over).toMatchObject({ running: false, left: 0, outOfReach: false });
  });
});
