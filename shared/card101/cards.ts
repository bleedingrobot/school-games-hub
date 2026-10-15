/**
 * The pack for 101: 52 cards, each written as two characters, rank then suit.
 * Ranks: A 2 3 4 5 6 7 8 9 T(en) J Q K. Suits: C(lubs) D(iamonds) H(earts) S(pades).
 * So "QH" is the Queen of hearts and "TS" the 10 of spades.
 *
 * Two characters, always upper case, so a test can find every card in any message
 * with one pattern (CARD_PATTERN) and prove no hidden card ever leaves the server.
 */

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'] as const;
export const SUITS = ['C', 'D', 'H', 'S'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = `${Rank}${Suit}`;

/** Every card, in a fixed order (shuffle a copy). */
export const PACK: readonly Card[] = SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}` as Card));

/** Finds every card written anywhere in a piece of text (for the hidden-card tests). */
export const CARD_PATTERN = /\b[A2-9TJQK][CDHS]\b/g;

export function isCard(value: unknown): value is Card {
  return typeof value === 'string' && PACK.includes(value as Card);
}

export const rankOf = (card: Card) => card[0] as Rank;
export const suitOf = (card: Card) => card[1] as Suit;

/** What a card scores on its own: King 0, 3 0, Ace 1, 2 and 4–10 face value, Jack and Queen 10. */
export function cardValue(card: Card): number {
  const rank = rankOf(card);
  if (rank === 'K' || rank === '3') return 0;
  if (rank === 'A') return 1;
  if (rank === 'T' || rank === 'J' || rank === 'Q') return 10;
  return Number(rank);
}

const RANK_NAMES: Record<Rank, string> = {
  A: 'Ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  T: '10', J: 'Jack', Q: 'Queen', K: 'King',
};
const SUIT_NAMES: Record<Suit, string> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
const SUIT_SYMBOLS: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };

/** "Queen of hearts". */
export const cardName = (card: Card) => `${RANK_NAMES[rankOf(card)]} of ${SUIT_NAMES[suitOf(card)]}`;
/** "Q♥", for the scoring working. */
export const cardShort = (card: Card) => `${rankOf(card) === 'T' ? '10' : rankOf(card)}${SUIT_SYMBOLS[suitOf(card)]}`;
export const rankName = (rank: Rank) => RANK_NAMES[rank];
export const isRed = (card: Card) => suitOf(card) === 'D' || suitOf(card) === 'H';

/** Where each of your four cards sits. The bottom two (nearest you) are the ones you peek at. */
export const SLOTS = [0, 1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];
export const PEEK_SLOTS: readonly Slot[] = [2, 3];
export const SLOT_NAMES: Record<Slot, string> = { 0: 'top left', 1: 'top right', 2: 'bottom left', 3: 'bottom right' };

export const isSlot = (value: unknown): value is Slot => SLOTS.includes(value as Slot);
