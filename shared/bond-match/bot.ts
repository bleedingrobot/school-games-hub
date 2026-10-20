/**
 * The computer player. It plays like a child with a so-so memory: it only ever knows what has been turned
 * face up (it is never given the deck), it remembers the last few cards it has seen, and sometimes it
 * ignores what it remembers and guesses.
 */
import type { BotLevel } from '../botGame';
import { arePartners, type Card } from './deck';
import type { GameEvent, GameState } from './engine';
import type { Exact } from './exact';

export type { BotLevel };

export const BOT_MEMORY: Record<BotLevel, { cards: number; slip: number }> = {
  /** `cards`: how many face-up cards it can keep in mind. `slip`: how often it guesses even when it knows a partner. */
  'very-easy': { cards: 2, slip: 0.3 },
  easy: { cards: 5, slip: 0.15 },
  medium: { cards: 8, slip: 0.05 },
};

export interface Seen {
  index: number;
  card: Card;
}

/** What the computer remembers, oldest first. */
export type Memory = readonly Seen[];

/** Write down a card that has just been turned face up, forgetting the oldest if the level's memory is full. */
export function remember(memory: Memory, index: number, card: Card, level: BotLevel): Memory {
  const kept = [...memory.filter((s) => s.index !== index), { index, card }];
  return kept.slice(-BOT_MEMORY[level].cards);
}

/** Everything the computer is allowed to look at when it picks a card. There is deliberately no deck in here. */
export interface BotView {
  target: Exact;
  /** Which cards are matched, by position. */
  matched: readonly boolean[];
  /** The card already turned over this turn, if there is one waiting for its partner. */
  waiting?: number;
  memory: Memory;
}

/** The position of the card to flip next. `random` gives numbers from 0 up to (not including) 1. */
export function chooseFlip(view: BotView, level: BotLevel, random: () => number): number {
  const { target, matched, waiting, memory } = view;
  const open = memory.filter((s) => !matched[s.index] && s.index !== waiting);
  const guessing = random() < BOT_MEMORY[level].slip;

  if (!guessing) {
    if (waiting !== undefined) {
      const mine = memory.find((s) => s.index === waiting);
      const partner = mine && open.find((s) => arePartners(target, mine.card, s.card));
      if (partner) return partner.index;
    } else {
      for (const a of open) {
        const partner = open.find((b) => b.index !== a.index && arePartners(target, a.card, b.card));
        if (partner) return a.index;
      }
    }
  }

  // A guess: a card it has not got in mind if there is one, else any card still in play.
  const remembered = new Set(memory.map((s) => s.index));
  const choices = matched.flatMap((m, i) => (m || i === waiting ? [] : [i]));
  const fresh = choices.filter((i) => !remembered.has(i));
  const from = fresh.length > 0 ? fresh : choices;
  return from[Math.floor(random() * from.length)];
}

/** What the computer may see of a game: the target, what's matched and what's face up. Never the face-down cards. */
export function botView(game: GameState, memory: Memory): BotView {
  return {
    target: game.deck.target,
    matched: game.matched,
    waiting: game.shown.length === 1 ? game.shown[0] : undefined,
    memory,
  };
}

/**
 * Writes down every card a flip turned face up (by either player: everyone sees the board). `game` is the state after
 * the flip; only cards named in the events, which are face up, are read from it.
 */
export function rememberFlip(memory: Memory, game: GameState, events: readonly GameEvent[], level: BotLevel): Memory {
  let next = memory;
  for (const e of events) {
    const faceUp = e.type === 'first' ? [e.card] : e.type === 'mismatch' ? e.cards : [];
    for (const i of faceUp) next = remember(next, i, game.deck.cards[i], level);
  }
  return next;
}
