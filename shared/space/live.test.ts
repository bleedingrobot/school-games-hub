import { describe, expect, it } from 'vitest';
import { botAction } from './bot';
import { DEFAULT_SETTINGS, SpaceRuleError } from './engine';
import {
  animationMs,
  autopilotSeats,
  AUTOPILOT_AFTER,
  CHOICE_SECONDS,
  QUESTION_SECONDS,
  deadlineAfter,
  flownByBot,
  MAX_ANIMATION_SECONDS,
  parseLiveSetup,
  playerAction,
  seatsThatCount,
  startLive,
  takeControls,
  timeOut,
  timesUpDelayMs,
  TURN_SECONDS,
  type LiveGame,
  type LiveSetup,
} from './live';
import { randomFromSeed, seededDice } from './random';

const SETUP: LiveSetup = { board: { id: 'nebula' }, settings: DEFAULT_SETTINGS };
const QUICK: LiveSetup = { board: { id: 'asteroid-belt' }, settings: DEFAULT_SETTINGS };

/** Plays a whole game: students do what a Pilot would, nobody times out. */
function playOut(game: LiveGame, seed: string, players: (string | null)[]) {
  const dice = seededDice(`${seed}:dice`);
  const random = randomFromSeed(`${seed}:bots`);
  for (let n = 0; game.state.phase !== 'over'; n++) {
    if (n > 2000) throw new Error('never ended');
    expect(flownByBot(game, game.state.turn)).toBe(false);
    expect(players[game.state.turn]).not.toBeNull();
    game = playerAction(game, botAction(game.state, 'easy', random), dice, random).game;
  }
  return game;
}

describe('classmates games', () => {
  it('starts with students and bots in the seats they were given', () => {
    const { game, events } = startLive(SETUP, ['ana', null, 'ben']);
    expect(game.state.rockets).toHaveLength(3);
    expect(game.seats.map((s) => s.bot)).toEqual([false, true, false]);
    expect(events[0]).toEqual({ kind: 'round-start', round: 1 });
    expect(() => startLive(SETUP, ['ana'])).toThrow();
    expect(() => startLive(SETUP, ['a', 'b', 'c', 'd', 'e'])).toThrow();
  });

  it('flies the bots straight after a student’s turn, so the next turn is always a student’s', () => {
    const { game } = startLive(SETUP, ['ana', null, null, 'ben']);
    const played = playerAction(game, { kind: 'roll' }, seededDice('d1'), randomFromSeed('r1'));
    // Seats 1 and 2 are bots, so after Ana's roll it's Ben's turn (unless Ana rolled a 6 with roll-again, which is off).
    expect(played.game.state.turn).toBe(3);
    expect(played.actions.map((a) => [a.seat, a.by])).toEqual([
      [0, 'player'],
      [1, 'bot'],
      [2, 'bot'],
    ]);
    expect(played.events.filter((e) => e.kind === 'turn-start').map((e) => 'seat' in e && e.seat)).toEqual([1, 2, 3]);
    // The game it was given hasn't changed.
    expect(game.state.turn).toBe(0);
  });

  it('refuses moves the rules don’t allow, and changes nothing', () => {
    const { game } = startLive(SETUP, ['ana', 'ben']);
    expect(() => playerAction(game, { kind: 'use-item', item: 'booster' }, seededDice('x'), Math.random)).toThrow(SpaceRuleError);
    expect(() => playerAction(game, { kind: 'choose', option: 1 }, seededDice('x'), Math.random)).toThrow(SpaceRuleError);
    expect(() => playerAction(game, { kind: 'timeout' }, seededDice('x'), Math.random)).toThrow();
    expect(game.state.turnsTaken).toBe(0);
  });

  it('plays whole games to the end, with stats for each seat', () => {
    for (const [i, players] of ([['ana', 'ben'], ['ana', null, 'ben'], ['ana', 'ben', 'cat', 'dan'], ['ana', null, null, 'ben']] as const).entries()) {
      const seats = [...players];
      const end = playOut(startLive(i % 2 ? QUICK : SETUP, seats).game, `game-${i}`, seats);
      expect(end.state.places).toHaveLength(seats.length);
      const totalTurns = end.seats.reduce((sum, s) => sum + s.stats.turns, 0);
      expect(totalTurns).toBe(end.state.turnsTaken + (end.state.ending === 'docked' ? 1 : 0));
      if (end.state.ending === 'docked') expect(end.seats.filter((s) => s.stats.docked)).toHaveLength(1);
      // Everyone stayed and the game is long enough: every student seat counts, no bot does.
      expect(seatsThatCount(end, seats)).toEqual(seats.map((p) => p !== null));
    }
  });

  it('rolls for a student who runs out of time, and puts them on autopilot after 3 in a row', () => {
    let game = startLive(SETUP, ['ana', 'ben']).game;
    const dice = seededDice('timeouts');
    const random = randomFromSeed('timeouts:bots');
    for (let n = 1; n < AUTOPILOT_AFTER; n++) {
      const played = timeOut(game, dice, random);
      expect(played.events[0]).toEqual({ kind: 'timeout', seat: 0 });
      game = played.game;
      expect(game.seats[0].timeouts).toBe(n);
      // Ben plays his turn himself.
      game = playerAction(game, { kind: 'roll' }, dice, random).game;
    }
    // Acting yourself resets the count; Ben never timed out.
    expect(game.seats[1].timeouts).toBe(0);
    const third = timeOut(game, dice, random);
    expect(third.game.seats[0]).toMatchObject({ autopilot: true, left: true });
    // Autopilot doesn't fly Ana's rocket until her next turn: now it's Ben's.
    expect(third.game.state.turn).toBe(1);
    const after = playerAction(third.game, { kind: 'roll' }, dice, random);
    expect(after.actions.some((a) => a.seat === 0 && a.by === 'autopilot')).toBe(true);
    expect(after.game.state.turn === 1 || after.game.state.phase === 'over').toBe(true);
  });

  it('times out a choice with the safe option', () => {
    // Find a game where someone lands on a gate or the mystery station.
    for (let seed = 0; seed < 300; seed++) {
      let game = startLive(SETUP, ['ana', 'ben']).game;
      const dice = seededDice(`choice-${seed}`);
      for (let n = 0; n < 200 && game.state.phase === 'ready'; n++) game = playerAction(game, { kind: 'roll' }, dice, Math.random).game;
      if (game.state.phase !== 'choice' || !game.state.pending || game.state.pending.kind === 'inventory') continue;
      const seat = game.state.turn;
      const square = game.state.rockets[seat].position;
      const played = timeOut(game, dice, Math.random);
      if (game.state.pending.kind === 'gate') {
        expect(played.events).toContainEqual({ kind: 'gate-stay', seat, square });
      } else {
        expect(played.events).toContainEqual(expect.objectContaining({ kind: 'mystery', seat, card: 0 }));
      }
      return;
    }
    throw new Error('no choice came up');
  });

  it('flies students who left, and stops when every student has gone', () => {
    const start = startLive(SETUP, ['ana', null, 'ben']).game;
    expect(autopilotSeats(start, [1], seededDice('a'), Math.random)).toBeNull(); // a bot already
    const benGone = autopilotSeats(start, [2], seededDice('a'), Math.random)!;
    expect(benGone.game.seats[2]).toMatchObject({ autopilot: true, left: true });
    expect(benGone.everyoneLeft).toBe(false);
    const bothGone = autopilotSeats(benGone.game, [0], seededDice('a'), Math.random)!;
    expect(bothGone.everyoneLeft).toBe(true);
    expect(bothGone.actions).toEqual([]);
  });

  it('lets a student take the controls back, but the game still counts as left for them', () => {
    const left = autopilotSeats(startLive(SETUP, ['ana', 'ben', 'cat']).game, [1], seededDice('b'), Math.random)!.game;
    const back = takeControls(left, 1);
    expect(back.seats[1]).toMatchObject({ autopilot: false, left: true, timeouts: 0 });
  });

  it('only counts with 2 students who stayed, 5 turns each, and a proper ending', () => {
    const players = ['ana', 'ben', 'cat'];
    const end = playOut(startLive(SETUP, players).game, 'counts', players);
    expect(seatsThatCount(end, players)).toEqual([true, true, true]);
    const withLeaver = structuredClone(end);
    withLeaver.seats[2].left = true;
    expect(seatsThatCount(withLeaver, players)).toEqual([true, true, false]);
    const twoLeft = structuredClone(withLeaver);
    twoLeft.seats[1].left = true;
    expect(seatsThatCount(twoLeft, players)).toEqual([false, false, false]);
    const short = structuredClone(end);
    short.seats[0].stats.turns = 4;
    expect(seatsThatCount(short, players)).toEqual([false, true, true]);
    // A deleted student (no player any more) doesn't count.
    expect(seatsThatCount(end, ['ana', null, 'cat'])).toEqual([true, false, true]);
    const notOver = startLive(SETUP, players).game;
    expect(seatsThatCount(notOver, players)).toEqual([false, false, false]);
  });

  it('gives 30 seconds a turn and 15 a choice, after the animations', () => {
    const { game, events } = startLive(SETUP, ['ana', 'ben']);
    const now = 1_000_000;
    expect(deadlineAfter(game, [], now)).toBe(now + TURN_SECONDS * 1000);
    const choosing = structuredClone(game);
    choosing.state.phase = 'choice';
    expect(deadlineAfter(choosing, [], now)).toBe(now + CHOICE_SECONDS * 1000);
    // A wormhole or black hole question (Mission Control maths) gets 20.
    choosing.state.pending = { kind: 'question', square: 5 };
    expect(deadlineAfter(choosing, [], now)).toBe(now + QUESTION_SECONDS * 1000);
    expect(deadlineAfter(game, events, now)!).toBeGreaterThan(now + TURN_SECONDS * 1000);
    const lots = Array.from({ length: 100 }, () => ({ kind: 'cosmic' as const, event: 'solar-wind' as const }));
    expect(animationMs(lots)).toBeGreaterThan(MAX_ANIMATION_SECONDS * 1000);
    expect(deadlineAfter(game, lots, now)).toBe(now + (TURN_SECONDS + MAX_ANIMATION_SECONDS) * 1000);
    const over = structuredClone(game);
    over.state.phase = 'over';
    expect(deadlineAfter(over, [], now)).toBeNull();
  });

  it('asks the next student to press "time’s up" first, then the others', () => {
    const game = startLive(SETUP, ['ana', null, 'ben', 'cat']).game; // Ana's turn
    expect(timesUpDelayMs(game, 2)).toBe(500); // Ben is next (the bot is skipped)
    expect(timesUpDelayMs(game, 3)).toBe(3500);
    expect(timesUpDelayMs(game, 0)).toBe(8000); // Ana herself, last
  });

  it('reads a setup from the browser', () => {
    expect(parseLiveSetup({ board: { id: 'nebula' }, settings: DEFAULT_SETTINGS })).toEqual(SETUP);
    expect(parseLiveSetup({ board: { galaxy: 'comet-kiwi-48', size: 50 }, settings: DEFAULT_SETTINGS })).toMatchObject({
      board: { galaxy: 'Comet-Kiwi-48', size: 50 },
    });
    expect(parseLiveSetup({ board: { id: 'mars' }, settings: DEFAULT_SETTINGS })).toBeNull();
    // Mission Control maths comes with the host's setup.
    expect(parseLiveSetup({ board: { id: 'nebula' }, settings: { ...DEFAULT_SETTINGS, maths: true } })).toEqual({
      ...SETUP,
      settings: { ...DEFAULT_SETTINGS, maths: true },
    });
    expect(parseLiveSetup(null)).toBeNull();
  });
});

describe('stats for the maths achievements', () => {
  const MATHS: LiveSetup = { board: { id: 'nebula' }, settings: { ...DEFAULT_SETTINGS, maths: true } };

  /** Student 0 is on a wormhole or black hole with its question waiting; they answer. */
  function answer(kind: 'wormhole' | 'black-hole', option: 0 | 1) {
    const { game } = startLive(MATHS, ['ana', 'ben']);
    const square = Object.entries(game.state.board.squares).find(([, q]) => q.kind === kind)![0];
    game.state.rockets[0].position = Number(square);
    game.state.phase = 'choice';
    game.state.pending = { kind: 'question', square: Number(square), ...(kind === 'black-hole' ? { moment: 'black-hole' as const } : {}) };
    game.state.turnInfo.rolled = true;
    return playerAction(game, { kind: 'choose', option }, seededDice('a'), randomFromSeed('b')).game.seats[0].stats;
  }

  it('counts a right wormhole answer as a ride, a right answer and a power-up', () => {
    expect(answer('wormhole', 1)).toMatchObject({ wormholes: 1, mathsRight: 1, boosts: 1, escapes: 0 });
  });

  it('counts a wrong wormhole answer as a ride and nothing else', () => {
    expect(answer('wormhole', 0)).toMatchObject({ wormholes: 1, mathsRight: 0, boosts: 0, escapes: 0 });
  });

  it('counts a right black hole answer as an escape, and a wrong one as nothing', () => {
    expect(answer('black-hole', 1)).toMatchObject({ wormholes: 0, mathsRight: 1, boosts: 0, escapes: 1 });
    expect(answer('black-hole', 0)).toMatchObject({ mathsRight: 0, escapes: 0 });
  });
});
