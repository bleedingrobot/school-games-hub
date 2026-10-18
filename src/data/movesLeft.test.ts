import { describe, expect, it } from 'vitest';
import { movesFromRaw, type RawMovesLeft } from './movesLeft';

const noon = (date: string) => new Date(`${date}T00:00:00Z`); // noon in New Zealand, the same date

const lord = (over: Partial<NonNullable<RawMovesLeft['lord']>> = {}): RawMovesLeft => ({
  lord: { day: '2026-10-19', forestLeft: 4, arenaLeft: 1, masterTried: true, masterExtra: 0, forestPerDay: 10, ...over },
  clans: null,
});

describe('movesFromRaw', () => {
  it('shows nothing for a pupil with no hero or clan', () => {
    expect(movesFromRaw({ lord: null, clans: null })).toEqual({});
    expect(movesFromRaw(null)).toEqual({});
  });

  it("shows today's Dragon Maths numbers", () => {
    const m = movesFromRaw(lord(), noon('2026-10-19'))['dragon-maths'];
    expect(m.chips.map((c) => c.text)).toEqual(['4 forest fights', '1 arena fight', '0 master tries']);
    expect(m.chips.map((c) => c.empty)).toEqual([false, false, true]);
    expect(m.allDone).toBe(false);
  });

  it('counts a new day as a fresh allowance, with the saved-up forest fights', () => {
    const m = movesFromRaw(lord({ day: '2026-10-18' }), noon('2026-10-19'))['dragon-maths'];
    expect(m.chips.map((c) => c.text)).toEqual(['14 forest fights', '3 arena fights', '1 master try']);
  });

  it('says all done when everything is used up', () => {
    const m = movesFromRaw(lord({ forestLeft: 0, arenaLeft: 0 }), noon('2026-10-19'))['dragon-maths'];
    expect(m.allDone).toBe(true);
  });

  it('shows Clan Quest mine fights', () => {
    const m = movesFromRaw({ lord: null, clans: { fightsLeft: 5, perDay: 8 } })['clan-quest'];
    expect(m.chips[0]).toEqual({ emoji: '⛏️', text: '5 of 8 mine fights', empty: false });
    expect(movesFromRaw({ lord: null, clans: { fightsLeft: 0, perDay: 8 } })['clan-quest'].allDone).toBe(true);
  });
});
