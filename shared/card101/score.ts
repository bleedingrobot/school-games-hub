/**
 * Scoring a hand of four cards, the way James's family plays (docs/101-RULES.md):
 *
 *   1. Three or four of a kind: the whole hand scores 0.
 *   2. Pairs: two cards of the same rank, anywhere, cancel each other (both score 0).
 *   3. 3s: each 3 scores 0 and cancels the highest card still counting. A tie for highest
 *      cancels just one card. Two 3s cancel two cards (even though they're also a pair).
 *   4. Add up what's left.
 *
 * Besides the total, it returns each step, so the end-of-round screen can show the
 * working: "the 7s cancel", "the 3 cancels the Queen", "4 + 0 = 4".
 */
import { cardValue, rankOf, type Card, type Rank } from './cards';

export type ScoreStep =
  | { kind: 'triple'; rank: Rank; slots: number[] }
  | { kind: 'pair'; rank: Rank; slots: [number, number] }
  | { kind: 'three-cancels'; three: number; cancels: number; value: number };

export interface HandScore {
  total: number;
  /** What each card ends up scoring, in slot order (0 when cancelled). */
  values: number[];
  steps: ScoreStep[];
}

export function scoreHand(hand: readonly Card[]): HandScore {
  const values = hand.map(cardValue);
  const steps: ScoreStep[] = [];
  const slotsByRank = new Map<Rank, number[]>();
  hand.forEach((card, slot) => {
    const rank = rankOf(card);
    slotsByRank.set(rank, [...(slotsByRank.get(rank) ?? []), slot]);
  });

  for (const [rank, slots] of slotsByRank) {
    if (slots.length >= 3) {
      steps.push({ kind: 'triple', rank, slots });
      return { total: 0, values: values.map(() => 0), steps };
    }
  }

  const cancelled = new Set<number>();
  for (const [rank, slots] of slotsByRank) {
    if (slots.length === 2) {
      steps.push({ kind: 'pair', rank, slots: [slots[0], slots[1]] });
      for (const slot of slots) cancelled.add(slot);
    }
  }

  for (const three of slotsByRank.get('3') ?? []) {
    let highest = -1;
    hand.forEach((_, slot) => {
      if (cancelled.has(slot) || values[slot] === 0) return;
      if (highest < 0 || values[slot] > values[highest]) highest = slot;
    });
    if (highest < 0) break;
    steps.push({ kind: 'three-cancels', three, cancels: highest, value: values[highest] });
    cancelled.add(highest);
  }

  const finalValues = values.map((value, slot) => (cancelled.has(slot) ? 0 : value));
  return { total: finalValues.reduce((a, b) => a + b, 0), values: finalValues, steps };
}
