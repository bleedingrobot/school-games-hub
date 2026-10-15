import { describe, expect, it } from 'vitest';
import { PACK, type Card } from './cards';
import { newGame, play, RuleError, SKIPS_TO_OUT, type Action, type Actor, type Game, type GameEvent } from './engine';
import { secureDice, seededDice } from './random';

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
const swap = (slot: 0 | 1 | 2 | 3): Action => ({ type: 'swap', slot });
const THROW: Action = { type: 'throw' };
const KNOCK: Action = { type: 'knock' };

/** Everyone takes one turn (stack, throw it away), starting from whoever's turn it is. */
function lap(game: Game): Game {
  let g = game;
  for (let i = 0; i < g.players; i++) g = run(g, [[g.turn, draw('stack')], [g.turn, THROW]]).game;
  return g;
}

describe('a new game', () => {
  it('deals 4 cards each, turns one face up, and the rest is the stack', () => {
    for (const players of [2, 3, 4]) {
      const { game, events } = newGame(players, { target: 101 }, seededDice(`deal${players}`));
      expect(game.hands.every((h) => h.length === 4)).toBe(true);
      expect(game.discard).toHaveLength(1);
      expect(game.stack).toHaveLength(52 - 4 * players - 1);
      expect(new Set([...game.hands.flat(), ...game.stack, ...game.discard])).toEqual(new Set(PACK));
      expect(game.phase).toBe('peek');
      expect(game.round).toBe(1);
      expect(events).toEqual([{ kind: 'deal', round: 1, starter: game.starter, discardTop: game.discard[0] }]);
    }
  });

  it('only 2 to 4 players, and only 101 or 50', () => {
    expect(() => newGame(1, { target: 101 }, dice)).toThrow(RuleError);
    expect(() => newGame(5, { target: 101 }, dice)).toThrow(RuleError);
    expect(() => newGame(2, { target: 77 as 101 }, dice)).toThrow(RuleError);
  });

  it('picks who starts at random', () => {
    const starters = new Set(Array.from({ length: 40 }, (_, i) => newGame(4, { target: 101 }, seededDice(`s${i}`)).game.starter));
    expect(starters.size).toBe(4);
  });

  it('the same seed always deals the same cards', () => {
    expect(newGame(3, { target: 101 }, seededDice('same')).game).toEqual(newGame(3, { target: 101 }, seededDice('same')).game);
  });
});

describe('the peek', () => {
  it('play starts once everyone has finished peeking, with the starter', () => {
    let { game } = newGame(3, { target: 101 }, seededDice('peek'));
    expect(() => play(game, game.starter, draw('stack'), dice)).toThrow("It isn't time to play");
    game = run(game, [[0, { type: 'peek-done' }], [2, { type: 'peek-done' }]]).game;
    expect(game.phase).toBe('peek');
    const last = run(game, [[1, { type: 'peek-done' }]]);
    expect(last.game.phase).toBe('play');
    expect(last.game.turn).toBe(game.starter);
    expect(last.events.at(-1)).toEqual({ kind: 'play-starts', turn: game.starter });
  });

  it("you can't peek twice, and only the referee can end everyone's peek", () => {
    const { game } = newGame(2, { target: 101 }, seededDice('peek2'));
    const after = run(game, [[0, { type: 'peek-done' }]]).game;
    expect(() => play(after, 0, { type: 'peek-done' }, dice)).toThrow('already over');
    expect(() => play(after, 1, { type: 'end-peek' }, dice)).toThrow(RuleError);
    expect(run(after, [['system', { type: 'end-peek' }]]).game.phase).toBe('play');
  });
});

describe('a turn', () => {
  it('take from the stack and swap it in: the old card goes face up on the discard pile', () => {
    const { game, events } = run(table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC 9C', '5H'), [[0, draw('stack')], [0, swap(1)]]);
    expect(game.hands[0]).toEqual(cards('AH 9C 4H 6H'));
    expect(game.discard).toEqual(cards('5H 2H'));
    expect(game.stack).toEqual(cards('TC'));
    expect(game.turn).toBe(1);
    expect(events).toEqual([
      { kind: 'draw', seat: 0, from: 'stack', card: '9C' },
      { kind: 'swap', seat: 0, slot: 1, placed: '9C', discarded: '2H' },
      { kind: 'turn', seat: 1, lastTurn: false },
    ]);
  });

  it('a swapped-in card goes face up, and that spot is locked for the rest of the round (James)', () => {
    let { game } = run(table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC 9C 8C 7C', '5H'), [[0, draw('stack')], [0, swap(1)]]);
    expect(game.faceUp[0]).toEqual([false, true, false, false]);
    expect(game.faceUp[1]).toEqual([false, false, false, false]);
    game = run(game, [[1, draw('stack')], [1, THROW], [0, draw('stack')]]).game;
    expect(() => play(game, 0, swap(1), dice)).toThrow(/face up/);
    game = run(game, [[0, swap(0)]]).game;
    expect(game.faceUp[0]).toEqual([true, true, false, false]);
  });

  it('with all four cards face up you can only throw away (or knock)', () => {
    const start = table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC 9C', '5H', {
      faceUp: [[true, true, true, true], [false, false, false, false]],
    });
    const holding = run(start, [[0, draw('stack')]]).game;
    for (const slot of [0, 1, 2, 3] as const) expect(() => play(holding, 0, swap(slot), dice)).toThrow(/face up/);
    expect(run(holding, [[0, THROW]]).game.turn).toBe(1);
  });

  it('the next round deals everything face down again', () => {
    const { game } = newGame(2, { target: 101 }, dice);
    const after = run({ ...game, phase: 'round-over', faceUp: [[true, true, true, true], [true, false, false, false]] }, [['system', { type: 'next-round' }]]).game;
    expect(after.faceUp).toEqual([[false, false, false, false], [false, false, false, false]]);
  });

  it('take from the stack and throw it away', () => {
    const { game } = run(table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC 9C', '5H'), [[0, draw('stack')], [0, THROW]]);
    expect(game.hands[0]).toEqual(cards('AH 2H 4H 6H'));
    expect(game.discard).toEqual(cards('5H 9C'));
  });

  it('take the face-up card and swap it in', () => {
    const { game } = run(table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC', '8S 5H'), [[0, draw('discard')], [0, swap(3)]]);
    expect(game.hands[0]).toEqual(cards('AH 2H 4H 5H'));
    expect(game.discard).toEqual(cards('8S 6H'));
  });

  it('take the face-up card and put it straight back (James: allowed)', () => {
    const { game, events } = run(table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC', '8S 5H'), [[0, draw('discard')], [0, THROW]]);
    expect(game.discard).toEqual(cards('8S 5H'));
    expect(game.turn).toBe(1);
    expect(events[1]).toEqual({ kind: 'throw', seat: 0, card: '5H' });
  });

  it('refuses moves out of turn, twice, or in the wrong order', () => {
    const g = table(['AH 2H 4H 6H', 'QS QC QD QH']);
    expect(() => play(g, 1, draw('stack'), dice)).toThrow("It isn't your turn");
    expect(() => play(g, 0, swap(0), dice)).toThrow('Take a card first');
    expect(() => play(g, 0, THROW, dice)).toThrow('Take a card first');
    const holding = run(g, [[0, draw('stack')]]).game;
    expect(() => play(holding, 0, draw('stack'), dice)).toThrow('already holding');
    expect(() => play(holding, 0, KNOCK, dice)).toThrow(RuleError);
    expect(() => play(holding, 0, swap(4 as 0), dice)).toThrow('Pick one of your four cards');
    expect(() => play(g, 7, draw('stack'), dice)).toThrow('No such player');
    expect(() => play(g, 'system', draw('stack'), dice)).toThrow(RuleError);
    expect(() => play(g, 0, { type: 'dance' } as unknown as Action, dice)).toThrow('Unknown move');
  });

  it("an empty discard pile can't be drawn from", () => {
    const g = run(table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC 9C', '5H'), [[0, draw('discard')]]).game;
    const next = run(g, [[0, swap(0)]]).game;
    expect(next.discard).toEqual(cards('AH'));
    const empty = { ...table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC 9C', '5H'), discard: [] };
    expect(() => play(empty, 0, draw('discard'), dice)).toThrow('empty');
  });

  it('never changes the game it was given', () => {
    const g = table(['AH 2H 4H 6H', 'QS QC QD QH'], 'TC 9C', '5H');
    const copy = structuredClone(g);
    run(g, [[0, draw('stack')], [0, swap(1)]]);
    expect(g).toEqual(copy);
  });

  it('turns go round the table and skip players who are out', () => {
    let g = table(['AH 2H 4H 6H', 'QS QC QD QH', 'KS KC KD KH'], PACK.slice(0, 30).join(' '), '5H');
    g = run(g, [[1, { type: 'leave' }]]).game;
    g = run(g, [[0, draw('stack')], [0, THROW]]).game;
    expect(g.turn).toBe(2);
    g = run(g, [[2, draw('stack')], [2, THROW]]).game;
    expect(g.turn).toBe(0);
  });
});

describe('the stack running out', () => {
  it('shuffles the discard pile, except its top card, into a new stack', () => {
    const g = table(['AH 2H 4H 6H', 'QS QC QD QH'], '', '7C 8C 9C 5H');
    const { game, events } = run(g, [[0, draw('stack')]]);
    expect(game.discard).toEqual(cards('5H'));
    expect(game.stack).toHaveLength(2);
    expect(new Set([...game.stack, game.holding!.card])).toEqual(new Set(cards('7C 8C 9C')));
    expect(events[0]).toEqual({ kind: 'reshuffle', cards: 3 });
  });

  it("with nothing to reshuffle, you can't draw from the stack (but can take the face-up card)", () => {
    const g = table(['AH 2H 4H 6H', 'QS QC QD QH'], '', '5H');
    expect(() => play(g, 0, draw('stack'), dice)).toThrow('no cards left');
    expect(run(g, [[0, draw('discard')]]).game.holding).toEqual({ card: '5H', from: 'discard' });
  });
});

describe('knocking', () => {
  const three = () => table(['AH 2H 4H 6H', 'QS QC QD QH', '9S 9C 7D 8H'], PACK.slice(0, 30).join(' '), '5H');

  it("nobody can knock until everyone has had a turn this round", () => {
    let g = three();
    expect(() => play(g, 0, KNOCK, dice)).toThrow('once everyone has had a turn');
    g = run(g, [[0, draw('stack')], [0, THROW], [1, draw('stack')], [1, THROW]]).game;
    expect(() => play(g, 2, KNOCK, dice)).toThrow('once everyone has had a turn');
    g = run(g, [[2, draw('stack')], [2, THROW]]).game;
    expect(run(g, [[0, KNOCK]]).game.knocker).toBe(0);
  });

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

  it('scores every hand, adds them to the totals, and the lowest hand wins the round (no penalty for the knocker)', () => {
    let g = lap(table(['AH 2H 4H 6H', 'KS KC 3D 9H', '9S 9C 7D 8H'], PACK.slice(0, 30).join(' '), '5H'));
    g = run(g, [[0, KNOCK], [1, draw('stack')], [1, THROW], [2, draw('stack')], [2, THROW]]).game;
    const result = g.results[0];
    expect(result.scores.map((s) => s!.total)).toEqual([13, 0, 15]);
    expect(result.winners).toEqual([1]);
    expect(g.totals).toEqual([13, 0, 15]);
  });

  it('a tie for the lowest hand: both win the round', () => {
    let g = lap(table(['AH 2H 4H 6H', 'AS 2S 4S 6S'], PACK.slice(0, 30).join(' '), '5H'));
    g = run(g, [[0, KNOCK], [1, draw('stack')], [1, THROW]]).game;
    expect(g.results[0].winners).toEqual([0, 1]);
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

  it('the next round deals a fresh pack, and the start moves one player along', () => {
    let { game } = newGame(3, { target: 101 }, seededDice('rounds'));
    const first = game.starter;
    game = run(game, [['system', { type: 'end-peek' }]]).game;
    game = finishRound(game);
    expect(() => play(game, 0, { type: 'next-round' }, dice)).toThrow(RuleError);
    const next = run(game, [['system', { type: 'next-round' }]]).game;
    expect(next.round).toBe(2);
    expect(next.starter).toBe((first + 1) % 3);
    expect(next.phase).toBe('peek');
    expect(next.knocker).toBeNull();
    expect(next.turnsThisRound).toEqual([0, 0, 0]);
    expect(new Set([...next.hands.flat(), ...next.stack, ...next.discard])).toEqual(new Set(PACK));
  });

  it('ends when a total reaches 101 or more; lowest total wins', () => {
    let g = table(['QH JC TD 9S', 'AH 2H 4H 6H'], PACK.slice(0, 30).join(' '), '5H', { totals: [70, 60] });
    g = finishRound(g);
    expect(g.totals).toEqual([70 + 39, 60 + 13]);
    expect(g.phase).toBe('over');
    expect(g.winners).toEqual([1]);
    expect(() => play(g, 0, draw('stack'), dice)).toThrow('The game is over');
    expect(() => play(g, 'system', { type: 'next-round' }, dice)).toThrow('The game is over');
  });

  it('exactly 101 ends it too; 100 does not', () => {
    const at = (start: number) => finishRound(table(['QH JC TD AS', 'KH KC KD KS'], PACK.slice(0, 30).join(' '), '5H', { totals: [start, 0] }));
    expect(at(70).phase).toBe('over'); // 70 + 31 = 101
    expect(at(69).phase).toBe('round-over'); // 69 + 31 = 100
  });

  it('a Quick game ends at 50', () => {
    const quick = (start: number) =>
      finishRound(table(['QH JC TD AS', 'KH KC KD KS'], PACK.slice(0, 30).join(' '), '5H', { totals: [start, 0], settings: { target: 50 } }));
    expect(quick(19).phase).toBe('over');
    expect(quick(18).phase).toBe('round-over');
  });

  it('a tie for the lowest total at the end: they share the win', () => {
    const g = finishRound(table(['QH JC TD 9S', 'AH 2H 4H 6H', 'AS 2S 4S 6S'], PACK.slice(0, 30).join(' '), '5H', { totals: [80, 20, 20] }));
    expect(g.phase).toBe('over');
    expect(g.winners).toEqual([1, 2]);
  });
});

describe('walking away (classmates games)', () => {
  const three = () => table(['AH 2H 4H 6H', 'QS QC QD QH', '9S 9C 7D 8H'], PACK.slice(0, 30).join(' '), '5H');

  it('a skipped turn passes play on, throwing away any card being held', () => {
    let g = run(three(), [[0, draw('stack')]]).game;
    const held = g.holding!.card;
    const { game, events } = run(g, [['system', { type: 'skip' }]]);
    g = game;
    expect(g.turn).toBe(1);
    expect(g.discard.at(-1)).toBe(held);
    expect(g.skips[0]).toBe(1);
    expect(events[0]).toEqual({ kind: 'skip', seat: 0, discarded: held });
    expect(() => play(g, 1, { type: 'skip' }, dice)).toThrow('Only the referee');
  });

  it('a skip counts as your turn for the knocking rule', () => {
    let g = three();
    g = run(g, [['system', { type: 'skip' }], ['system', { type: 'skip' }], ['system', { type: 'skip' }]]).game;
    expect(run(g, [[0, KNOCK]]).game.knocker).toBe(0);
  });

  it(`${SKIPS_TO_OUT} skips in a row and you're out; playing in between starts the count again`, () => {
    let g = three();
    const skipAround = (game: Game) => {
      // Skip seat 0's turn, and let the others play.
      game = run(game, [['system', { type: 'skip' }]]).game;
      while (game.turn !== 0 && game.phase === 'play') game = run(game, [[game.turn, draw('stack')], [game.turn, THROW]]).game;
      return game;
    };
    g = skipAround(skipAround(g));
    expect(g.skips[0]).toBe(2);
    g = run(g, [[0, draw('stack')], [0, THROW]]).game;
    expect(g.skips[0]).toBe(0);
    while (g.turn !== 0) g = run(g, [[g.turn, draw('stack')], [g.turn, THROW]]).game;
    g = skipAround(skipAround(g));
    const { game, events } = run(g, [['system', { type: 'skip' }]]);
    expect(game.out[0]).toBe(true);
    expect(game.hands[0]).toEqual([]);
    expect(events).toContainEqual({ kind: 'out', seat: 0, reason: 'skipped' });
    expect(() => play(game, 0, draw('stack'), dice)).toThrow("You're out");
  });

  it('leaving: your cards leave the table, the others carry on, and you score no more', () => {
    let g = run(three(), [[1, { type: 'leave' }]]).game;
    expect(g.out).toEqual([false, true, false]);
    g = lap(g);
    g = run(g, [[g.turn, KNOCK]]).game;
    while (g.phase === 'play') g = run(g, [[g.turn, draw('stack')], [g.turn, THROW]]).game;
    expect(g.results[0].scores[1]).toBeNull();
    expect(g.totals[1]).toBe(0);
  });

  it('leaving on your own turn passes play on', () => {
    const g = run(three(), [[0, draw('stack')], [0, { type: 'leave' }]]).game;
    expect(g.turn).toBe(1);
    expect(g.holding).toBeNull();
  });

  it('the knocker leaving: the others still finish their last turns', () => {
    let g = lap(three());
    g = run(g, [[0, KNOCK], [0, { type: 'leave' }], [1, draw('stack')], [1, THROW]]).game;
    expect(g.turn).toBe(2);
    g = run(g, [[2, draw('stack')], [2, THROW]]).game;
    expect(g.phase).toBe('round-over');
  });

  it('someone owing a last turn leaves: the round ends without them', () => {
    let g = lap(three());
    g = run(g, [[0, KNOCK], [2, { type: 'leave' }], [1, draw('stack')], [1, THROW]]).game;
    expect(g.phase).toBe('round-over');
  });

  it('leaving during the peek: play starts with the next player if the starter left', () => {
    let { game } = newGame(3, { target: 101 }, seededDice('peek-leave'));
    const s = game.starter;
    const others = [0, 1, 2].filter((x) => x !== s);
    game = run(game, [[others[0], { type: 'peek-done' }], [others[1], { type: 'peek-done' }], [s, { type: 'leave' }]]).game;
    expect(game.phase).toBe('play');
    expect(game.turn).toBe((s + 1) % 3);
  });

  it('only one player left: the game ends and they win', () => {
    const g = run(table(['AH 2H 4H 6H', 'QS QC QD QH']), [[0, { type: 'leave' }]]);
    expect(g.game.phase).toBe('over');
    expect(g.game.winners).toEqual([1]);
    expect(() => play(g.game, 1, { type: 'leave' }, dice)).toThrow('over');
  });

  it('players who are out are dealt no cards in the next round', () => {
    let g = run(three(), [[1, { type: 'leave' }]]).game;
    g = lap(g);
    g = run(g, [[g.turn, KNOCK]]).game;
    while (g.phase === 'play') g = run(g, [[g.turn, draw('stack')], [g.turn, THROW]]).game;
    g = run(g, [['system', { type: 'next-round' }]]).game;
    expect(g.hands.map((h) => h.length)).toEqual([4, 0, 4]);
    expect(g.peeked).toEqual([false, true, false]);
  });
});

describe('secure shuffling (classmates games, on the server)', () => {
  it('gives every number from 1 to n, about equally often, and deals a proper game', () => {
    const counts = Array(7).fill(0);
    for (let i = 0; i < 7000; i++) counts[secureDice(7) - 1]++;
    for (const c of counts) expect(c).toBeGreaterThan(800);
    expect(() => secureDice(0)).toThrow();
    const { game } = newGame(4, { target: 101 }, secureDice);
    expect(new Set([...game.hands.flat(), ...game.stack, ...game.discard]).size).toBe(52);
  });
});
