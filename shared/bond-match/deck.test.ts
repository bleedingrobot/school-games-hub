import { describe, expect, it } from 'vitest';
import { BOND_SETS, findBondSet } from './bonds';
import { newGame } from './engine';
import { perfectFlips, play } from './perfectPlayer';
import { BOARD_PAIRS, BOARD_SIZES, buildDeck, MAX_COLOUR_SETS, pairsOnBoard, partnersOf } from './deck';
import { sideText } from './exact';

const seeds = Array.from({ length: 200 }, (_, i) => i * 10007 + 1);

describe('buildDeck', () => {
  it.each(BOND_SETS.map((b) => [b.id, b] as const))('%s builds every board size where every card can be cleared (200 seeds)', (_id, set) => {
    for (const size of BOARD_SIZES) {
      for (const seed of seeds) {
        const deck = buildDeck(set, size, seed);
        expect(deck.cards).toHaveLength(deck.pairCount * 2);
        expect(deck.pairCount).toBe(pairsOnBoard(set, size));
        const partners = partnersOf(deck);
        partners.forEach((p, i) => {
          expect(p.length).toBeGreaterThanOrEqual(1);
          for (const j of p) expect(partners[j]).toContain(i); // and it is mutual
        });
        // The whole board can be cleared, so nobody is ever left with a card that has no partner.
        expect(play(newGame(deck), perfectFlips(newGame(deck))).finished).toBe(true);
      }
    }
  });

  it('fills the board with the pairs asked for when the set is big enough', () => {
    for (const size of BOARD_SIZES) expect(buildDeck(findBondSet('whole-100-any')!, size, 1).pairCount).toBe(BOARD_PAIRS[size]);
    expect(buildDeck(findBondSet('whole-100-any')!, 'large', 1).cards.every((c) => c.set === 0)).toBe(true);
  });

  it('repeats pairs for small bond sets, never more than twice', () => {
    const tens = findBondSet('whole-10')!;
    const deck = buildDeck(tens, 'large', 5);
    expect(deck.pairCount).toBe(10);
    const uses = new Map<string, number>();
    for (const c of deck.cards) uses.set(`${c.set}:${sideText(c.side)}`, (uses.get(`${c.set}:${sideText(c.side)}`) ?? 0) + 1);
    const byValue = new Map<string, number>();
    for (const c of deck.cards) byValue.set(sideText(c.side), (byValue.get(sideText(c.side)) ?? 0) + 1);
    expect(Math.max(...byValue.values())).toBeLessThanOrEqual(MAX_COLOUR_SETS * 2); // 5 and 5, twice
    expect(new Set(deck.cards.map((c) => c.set))).toEqual(new Set([0, 1]));
  });

  it('makes a smaller board when a set has too few pairs (halves has one pair, so two at most)', () => {
    const halves = findBondSet('fraction-halves')!;
    expect(buildDeck(halves, 'small', 3).pairCount).toBe(2);
    expect(buildDeck(findBondSet('fraction-quarters')!, 'large', 3).pairCount).toBe(4);
    expect(buildDeck(findBondSet('fraction-eighths')!, 'large', 3).pairCount).toBe(8);
  });

  it('keeps identical-sided pairs: a 5 matches any other 5', () => {
    const deck = buildDeck(findBondSet('whole-10')!, 'large', 9);
    const fives = deck.cards.flatMap((c, i) => (sideText(c.side) === '5' ? [i] : []));
    expect(fives.length).toBeGreaterThanOrEqual(2);
    for (const i of fives) expect(partnersOf(deck)[i].sort((x, y) => x - y)).toEqual(fives.filter((j) => j !== i));
  });

  it('a repeated pair matches either way: any 3 goes with any 7', () => {
    const deck = buildDeck(findBondSet('whole-10')!, 'large', 5);
    const threes = deck.cards.flatMap((c, i) => (sideText(c.side) === '3' ? [i] : []));
    const sevens = deck.cards.flatMap((c, i) => (sideText(c.side) === '7' ? [i] : []));
    expect(threes).toHaveLength(2);
    for (const i of threes) expect(partnersOf(deck)[i].sort((x, y) => x - y)).toEqual(sevens);
  });

  it('is repeatable: same seed same deck, different seed different deck', () => {
    const set = findBondSet('whole-20')!;
    expect(buildDeck(set, 'medium', 42)).toEqual(buildDeck(set, 'medium', 42));
    const layouts = new Set(seeds.map((s) => buildDeck(set, 'medium', s).cards.map((c) => `${c.set}${sideText(c.side)}`).join()));
    expect(layouts.size).toBeGreaterThan(190);
    expect(buildDeck(set, 'medium', 42)).not.toEqual(buildDeck(set, 'medium', 43));
  });

  it('rejects a bad seed', () => {
    const set = findBondSet('whole-10')!;
    for (const bad of [-1, 1.5, 2 ** 31, NaN]) expect(() => buildDeck(set, 'small', bad)).toThrow();
  });
});
