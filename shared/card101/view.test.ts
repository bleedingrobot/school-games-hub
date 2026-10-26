/**
 * The hidden-card test. Plays many random games (every kind of move, including
 * skips, leaving and reshuffles) and, after every single move, checks what every player
 * would be sent: their view and their events. Any card in there must be one that player
 * is allowed to know at that moment. If one isn't, a card has leaked.
 */
import { describe, expect, it } from 'vitest';
import { CARD_PATTERN, SLOTS, type Card } from './cards';
import { canKnock, newGame, play, RuleError, type Action, type Actor, type Game, type GameEvent } from './engine';
import { randomFromSeed, seededDice } from './random';
import { eventsFor, viewFor } from './view';

/** The cards `seat` may know right now, worked out from the whole game. */
function allowedCards(game: Game, seat: number): Set<Card> {
  const allowed = new Set<Card>(game.discard);
  game.hands.forEach((hand, s) => hand.forEach((card, slot) => game.faceUp[s][slot] && allowed.add(card)));
  if (game.holding && (game.holding.from === 'discard' || game.turn === seat)) allowed.add(game.holding.card);
  if (game.phase === 'peek' && !game.out[seat] && !game.peeked[seat]) {
    allowed.add(game.hands[seat][2]);
    allowed.add(game.hands[seat][3]);
  }
  const last = game.results.at(-1);
  if ((game.phase === 'round-over' || game.phase === 'over') && last && last.round === game.round) {
    for (const hand of last.hands) for (const card of hand) allowed.add(card);
  }
  return allowed;
}

/** Every card written anywhere in something that would be sent to a browser. */
const cardsIn = (value: unknown) => new Set((JSON.stringify(value).match(CARD_PATTERN) ?? []) as Card[]);

function leaks(game: Game, events: GameEvent[], seat: number): Card[] {
  const allowed = allowedCards(game, seat);
  const sent = cardsIn({ view: viewFor(game, seat), events: eventsFor(events, seat, game) });
  return [...sent].filter((card) => !allowed.has(card));
}

/** A random allowed move (sometimes a skip or someone leaving), like a messy classroom game. */
function randomMove(game: Game, random: () => number, knockChance: number): [Actor, Action] {
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const live = game.out.map((out, seat) => (out ? -1 : seat)).filter((seat) => seat >= 0);
  if (random() < 0.01) return [pick(live), { type: 'leave' }];
  if (game.phase === 'round-over') return ['system', { type: 'next-round' }];
  if (game.phase === 'peek') {
    if (random() < 0.2) return ['system', { type: 'end-peek' }];
    return [pick(live.filter((s) => !game.peeked[s])), { type: 'peek-done' }];
  }
  if (random() < 0.05) return ['system', { type: 'skip' }];
  const seat = game.turn;
  if (game.holding) return [seat, random() < 0.3 ? { type: 'throw' } : { type: 'swap', slot: pick([...SLOTS]) }];
  if (canKnock(game, seat) && random() < knockChance) return [seat, { type: 'knock' }];
  return [seat, { type: 'draw', from: game.discard.length && random() < 0.4 ? 'discard' : 'stack' }];
}

describe('no card ever leaks', () => {
  it('in many random games, every view and every event holds only allowed cards', () => {
    let moves = 0;
    let checked = 0;
    let reshuffles = 0;
    for (let n = 0; n < 20; n++) {
      const random = randomFromSeed(`leak:${n}`);
      const dice = seededDice(`leak-deck:${n}`);
      const players = 2 + (n % 3);
      let { game, events } = newGame(players, { target: n % 2 ? 101 : 50 }, dice);
      for (let guard = 0; game.phase !== 'over' && guard < 3000; guard++) {
        for (let seat = 0; seat < players; seat++) {
          expect(leaks(game, events, seat), `game ${n}, move ${moves}, seat ${seat}`).toEqual([]);
          checked++;
        }
        // Some games hardly ever knock, so the stack runs out and gets reshuffled.
        const [actor, action] = randomMove(game, random, n % 4 === 0 ? 0.003 : 0.15);
        try {
          ({ game, events } = play(game, actor, action, dice));
          moves++;
          if (events.some((e) => e.kind === 'reshuffle')) reshuffles++;
        } catch (error) {
          if (!(error instanceof RuleError)) throw error;
          events = [];
        }
      }
    }
    expect(moves).toBeGreaterThan(1_000);
    expect(checked).toBeGreaterThan(3_000);
    expect(reshuffles).toBeGreaterThan(0);
  });
});
