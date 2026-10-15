/**
 * The words on the 101 screen: bot names, what each event says in the game log, and
 * the scoring working ("The 7s cancel", "The 3 cancels the Queen").
 */
import type { BotLevel } from '../../../shared/botGame';
import { cardName, cardShort, rankName, rankOf, SLOT_NAMES, type Card } from '../../../shared/card101/cards';
import type { GameEvent } from '../../../shared/card101/engine';
import type { HandScore } from '../../../shared/card101/score';

export const BOT_LEVEL_NAMES: Record<BotLevel, string> = {
  'very-easy': 'Very Easy',
  easy: 'Easy',
  medium: 'Medium',
};

/** The bots' names (NZ birds). */
export const BOT_BIRDS = ['Kea', 'Tūī', 'Weka'];

export const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

/** "your" for the student, "their" for everyone else. */
export const whose = (isMe: boolean) => (isMe ? 'your' : 'their');

/** One line for the game log, or null for events that don't need one. `me` is the student's seat. */
export function eventLine(event: GameEvent, names: readonly string[], me: number): string | null {
  const who = (seat: number) => (seat === me ? 'You' : names[seat]);
  switch (event.kind) {
    case 'deal':
      return `Round ${event.round}. ${event.starter === me ? 'You start' : `${names[event.starter]} starts`}.`;
    case 'play-starts':
      return null;
    case 'peek-done':
      return null;
    case 'draw':
      if (event.from === 'discard') return `${who(event.seat)} took the ${cardName(event.card)} from the discard pile.`;
      return event.card && event.seat === me
        ? `You took the ${cardName(event.card)} from the stack.`
        : `${who(event.seat)} took a card from the stack.`;
    case 'swap':
      return `${who(event.seat)} put the ${cardName(event.placed)} face up in ${whose(event.seat === me)} ${SLOT_NAMES[event.slot]} spot, and threw away the ${cardName(event.discarded)}.`;
    case 'throw':
      return `${who(event.seat)} threw away the ${cardName(event.card)}.`;
    case 'knock':
      return `${who(event.seat)} knocked! Everyone else gets one last turn.`;
    case 'skip':
      return `${who(event.seat)} ran out of time.`;
    case 'reshuffle':
      return `The stack ran out, so the discard pile was shuffled into a new stack.`;
    case 'out':
      return event.reason === 'left' ? `${who(event.seat)} left the game.` : `${who(event.seat)} missed too many turns and is out.`;
    case 'turn':
      return null;
    case 'round-end': {
      const winners = event.result.winners.map(who);
      return `Round ${event.result.round} over: ${listNames(winners)} ${winners.length > 1 ? 'share' : event.result.winners[0] === me ? 'win' : 'wins'} it.`;
    }
    case 'game-over': {
      const winners = event.winners.map(who);
      return `Game over! ${listNames(winners)} ${winners.length > 1 ? 'share the win' : event.winners[0] === me ? 'win' : 'wins'}.`;
    }
  }
}

export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The scoring working for one hand, one sentence per step, then the sum. */
export function scoreLines(hand: readonly Card[], score: HandScore): { steps: string[]; sum: string } {
  const steps: string[] = [];
  let triple = false;
  for (const step of score.steps) {
    if (step.kind === 'triple') {
      triple = true;
      steps.push(`${step.slots.length === 4 ? 'Four' : 'Three'} ${rankName(step.rank)}s: the whole hand scores 0!`);
    } else if (step.kind === 'pair') {
      // A pair of 3s doesn't just cancel: each 3 then cancels a card too (the lines after).
      steps.push(step.rank === '3' ? 'Two 3s: each one cancels a card.' : `The ${rankName(step.rank)}s are a pair, so they cancel out.`);
    } else {
      steps.push(`The 3 cancels the ${rankName(rankOf(hand[step.cancels]))}: ${step.value} → 0.`);
    }
  }
  // What's left to add up: cards not crossed out, leaving out the 3s (they've done their job).
  const crossed = cancelledSlots(score);
  const left = hand.flatMap((card, slot) => (crossed.has(slot) || rankOf(card) === '3' ? [] : [score.values[slot]]));
  const sum = triple || left.length === 0 ? 'Hand: 0' : left.length === 1 ? `Hand: ${score.total}` : `Hand: ${left.join(' + ')} = ${score.total}`;
  return { steps, sum };
}

/** The slots a hand's working crossed out (cancelled by a pair, a 3 or three of a kind). */
export function cancelledSlots(score: HandScore): Set<number> {
  const out = new Set<number>();
  for (const step of score.steps) {
    if (step.kind === 'triple' || step.kind === 'pair') step.slots.forEach((s) => out.add(s));
    if (step.kind === 'three-cancels') out.add(step.cancels);
  }
  return out;
}

/** "Q♥" for short labels. */
export const shortName = cardShort;
