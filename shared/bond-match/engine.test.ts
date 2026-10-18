import { describe, expect, it } from 'vitest';
import { findBondSet } from './bonds';
import { buildDeck, partnersOf } from './deck';
import { flip, newGame } from './engine';
import { exact } from './exact';
import { perfectFlips, play } from './perfectPlayer';

const game = (id: string, seed = 7, size: 'small' | 'medium' | 'large' = 'small') => newGame(buildDeck(findBondSet(id)!, size, seed));

/** Two cards that are not partners. */
const wrongPair = (s: ReturnType<typeof game>): [number, number] => {
  const partners = partnersOf(s.deck);
  for (let j = 1; j < s.deck.cards.length; j++) if (!partners[0].includes(j)) return [0, j];
  throw new Error('no wrong pair');
};

describe('flip', () => {
  it('first flip shows a card', () => {
    const r = flip(game('whole-10'), 3);
    expect(r.refused).toBeUndefined();
    expect(r.state.shown).toEqual([3]);
    expect(r.events).toEqual([{ type: 'first', card: 3, text: expect.any(String) }]);
  });

  it('matches partners and keeps them up', () => {
    const s = game('whole-10');
    const p = partnersOf(s.deck)[0][0];
    const r = flip(flip(s, 0).state, p);
    expect(r.events[0]).toMatchObject({ type: 'match', cards: [0, p], sumText: '10' });
    expect(r.state.matched[0] && r.state.matched[p]).toBe(true);
    expect(r.state.shown).toEqual([]);
    expect(r.state.flips).toBe(1);
  });

  it('a mismatch stays up with its sum, then the next flip turns it back', () => {
    const s = game('whole-10');
    const [a, b] = wrongPair(s);
    const r = flip(flip(s, a).state, b);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ type: 'mismatch', cards: [a, b], sumsToTarget: false });
    expect(r.state.shown).toEqual([a, b]);
    expect(r.state.flips).toBe(1);
    const next = flip(r.state, a); // flipping again turns the pair back; the new card is a first flip
    expect(next.refused).toBeUndefined();
    expect(next.state.shown).toEqual([a]);
    expect(next.events[0].type).toBe('first');
    expect(next.state.flips).toBe(1);
  });

  it('the sum in a mismatch is exact for decimals and fractions', () => {
    const d = game('decimal-1-tenths', 3);
    const [a, b] = wrongPair(d);
    const ev = flip(flip(d, a).state, b).events[0];
    if (ev.type !== 'mismatch') throw new Error('expected mismatch');
    expect(ev.sumText).toMatch(/^\d+\.\d$/);
    expect(ev.sumText).not.toMatch(/\d{3,}/);

    const f = game('fraction-eighths', 3, 'large');
    const [c, e] = wrongPair(f);
    const fe = flip(flip(f, c).state, e).events[0];
    if (fe.type !== 'mismatch') throw new Error('expected mismatch');
    expect(fe.sum.d).toBeGreaterThanOrEqual(1);
    expect(fe.values.map((v) => v.n / v.d).every((v) => v > 0 && v < 1)).toBe(true);
  });

  it('knows two cards that make the target in different colour sets still do not match', () => {
    const s = game('whole-10', 4, 'large');
    const cards = s.deck.cards;
    let found: [number, number] | undefined;
    cards.forEach((c, i) => cards.forEach((o, j) => {
      if (!found && c.set !== o.set && c.side.kind === 'whole' && o.side.kind === 'whole' && c.side.n + o.side.n === 10) found = [i, j];
    }));
    expect(found).toBeDefined();
    const ev = flip(flip(s, found![0]).state, found![1]).events[0];
    expect(ev).toMatchObject({ type: 'mismatch', sumsToTarget: true, sumText: '10' });
  });

  it('exact sum for 0.1 + 0.2', () => {
    // swap two cards for 0.1 and 0.2 so the mismatch sum is the classic floating point trap
    const deck = buildDeck(findBondSet('decimal-1-tenths')!, 'small', 1);
    const custom = { ...deck, cards: [{ side: { kind: 'decimal', units: 1, places: 1 } as const, set: 0, pair: 0 }, { side: { kind: 'decimal', units: 2, places: 1 } as const, set: 0, pair: 1 }, ...deck.cards.slice(2)] };
    const ev = flip(flip(newGame(custom), 0).state, 1).events[0];
    expect(ev).toMatchObject({ type: 'mismatch', sumText: '0.3', sum: exact(3, 10) });
  });

  it('refuses: matched card, same card twice, missing card', () => {
    const s = game('whole-10');
    const p = partnersOf(s.deck)[0][0];
    const matched = flip(flip(s, 0).state, p).state;
    for (const [state, i, reason] of [
      [matched, 0, 'already-matched'],
      [flip(s, 2).state, 2, 'same-card'],
      [s, -1, 'no-such-card'],
      [s, s.deck.cards.length, 'no-such-card'],
      [s, 1.5, 'no-such-card'],
    ] as const) {
      const r = flip(state, i);
      expect(r.refused).toBe(reason);
      expect(r.state).toBe(state);
      expect(r.events).toEqual([]);
    }
  });

  it('a perfect player finishes in one flip per pair, with a finish event', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const s = game('whole-100-any', 11, size);
      const end = play(s, perfectFlips(s));
      expect(end.finished).toBe(true);
      expect(end.flips).toBe(s.deck.pairCount);
      expect(end.log).toHaveLength(s.deck.cards.length);
    }
    const s = game('whole-10');
    const flips = perfectFlips(s);
    const last = flip(play(s, flips.slice(0, -1)), flips[flips.length - 1]);
    expect(last.events.map((e) => e.type)).toEqual(['match', 'finish']);
  });

  it('refuses flips after the game is finished', () => {
    const s = game('whole-10');
    const end = play(s, perfectFlips(s));
    expect(flip(end, 0).refused).toBe('already-matched');
  });

  it('does not change the state it was given', () => {
    const s = game('whole-10');
    const before = JSON.stringify(s);
    flip(flip(s, 0).state, 1);
    expect(JSON.stringify(s)).toBe(before);
  });
});
