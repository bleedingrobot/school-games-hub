/**
 * Building a deck: which pairs go on the board and where the cards lie. Everything comes from
 * (bond set, board size, seed), so the same inputs always give the same deck.
 */
import { seeded } from '../seededRandom';
import type { BondSet } from './bonds';
import { addExact, sameExact, sideValue, type Exact, type Side } from './exact';

export type BoardSize = 'small' | 'medium' | 'large';

export const BOARD_SIZES: readonly BoardSize[] = ['small', 'medium', 'large'];

/** Pairs wanted on each board: 12, 16 and 20 cards. */
export const BOARD_PAIRS: Record<BoardSize, number> = { small: 6, medium: 8, large: 10 };

/** A pair is never used more than this many times in one deck (once in each colour set). */
export const MAX_COLOUR_SETS = 2;

export interface Card {
  side: Side;
  /** 0 for the first deal of each pair, 1 when the pair is dealt again to fill the board. It doesn't change what matches. */
  set: number;
  /** Which pair of the deck the card was dealt from. */
  pair: number;
}

export interface Deck {
  bondId: string;
  /** What a matching pair adds up to. */
  target: Exact;
  size: BoardSize;
  seed: number;
  cards: readonly Card[];
  pairCount: number;
}

/** Seeds are whole numbers from 0 up to 2^31 - 1, which is the range the hub's random generator handles exactly. */
export const MAX_SEED = 2147483647;
export const isSeed = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_SEED;

/**
 * How many pairs the board can really hold: what was asked for, but no more than every pair twice.
 * A set with only one pair (halves) makes a board of 2 pairs, not 6.
 */
export const pairsOnBoard = (set: BondSet, size: BoardSize): number =>
  Math.min(BOARD_PAIRS[size], set.pairs.length * MAX_COLOUR_SETS);

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildDeck(set: BondSet, size: BoardSize, seed: number): Deck {
  if (!isSeed(seed)) throw new RangeError(`Bad seed ${seed}`);
  const random = seeded(seed);
  random(); random(); // the first draws of this generator are close together for close seeds
  const wanted = pairsOnBoard(set, size);
  // Every pair once (a random choice if there are more than the board needs), then the extras again in the second colour set.
  const first = shuffle(set.pairs, random).slice(0, wanted);
  const again = shuffle(set.pairs, random).slice(0, wanted - first.length);
  const cards: Card[] = [];
  [...first.map((p) => ({ p, set: 0 })), ...again.map((p) => ({ p, set: 1 }))].forEach(({ p, set: colour }, pair) => {
    cards.push({ side: p[0], set: colour, pair }, { side: p[1], set: colour, pair });
  });
  return { bondId: set.id, target: set.target, size, seed, cards: shuffle(cards, random), pairCount: wanted };
}

/**
 * Do these two cards add up to the target? That is all a match needs (James, 20 Oct 2026): any 3 matches any 7, so a
 * child who finds a right pair is never told it's wrong. (A card's `set` only says which round of dealing it came from.)
 */
export const arePartners = (target: Exact, a: Card, b: Card): boolean =>
  sameExact(addExact(sideValue(a.side), sideValue(b.side)), target);

/** For every card, the other cards that would match it. A repeated pair gives a card more than one. */
export const partnersOf = (deck: Deck): number[][] =>
  deck.cards.map((card, i) => deck.cards.flatMap((other, j) => (j !== i && arePartners(deck.target, card, other) ? [j] : [])));
