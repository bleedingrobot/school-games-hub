import { describe, expect, it } from 'vitest';
import { newIsland, type Island } from '../../../shared/isles/engine';
import { goalWords } from './words';

const grand = (extra: Partial<Island>): Island => ({
  ...newIsland(),
  spots: Array.from({ length: 16 }, () => ({ kind: 'farm' as const, level: 1 })),
  ...extra,
});

describe('Sky Isles goal line', () => {
  it('says what to do next, with the numbers, all the way to the lit Lighthouse', () => {
    expect(goalWords({ ...newIsland(), driftLeft: 0 }).next).toBe('Next: more land drifts by tomorrow. Save 300 coins to anchor it.');
    expect(goalWords({ ...newIsland(), driftLeft: 1, coins: 100 })).toEqual({
      label: 'Road to Grand Isle: 6 of 16 building spots',
      next: 'Next: save 300 coins to anchor the land drifting by. You have 100.',
    });
    expect(goalWords({ ...newIsland(), driftLeft: 1, coins: 300 }).next).toBe('Next: land is drifting by! Anchor it on your turn for 300 coins.');
    // A full island with land still in the drift talks about the Lighthouse, not land.
    expect(goalWords(grand({ lighthouse: 2, coins: 500, crystals: 30.75, driftLeft: 2 }))).toEqual({
      label: 'Grand Isle! Sky Lighthouse: 2 of 4 stages',
      next: 'Next: Lighthouse stage 3 costs 900 coins and 20 sky crystals. You need 400 more coins.',
    });
    expect(goalWords(grand({ lighthouse: 0, coins: 600, crystals: 9.75 })).next).toContain('You need 1 more sky crystal.');
    expect(goalWords(grand({ lighthouse: 3, coins: 2000, crystals: 68 })).next).toContain('You have enough: build it on your turn!');
    expect(goalWords(grand({ lighthouse: 4 })).label).toBe('Sky Lighthouse lit!');
  });
});
