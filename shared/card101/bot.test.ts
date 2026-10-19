import { describe, expect, it } from 'vitest';
import type { BotLevel } from '../botGame';
import { decide, newMemory, observe } from './bot';
import { type Card } from './cards';
import { newGame, play, type Game } from './engine';
import { randomFromSeed, seededDice, shuffled } from './random';
import { playBotGame, simulate } from './sim';
import { eventsFor, viewFor } from './view';

const LEVELS: BotLevel[] = ['very-easy', 'easy', 'medium'];

describe('bots play whole games by the rules', () => {
  it('every level, 2 to 4 players, 101 and Quick games: every move legal, every game ends', () => {
    // Any illegal bot move would throw a RuleError inside the simulation.
    for (const players of [2, 3, 4]) {
      for (const target of [101, 50] as const) {
        const report = simulate({
          levels: Array.from({ length: players }, (_, i) => LEVELS[(i + players) % 3]),
          games: 12,
          seed: `legal:${players}:${target}`,
          settings: { target },
        });
        expect(report.games).toBe(12);
        expect(report.rounds.mean).toBeGreaterThan(1);
      }
    }
  }, 60_000);
});

describe('bots play fair', () => {
  /** The same game with every card the seat can't see shuffled around. */
  function withHiddenCardsMoved(game: Game, seat: number, seed: string): Game {
    const g = structuredClone(game);
    const visible = new Set<string>();
    if (g.phase === 'peek' && !g.peeked[seat]) [2, 3].forEach((slot) => visible.add(`${seat}:${slot}`));
    g.faceUp.forEach((up, h) => up.forEach((isUp, slot) => isUp && visible.add(`${h}:${slot}`)));
    const spots: { hand: number; slot: number }[] = [];
    g.hands.forEach((hand, h) => hand.forEach((_, slot) => !visible.has(`${h}:${slot}`) && spots.push({ hand: h, slot })));
    const hidden: Card[] = [...spots.map(({ hand, slot }) => g.hands[hand][slot]), ...g.stack];
    if (g.holding?.from === 'stack' && g.turn !== seat) hidden.push(g.holding.card);
    const moved = shuffled(seededDice(seed), hidden);
    spots.forEach(({ hand, slot }) => (g.hands[hand][slot] = moved.shift()!));
    if (g.holding?.from === 'stack' && g.turn !== seat) g.holding.card = moved.pop()!;
    g.stack = moved;
    return g;
  }

  it("a bot's view, and so its choice, is the same whatever the cards it can't see are", () => {
    let compared = 0;
    for (const level of LEVELS) {
      const dice = seededDice(`fair:${level}`);
      let { game, events } = newGame(3, { target: 101 }, dice);
      let memories = [0, 1, 2].map((s) => newMemory(s, 3));
      for (let step = 0; game.phase !== 'over' && step < 400; step++) {
        memories = memories.map((m, s) => observe(m, viewFor(game, s), eventsFor(events, s, game)));
        if (game.phase === 'round-over') {
          ({ game, events } = play(game, 'system', { type: 'next-round' }, dice));
          continue;
        }
        const seat = game.phase === 'peek' ? game.peeked.findIndex((d) => !d) : game.turn;
        const view = viewFor(game, seat);
        const other = viewFor(withHiddenCardsMoved(game, seat, `move:${step}`), seat);
        expect(other).toEqual(view);
        const action = decide(view, memories[seat], level, randomFromSeed(`r${step}`));
        expect(decide(other, memories[seat], level, randomFromSeed(`r${step}`))).toEqual(action);
        compared++;
        ({ game, events } = play(game, seat, action, dice));
      }
    }
    expect(compared).toBeGreaterThan(200);
  }, 30_000);

  it('a bot remembers its peek, and what it swapped in', () => {
    const dice = seededDice('memory');
    let { game, events } = newGame(2, { target: 101 }, dice);
    let memory = observe(newMemory(0, 2), viewFor(game, 0), eventsFor(events, 0, game));
    expect(memory.own).toEqual([null, null, game.hands[0][2], game.hands[0][3]]);
    ({ game, events } = play(game, 'system', { type: 'end-peek' }, dice));
    memory = observe(memory, viewFor(game, 0), eventsFor(events, 0, game));
    if (game.turn !== 0) {
      ({ game, events } = play(game, 1, { type: 'draw', from: 'stack' }, dice));
      memory = observe(memory, viewFor(game, 0), eventsFor(events, 0, game));
      ({ game, events } = play(game, 1, { type: 'throw' }, dice));
      memory = observe(memory, viewFor(game, 0), eventsFor(events, 0, game));
    }
    ({ game, events } = play(game, 0, { type: 'draw', from: 'stack' }, dice));
    const card = game.holding!.card;
    memory = observe(memory, viewFor(game, 0), eventsFor(events, 0, game));
    ({ game, events } = play(game, 0, { type: 'swap', slot: 0 }, dice));
    memory = observe(memory, viewFor(game, 0), eventsFor(events, 0, game));
    expect(memory.own[0]).toBe(card);
    expect(memory.discardPile.at(-1)).toBe(game.discard.at(-1));
  });

  it('it remembers cards other players swap in (they go face up), from the discard pile or the stack', () => {
    const dice = seededDice('watch');
    let { game, events } = newGame(2, { target: 101 }, dice);
    ({ game, events } = play(game, 'system', { type: 'end-peek' }, dice));
    const watcher = 1 - game.turn;
    const mover = game.turn;
    let memory = observe(newMemory(watcher, 2), viewFor(game, watcher), eventsFor(events, watcher, game));
    const top = game.discard.at(-1)!;
    for (const action of [{ type: 'draw', from: 'discard' }, { type: 'swap', slot: 1 }] as const) {
      ({ game, events } = play(game, mover, action, dice));
      memory = observe(memory, viewFor(game, watcher), eventsFor(events, watcher, game));
    }
    expect(memory.others[mover][1]).toBe(top);
    ({ game, events } = play(game, watcher, { type: 'draw', from: 'stack' }, dice));
    ({ game, events } = play(game, watcher, { type: 'throw' }, dice));
    const watcher2 = observe(memory, viewFor(game, watcher), eventsFor(events, watcher, game));
    memory = watcher2;
    ({ game, events } = play(game, mover, { type: 'draw', from: 'stack' }, dice));
    const drawn = game.holding!.card;
    memory = observe(memory, viewFor(game, watcher), eventsFor(events, watcher, game));
    ({ game, events } = play(game, mover, { type: 'swap', slot: 2 }, dice));
    memory = observe(memory, viewFor(game, watcher), eventsFor(events, watcher, game));
    expect(memory.others[mover][2]).toBe(drawn);
    expect(memory.othersKept[mover][2]).toBe(false);
  });
});

describe('each level beats the one below', () => {
  /** Share of games `stronger` wins against `weaker`, half the games in each seat. */
  function winShare(stronger: BotLevel, weaker: BotLevel, games: number): number {
    let wins = 0;
    for (let n = 0; n < games; n++) {
      const first = n % 2 === 0;
      const levels: BotLevel[] = first ? [stronger, weaker] : [weaker, stronger];
      const { game } = playBotGame(levels, { target: 101 }, `levels:${stronger}:${weaker}:${n}`);
      if (game.winners!.includes(first ? 0 : 1)) wins += game.winners!.length > 1 ? 0.5 : 1;
    }
    return wins / games;
  }

  // Over 600 games: Easy beats Very Easy 88%, Medium beats Easy 71%, Medium beats Very Easy 99% (so that one is not
  // played here too). The seeds are fixed, so these give the same answer every run (no flaky failures).
  it('Easy beats Very Easy', () => expect(winShare('easy', 'very-easy', 80)).toBeGreaterThan(0.7), 30_000);
  it('Medium beats Easy', () => expect(winShare('medium', 'easy', 120)).toBeGreaterThan(0.58), 120_000);
});
