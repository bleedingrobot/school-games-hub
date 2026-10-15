/**
 * The hidden-card tests. Plays thousands of random games (every kind of move, including
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
  it('in thousands of random games, every view and every event holds only allowed cards', () => {
    let moves = 0;
    let checked = 0;
    let reshuffles = 0;
    for (let n = 0; n < 300; n++) {
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
    expect(moves).toBeGreaterThan(20_000);
    expect(checked).toBeGreaterThan(60_000);
    expect(reshuffles).toBeGreaterThan(10);
  }, 60_000);

  it('the checker itself catches a leak (sending the whole game would fail)', () => {
    const { game } = newGame(3, { target: 101 }, seededDice('catch'));
    const sent = cardsIn(game);
    const allowed = allowedCards(game, 0);
    expect([...sent].filter((c) => !allowed.has(c)).length).toBeGreaterThan(40);
  });
});

describe('what each player sees', () => {
  const start = () => newGame(3, { target: 101 }, seededDice('views'));

  it("nobody sees the stack or anyone's face-down cards; only the top of the discard pile", () => {
    const { game } = start();
    const view = viewFor({ ...game, phase: 'play', peeked: [true, true, true] }, 1);
    expect(view.stackCount).toBe(game.stack.length);
    expect(view.discardTop).toBe(game.discard[0]);
    expect(view.cardsOnTable).toEqual([4, 4, 4]);
    expect(view.peek).toBeNull();
    expect(cardsIn(view)).toEqual(new Set([game.discard[0]]));
  });

  it('the peek shows your bottom two cards, only to you, until you finish it; reloading shows the same, then nothing', () => {
    let { game } = start();
    const mine = viewFor(game, 0);
    expect(mine.peek).toEqual({ slots: [2, 3], cards: [game.hands[0][2], game.hands[0][3]] });
    expect(viewFor(game, 0)).toEqual(mine); // a reload during the peek
    expect(cardsIn(viewFor(game, 1)).has(game.hands[0][2])).toBe(false);
    game = play(game, 0, { type: 'peek-done' }, seededDice('x')).game;
    expect(viewFor(game, 0).peek).toBeNull();
    expect(cardsIn(viewFor(game, 0)).has(game.hands[0][2])).toBe(false);
    expect(viewFor(game, 1).peek).not.toBeNull();
    game = play(game, 'system', { type: 'end-peek' }, seededDice('x')).game;
    expect([0, 1, 2].map((s) => viewFor(game, s).peek)).toEqual([null, null, null]);
  });

  it('a card drawn from the stack: only the drawer sees it, and only while holding it', () => {
    let { game } = start();
    const dice = seededDice('d');
    game = play(game, 'system', { type: 'end-peek' }, dice).game;
    const drawer = game.turn;
    const other = (drawer + 1) % 3;
    const drawn = play(game, drawer, { type: 'draw', from: 'stack' }, dice);
    const card = drawn.game.holding!.card;
    expect(viewFor(drawn.game, drawer).holding).toEqual({ seat: drawer, from: 'stack', card });
    expect(eventsFor(drawn.events, drawer, drawn.game)).toEqual([{ kind: 'draw', seat: drawer, from: 'stack', card }]);
    expect(viewFor(drawn.game, other).holding).toEqual({ seat: drawer, from: 'stack', card: null });
    expect(eventsFor(drawn.events, other, drawn.game)).toEqual([{ kind: 'draw', seat: drawer, from: 'stack' }]);
    // Swapped in: gone, even for the drawer, and even in the events of that same change.
    const swapped = play(drawn.game, drawer, { type: 'swap', slot: 0 }, dice);
    for (const seat of [0, 1, 2]) {
      expect(cardsIn({ v: viewFor(swapped.game, seat), e: eventsFor([...drawn.events, ...swapped.events], seat, swapped.game) }).has(card)).toBe(false);
    }
  });

  it('a card taken from the discard pile stays visible to everyone (they all saw it), until it goes into a hand', () => {
    let { game } = start();
    const dice = seededDice('d2');
    game = play(game, 'system', { type: 'end-peek' }, dice).game;
    const top = game.discard[0];
    const taken = play(game, game.turn, { type: 'draw', from: 'discard' }, dice).game;
    expect(viewFor(taken, (taken.turn + 1) % 3).holding).toEqual({ seat: taken.turn, from: 'discard', card: top });
    const swapped = play(taken, taken.turn, { type: 'swap', slot: 1 }, dice).game;
    expect(cardsIn(viewFor(swapped, 0)).has(top)).toBe(false);
  });

  it("everyone's cards are shown when the round ends, and hidden again once the next round is dealt", () => {
    let { game } = start();
    const dice = seededDice('d3');
    game = play(game, 'system', { type: 'end-peek' }, dice).game;
    for (let i = 0; i < 3; i++) {
      game = play(game, game.turn, { type: 'draw', from: 'stack' }, dice).game;
      game = play(game, game.turn, { type: 'throw' }, dice).game;
    }
    game = play(game, game.turn, { type: 'knock' }, dice).game;
    let ended: GameEvent[] = [];
    while (game.phase === 'play') {
      game = play(game, game.turn, { type: 'draw', from: 'stack' }, dice).game;
      ({ game, events: ended } = play(game, game.turn, { type: 'throw' }, dice));
    }
    const hands = game.hands.flat();
    const view = viewFor(game, 2);
    expect(view.lastRound!.hands.flat()).toEqual(hands);
    expect(eventsFor(ended, 2, game).some((e) => e.kind === 'round-end' && e.result.hands.length === 3)).toBe(true);
    const next = play(game, 'system', { type: 'next-round' }, dice);
    expect(viewFor(next.game, 2).lastRound).toBeNull();
    expect(viewFor(next.game, 2).history).toHaveLength(1);
    // Old round-end events sent with the new deal would carry no cards.
    const late = eventsFor([...ended, ...next.events], 2, next.game);
    expect(late.find((e) => e.kind === 'round-end')).toMatchObject({ result: { hands: [] } });
  });
});
