import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { chooseAction } from './bot';
import { legalActions, play } from './engine';
import {
  deadlineAfter, GRACE_MS, isLiveGame, LiveRuleError, matchIsOver, newLiveGame, NEXT_ROUND_MS, outcomeOf, parseLoadout,
  playerAction, pressNext, roundIsOver, timeOut, TIMEOUTS_TO_ABANDON, TURN_MS, turnSeat, type LiveGame,
} from './live';
import { newMatch, nextRound, scoreRound, type Match } from './match';
import type { Action, PowerId } from './types';

const X_POWERS: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const O_POWERS: PowerId[] = ['board-wipe', 'body-swap', 'freeze-ray'];
const fresh = () => newLiveGame(X_POWERS, O_POWERS);

const move = (game: LiveGame, seat: number, action: Action) => playerAction(game, seat, action).game;
const place = (game: LiveGame, seat: number, square: number) => move(game, seat, { type: 'place', square });

/** X wins the round on the top row; O plays 3 and 4. */
function xWinsRound(game: LiveGame): LiveGame {
  let g = game;
  const turns: [number, number][] = [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]];
  for (const [seat, square] of turns) g = place(g, seat, square);
  return g;
}

describe('a classmates match', () => {
  it('starts with X to move and nothing used', () => {
    const g = fresh();
    expect(turnSeat(g)).toBe(0);
    expect(g.match.state.active).toBe('X');
    expect(g.match.round).toBe(1);
    expect(g.match.state.loadout).toEqual({ X: X_POWERS, O: O_POWERS });
  });

  it('plays a legal move and passes the turn', () => {
    const g = place(fresh(), 0, 4);
    expect(g.match.state.board[4]).toBe('X');
    expect(turnSeat(g)).toBe(1);
  });

  it('refuses a move out of turn, an illegal move and a move after the round is over', () => {
    const g = fresh();
    expect(() => playerAction(g, 1, { type: 'place', square: 0 })).toThrow(LiveRuleError);
    expect(() => playerAction(g, 1, { type: 'place', square: 0 })).toThrow('not your turn');
    const after = place(g, 0, 4);
    expect(() => playerAction(after, 1, { type: 'place', square: 4 })).toThrow(LiveRuleError);
    expect(() => playerAction(after, 1, { type: 'use-power', power: 'freeze-ray', targets: [4] })).toThrow(LiveRuleError);
    expect(() => playerAction(after, 1, { type: 'skip' })).toThrow(LiveRuleError);
    const won = xWinsRound(fresh());
    expect(roundIsOver(won)).toBe(true);
    expect(() => playerAction(won, 1, { type: 'place', square: 8 })).toThrow('round is over');
  });

  it('does not change the game it was given', () => {
    const g = fresh();
    const json = JSON.stringify(g);
    place(g, 0, 4);
    expect(JSON.stringify(g)).toBe(json);
  });

  it('scores a round, counts the stats for both players and waits for both to press Next', () => {
    const won = xWinsRound(fresh());
    expect(won.match.score).toEqual({ X: 1, O: 0 });
    expect(won.stats[0].roundsWon).toBe(1);
    expect(won.stats[1].roundsLost).toBe(1);

    const one = pressNext(won, 0);
    expect(one.advanced).toBe(false);
    expect(one.game.match.round).toBe(1);
    expect(one.game.ready).toEqual([true, false]);
    // pressing twice is fine
    expect(pressNext(one.game, 0).advanced).toBe(false);
    const both = pressNext(one.game, 1);
    expect(both.advanced).toBe(true);
    expect(both.game.match.round).toBe(2);
    // The starter swaps: O starts round 2, and the powers are fresh.
    expect(both.game.match.state.active).toBe('O');
    expect(both.game.match.state.used).toEqual({ X: [], O: [] });
    expect(both.game.ready).toEqual([false, false]);
  });

  it('will not move on before the round is over', () => {
    expect(() => pressNext(fresh(), 0)).toThrow('isn’t over');
  });

  it('keeps the badge stats: powers used, a Body Swap win, and a win without a power', () => {
    // X swaps into a win: X has X . . / O X . / . . O? Build with the engine directly.
    let g = fresh();
    g = place(g, 0, 0); // X0
    g = place(g, 1, 1); // O1
    g = place(g, 0, 8); // X8
    g = place(g, 1, 2); // O2  -> O threatens nothing yet (1,2 need 0)
    g = place(g, 0, 4); // X4 ... 0,4,8 would already be a line: X wins here
    expect(g.match.state.status).toBe('X');
    expect(g.stats[0].powersUsed).toBe(0);

    let h = fresh();
    h = place(h, 0, 0);
    h = place(h, 1, 1);
    h = place(h, 0, 3);
    h = place(h, 1, 5);
    h = move(h, 0, { type: 'use-power', power: 'body-swap', targets: [3, 1] }); // 0:X 1:X 3:O
    expect(h.stats[0].powersUsed).toBe(1);
    h = place(h, 0, 2); // 0,1,2 are X
    expect(h.match.state.status).toBe('X');
    expect(h.stats[0].bodySwapWins).toBe(1);
    expect(h.stats[0].roundsWon).toBe(1);
  });

  it('a match is first to three rounds, and the winner who used no power gets the badge', () => {
    let g = fresh();
    for (let round = 0; round < 3; round++) {
      // the starter alternates; the player with seat X wins each round in a row
      const starterSeat = turnSeat(g);
      const other = 1 - starterSeat;
      // whoever starts can't make X win unless X starts; instead make X the winner by letting O blunder
      const order: [number, number][] =
        starterSeat === 0
          ? [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]]
          : [[1, 3], [0, 0], [1, 4], [0, 1], [1, 8], [0, 2]];
      for (const [seat, square] of order) g = place(g, seat, square);
      expect(g.match.state.status).toBe('X');
      expect(other).toBeDefined();
      if (!matchIsOver(g)) g = pressNext(pressNext(g, 0).game, 1).game;
    }
    expect(g.match.winner).toBe('X');
    expect(g.match.score.X).toBe(3);
    expect(g.stats[0].noPowerWin).toBe(true);
    expect(g.stats[1].noPowerWin).toBe(false);
    expect(() => pressNext(g, 0)).toThrow('match is over');
    expect(() => timeOut(g)).toThrow('match is over');
  });
});

describe('the clock', () => {
  it('a timed-out turn is a skipped placement: the turn passes and nothing is placed', () => {
    const g = fresh();
    const out = timeOut(g);
    expect(out.seat).toBe(0);
    expect(out.game.match.state.board.every((c) => c === null)).toBe(true);
    expect(out.game.match.state.active).toBe('O');
    expect(out.game.timeouts).toEqual([1, 0]);
    expect(out.events).toEqual([{ kind: 'skip', player: 'X' }]);
    expect(out.abandoned).toBe(false);
    expect(out.game.match.score).toEqual({ X: 0, O: 0 });
  });

  it('keeps a power already played this turn used', () => {
    let g = fresh();
    g = move(g, 0, { type: 'use-power', power: 'freeze-ray', targets: [8] });
    const out = timeOut(g);
    expect(out.game.match.state.used.X).toEqual(['freeze-ray']);
    expect(out.game.match.state.placesLeft).toBe(1);
  });

  it('three in a row by the same player abandons the game', () => {
    let game = fresh();
    const results: boolean[] = [];
    // X, O, X, O, X all let the clock run out: X has missed three in a row, O only two.
    for (let i = 0; i < 5; i++) {
      const out = timeOut(game);
      game = out.game;
      results.push(out.abandoned);
    }
    expect(game.timeouts).toEqual([TIMEOUTS_TO_ABANDON, 2]);
    expect(results).toEqual([false, false, false, false, true]);
  });

  it('a real move in between starts the count again', () => {
    let game = fresh();
    game = timeOut(game).game; // X misses one
    game = place(game, 1, 4); // O plays
    game = timeOut(game).game; // X misses another
    expect(game.timeouts[0]).toBe(2);
    game = place(game, 1, 0); // O plays
    game = place(game, 0, 8); // X moves for real
    expect(game.timeouts[0]).toBe(0);
    game = place(game, 1, 1);
    const out = timeOut(game); // X misses one again
    expect(out.game.timeouts[0]).toBe(1);
    expect(out.abandoned).toBe(false);
  });

  it('when the pause between rounds runs out the next round starts by itself, without blaming anyone', () => {
    const won = xWinsRound(fresh());
    const out = timeOut(won);
    expect(out.abandoned).toBe(false);
    expect(out.seat).toBeNull();
    expect(out.game.match.round).toBe(2);
    expect(out.game.timeouts).toEqual([0, 0]);
  });

  it('gives 60 seconds a turn and 30 between rounds, plus time for the animation, and none for a finished match', () => {
    const g = fresh();
    expect(deadlineAfter(g, [], 1000, null)).toBe(1000 + TURN_MS);
    const placed = playerAction(g, 0, { type: 'place', square: 0 });
    expect(deadlineAfter(placed.game, placed.events, 1000, null)).toBe(1000 + TURN_MS + 600);
    const won = xWinsRound(g);
    expect(deadlineAfter(won, [], 1000, null)).toBe(1000 + NEXT_ROUND_MS);
    // Someone pressing Next doesn't give anyone more time
    expect(deadlineAfter(won, [], 5000, 31_000, false)).toBe(31_000);
    expect(GRACE_MS).toBeGreaterThan(0);
    const done: LiveGame = { ...won, match: { ...won.match, winner: 'X' } };
    expect(deadlineAfter(done, [], 1000, 500)).toBeNull();
  });
});

describe('the result', () => {
  it('a finished match: the winner won, both players count, stats go with each seat', () => {
    const g: LiveGame = { ...fresh(), match: { ...fresh().match, winner: 'O', score: { X: 1, O: 3 } } };
    const o = outcomeOf(g, 'finished');
    expect(o.won).toEqual([false, true]);
    expect(o.counts).toEqual([true, true]);
    expect(o.stats).toHaveLength(2);
  });

  it('an abandoned game earns nobody anything and nobody wins', () => {
    const g: LiveGame = { ...fresh(), match: { ...fresh().match, winner: 'X' } };
    const o = outcomeOf(g, 'abandoned');
    expect(o.won).toEqual([false, false]);
    expect(o.counts).toEqual([false, false]);
  });
});

describe('loadouts and checks', () => {
  it('accepts exactly three different powers', () => {
    expect(parseLoadout(['board-wipe', 'body-swap', 'freeze-ray'])).toEqual(['board-wipe', 'body-swap', 'freeze-ray']);
    expect(parseLoadout(['board-wipe', 'board-wipe', 'freeze-ray'])).toBeNull();
    expect(parseLoadout(['board-wipe', 'body-swap'])).toBeNull();
    expect(parseLoadout(['board-wipe', 'body-swap', 'teleport'])).toBeNull();
    expect(parseLoadout('nope')).toBeNull();
    expect(parseLoadout(null)).toBeNull();
  });

  it('recognises a saved game', () => {
    expect(isLiveGame(fresh())).toBe(true);
    expect(isLiveGame(JSON.parse(JSON.stringify(fresh())))).toBe(true);
    expect(isLiveGame({})).toBe(false);
    expect(isLiveGame(null)).toBe(false);
  });
});

/** What a browser would do on its own: the same engine and match scoring, no server. `dice` are the server's. */
function clientReplay(actions: { seat: number; action: Action | 'next'; roll?: number[] }[], xPowers = X_POWERS, oPowers = O_POWERS, chaos = false): Match {
  let match = newMatch({ X: xPowers, O: oPowers }, 'X', chaos);
  for (const { action, roll } of actions) {
    if (action === 'next') {
      match = nextRound(match);
      continue;
    }
    let i = 0;
    const result = play(match.state, action, () => roll?.[i++ % roll.length] ?? 0.5);
    if (!result.ok) throw new Error(result.reason);
    match = scoreRound({ ...match, state: result.state });
  }
  return match;
}

describe('the server and a client replay end in the same place', () => {
  it.each(['a', 'b', 'c', 'd', 'e', 'f'])('whole random match %s', (seed) => {
    const random = randomFromSeed(`live-parity:${seed}`);
    let live = fresh();
    const log: { seat: number; action: Action | 'next' }[] = [];
    for (let guard = 0; guard < 500 && !matchIsOver(live); guard++) {
      if (roundIsOver(live)) {
        live = pressNext(pressNext(live, 0).game, 1).game;
        log.push({ seat: 0, action: 'next' });
        continue;
      }
      const state = live.match.state;
      const action = random() < 0.8 ? chooseAction(state, 'easy', random) : legalActions(state)[Math.floor(random() * legalActions(state).length)];
      const seat = turnSeat(live);
      live = playerAction(live, seat, action).game;
      log.push({ seat, action });
    }
    expect(matchIsOver(live)).toBe(true);
    const replayed = clientReplay(log);
    expect(replayed).toEqual(live.match);
    expect(live.stats[0].roundsWon + live.stats[0].roundsLost + live.stats[0].roundsDrawn).toBe(live.match.round);
    expect(live.stats[0].roundsWon).toBe(live.stats[1].roundsLost);
  });
});

/** Dice that remember what they gave, so a replay can use the same numbers. */
function recordedDice(random: () => number) {
  const rolls: number[] = [];
  return { roll: () => { const v = random(); rolls.push(v); return v; }, take: () => rolls.splice(0) };
}

describe('the new powers and Chaos Mode on the server', () => {
  const ALL: PowerId[] = ['body-swap', 'freeze-ray', 'board-wipe', 'force-field', 'portal-chaos', 'wild-card', 'time-heist'];
  const three = (random: () => number) => {
    const left = [...ALL];
    return [0, 1, 2].map(() => left.splice(Math.floor(random() * left.length), 1)[0]);
  };

  it.each(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])('whole random match %s (all eight powers, Chaos Mode on half the time): a replay with the same dice ends in the same state', (seed) => {
    const random = randomFromSeed(`live-p6:${seed}`);
    const chaos = seed < 'e';
    const [x, o] = [three(random), three(random)];
    const dice = recordedDice(randomFromSeed(`dice:${seed}`));
    let live = newLiveGame(x, o, chaos);
    const log: { seat: number; action: Action | 'next'; roll?: number[] }[] = [];
    for (let guard = 0; guard < 600 && !matchIsOver(live); guard++) {
      if (roundIsOver(live)) {
        live = pressNext(pressNext(live, 0).game, 1).game;
        log.push({ seat: 0, action: 'next' });
        continue;
      }
      const state = live.match.state;
      const action = random() < 0.7 ? chooseAction(state, 'easy', random) : legalActions(state)[Math.floor(random() * legalActions(state).length)];
      const seat = turnSeat(live);
      live = playerAction(live, seat, action, dice.roll).game;
      log.push({ seat, action, roll: dice.take() });
    }
    expect(matchIsOver(live)).toBe(true);
    expect(clientReplay(log, x, o, chaos)).toEqual(live.match);
  });

  it('keeps the saved game small even after a long Chaos Mode match', () => {
    let biggest = 0;
    for (let g = 0; g < 20; g++) {
      const random = randomFromSeed(`size:${g}`);
      let live = newLiveGame(three(random), three(random), true);
      for (let guard = 0; guard < 600 && !matchIsOver(live); guard++) {
        if (roundIsOver(live)) {
          live = pressNext(pressNext(live, 0).game, 1).game;
          continue;
        }
        const actions = legalActions(live.match.state);
        live = playerAction(live, turnSeat(live), actions[Math.floor(random() * actions.length)], random).game;
        biggest = Math.max(biggest, JSON.stringify(live).length);
      }
    }
    // power_games.game is capped at 20 KB.
    expect(biggest).toBeLessThan(5000);
  });

  it('uses the dice it is given: the same dice give the same Wild Card, different dice can differ', () => {
    const start = () => {
      const g = newLiveGame(['wild-card', 'time-heist', 'freeze-ray'], ['wild-card', 'time-heist', 'freeze-ray']);
      return playerAction(g, 0, { type: 'place', square: 4 }, () => 0.5).game;
    };
    const a = playerAction(start(), 1, { type: 'use-power', power: 'wild-card', targets: [] }, randomFromSeed('x'));
    const b = playerAction(start(), 1, { type: 'use-power', power: 'wild-card', targets: [] }, randomFromSeed('x'));
    expect(a.events).toEqual(b.events);
    const effects = new Set<string>();
    for (let n = 0; n < 60; n++) {
      const r = playerAction(start(), 1, { type: 'use-power', power: 'wild-card', targets: [] }, randomFromSeed(`y${n}`));
      const e = r.events[0];
      if (e.kind === 'wild-card') effects.add(e.effect);
    }
    expect(effects.size).toBeGreaterThan(1);
  });

  it('counts the new powers for the "used all three" badge, and a Time Heist does not count the power it undid', () => {
    let g = newLiveGame(['time-heist', 'force-field', 'wild-card'], ['portal-chaos', 'freeze-ray', 'board-wipe']);
    g = playerAction(g, 0, { type: 'place', square: 4 }, () => 0.5).game;
    g = playerAction(g, 1, { type: 'use-power', power: 'freeze-ray', targets: [8] }, () => 0.5).game;
    g = playerAction(g, 1, { type: 'place', square: 0 }, () => 0.5).game;
    g = playerAction(g, 0, { type: 'use-power', power: 'time-heist', targets: [] }, () => 0.5).game;
    expect(g.match.state.board.filter(Boolean)).toHaveLength(1);
    expect(g.match.state.used.O).toEqual([]);
    expect(g.stats[0].powersUsed).toBe(1);
    expect(g.stats[1].powersUsed).toBe(0);
  });

  it('a missed go in Chaos Mode can bring a surprise', () => {
    let g = newLiveGame(['time-heist', 'force-field', 'wild-card'], ['portal-chaos', 'freeze-ray', 'board-wipe'], true);
    g = playerAction(g, 0, { type: 'place', square: 4 }, () => 0.5).game;
    g = playerAction(g, 1, { type: 'place', square: 0 }, () => 0.5).game;
    const r = timeOut(g, randomFromSeed('late'));
    expect(r.events.some((e) => e.kind === 'chaos')).toBe(true);
  });
});
