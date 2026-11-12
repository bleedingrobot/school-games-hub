import { describe, expect, it } from 'vitest';
import { type RecentChallenge } from '../../data/foundational';
import { firstTryOf } from './state';

const round = (extra: Partial<RecentChallenge> = {}): RecentChallenge => ({ day: '2026-11-10', wrong: 2, taps: 12, level: 3, ...extra });

describe('firstTryOf', () => {
  it('gives % right first try (sum f over sum goes) and the median first-tap time', () => {
    // Goes are taps less wrong taps: 10 each. 9 + 6 + 3 right of 30.
    const f = firstTryOf([round({ firstRight: 9, ms: 3000 }), round({ firstRight: 6, ms: 5000 }), round({ firstRight: 3, ms: 2000 })]);
    expect(f).toEqual({ percent: 60, ms: 3000 });
    expect(firstTryOf([round({ ms: 1000 }), round({ ms: 2000 })])).toEqual({ percent: null, ms: 1500 });
  });

});


