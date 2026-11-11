import { describe, expect, it } from 'vitest';
import { PACK, type Card } from './cards';
import { newGame, play, type Action, type Actor, type Game, type GameEvent } from './engine';
import { seededDice } from './random';

const dice = seededDice('engine-test');
const cards = (text: string) => (text ? text.split(' ') : []) as Card[];

/** A game in the "play" phase with these hands, stack (last = top) and discard pile (last = top). */
function table(hands: string[], stack = 'KS', discard = '5H', extra: Partial<Game> = {}): Game {
  const { game } = newGame(hands.length, { target: 101 }, dice);
  return {
    ...game,
    hands: hands.map(cards),
    stack: cards(stack),
    discard: cards(discard),
    phase: 'play',
    starter: 0,
    turn: 0,
    peeked: hands.map(() => true),
    ...extra,
  };
}

/** Plays a list of [actor, action] steps and returns the final game and every event. */
function run(game: Game, steps: [Actor, Action][]): { game: Game; events: GameEvent[] } {
  const events: GameEvent[] = [];
  for (const [actor, action] of steps) {
    const result = play(game, actor, action, dice);
    game = result.game;
    events.push(...result.events);
  }
  return { game, events };
}

const draw = (from: 'stack' | 'discard'): Action => ({ type: 'draw', from });
const THROW: Action = { type: 'throw' };
const KNOCK: Action = { type: 'knock' };

/** Everyone takes one turn (stack, throw it away), starting from whoever's turn it is. */
function lap(game: Game): Game {
  let g = game;
  for (let i = 0; i < g.players; i++) g = run(g, [[g.turn, draw('stack')], [g.turn, THROW]]).game;
  return g;
}

describe('knocking', () => {
  const three = () => table(['AH 2H 4H 6H', 'QS QC QD QH', '9S 9C 7D 8H'], PACK.slice(0, 30).join(' '), '5H');

  it('knocking is your whole turn; then everyone else gets one last turn, then the round is scored', () => {
    let g = lap(three());
    const knocked = run(g, [[0, KNOCK]]);
    g = knocked.game;
    expect(knocked.events).toEqual([{ kind: 'knock', seat: 0 }, { kind: 'turn', seat: 1, lastTurn: true }]);
    expect(() => play(g, 1, KNOCK, dice)).toThrow('already knocked');
    g = run(g, [[1, draw('stack')], [1, THROW]]).game;
    expect(g.turn).toBe(2);
    expect(g.phase).toBe('play');
    const end = run(g, [[2, draw('stack')], [2, THROW]]);
    expect(end.game.phase).toBe('round-over');
    const roundEnd = end.events.find((e) => e.kind === 'round-end');
    expect(roundEnd && roundEnd.kind === 'round-end' && roundEnd.result).toMatchObject({
      round: 1,
      winners: [1], // four Queens: 0
      knocker: 0,
    });
  });

});

describe('rounds and the end of the game', () => {
  function finishRound(g: Game): Game {
    g = lap(g);
    const knocker = g.turn;
    g = run(g, [[knocker, KNOCK]]).game;
    while (g.phase === 'play') g = run(g, [[g.turn, draw('stack')], [g.turn, THROW]]).game;
    return g;
  }

  it('ends when a total reaches 101 or more; lowest total wins', () => {
    let g = table(['QH JC TD 9S', 'AH 2H 4H 6H'], PACK.slice(0, 30).join(' '), '5H', { totals: [70, 60] });
    g = finishRound(g);
    expect(g.totals).toEqual([70 + 39, 60 + 13]);
    expect(g.phase).toBe('over');
    expect(g.winners).toEqual([1]);
    expect(() => play(g, 0, draw('stack'), dice)).toThrow('The game is over');
    expect(() => play(g, 'system', { type: 'next-round' }, dice)).toThrow('The game is over');
  });

});

