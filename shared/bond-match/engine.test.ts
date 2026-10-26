import { describe, expect, it } from 'vitest';
import { findBondSet } from './bonds';
import { buildDeck, partnersOf } from './deck';
import { flip, newGame } from './engine';

const game = (id: string, seed = 7, size: 'small' | 'medium' | 'large' = 'small') => newGame(buildDeck(findBondSet(id)!, size, seed));

/** Two cards that are not partners. */
const wrongPair = (s: ReturnType<typeof game>): [number, number] => {
  const partners = partnersOf(s.deck);
  for (let j = 1; j < s.deck.cards.length; j++) if (!partners[0].includes(j)) return [0, j];
  throw new Error('no wrong pair');
};

describe('flip', () => {
  it('matches partners and keeps them up; a mismatch shows its sum and turns back on the next flip', () => {
    const s = game('whole-10');
    const p = partnersOf(s.deck)[0][0];
    const r = flip(flip(s, 0).state, p);
    expect(r.events[0]).toMatchObject({ type: 'match', cards: [0, p], sumText: '10' });
    expect(r.state.matched[0] && r.state.matched[p]).toBe(true);

    const [a, b] = wrongPair(s);
    const miss = flip(flip(s, a).state, b);
    expect(miss.events[0]).toMatchObject({ type: 'mismatch', cards: [a, b] });
    expect(miss.state.shown).toEqual([a, b]);
    expect(flip(miss.state, a).state.shown).toEqual([a]);
  });
});
