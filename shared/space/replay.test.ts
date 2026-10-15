import { describe, expect, it } from 'vitest';
import { botAction } from './bot';
import { DEFAULT_SETTINGS, play, type SpaceAction } from './engine';
import { playBots, replaySolo, startSolo, type SoloSetup } from './replay';
import { randomFromSeed } from './random';

const setup: SoloSetup = { seed: 'seed-abc', board: { id: 'nebula' }, settings: DEFAULT_SETTINGS, bots: 3, level: 'easy' };

/** Plays a bot game as the browser would, with a "student" choosing like a Pilot, and records the student's actions. */
function playStudentGame(s: SoloSetup, stopAfter = Infinity): SpaceAction[] {
  const game = startSolo(s);
  const student = randomFromSeed('student');
  const actions: SpaceAction[] = [];
  playBots(game, s.level);
  while (game.state.phase !== 'over' && actions.length < stopAfter) {
    const action = botAction(game.state, 'easy', student);
    actions.push(action);
    game.state = play(game.state, action, game.dice).state;
    playBots(game, s.level);
  }
  return actions;
}

describe('bot game replays', () => {
  it('replay a finished game exactly', () => {
    const actions = playStudentGame(setup);
    const result = replaySolo(setup, actions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.finished).toBe(true);
    expect(result.state.places).not.toBeNull();
    expect(result.studentTurns).toBeGreaterThan(5);
    // The browser's game and the replay agree on the result.
    const game = startSolo(setup);
    expect(result.studentSeat).toBe(game.studentSeat);
  });

  it('the seed decides the turn order', () => {
    const seats = new Set<number>();
    for (let i = 0; i < 40; i++) seats.add(startSolo({ ...setup, seed: `s${i}` }).studentSeat);
    expect(seats).toEqual(new Set([0, 1, 2, 3]));
  });

  it('an unfinished game replays as unfinished', () => {
    const actions = playStudentGame(setup, 6);
    const result = replaySolo(setup, actions);
    expect(result).toMatchObject({ ok: true, finished: false });
  });

  it('a different seed or a changed action does not match', () => {
    const actions = playStudentGame(setup);
    const other = replaySolo({ ...setup, seed: 'another-seed' }, actions);
    // Either it breaks the rules somewhere, or it ends differently.
    const original = replaySolo(setup, actions);
    if (other.ok && original.ok) expect(other.state).not.toEqual(original.state);
    const tampered = [...actions];
    tampered.splice(1, 0, { kind: 'use-item', item: 'navigator', value: 6 });
    expect(replaySolo(setup, tampered)).toMatchObject({ ok: false });
  });

  it('refuses actions after the game ended, and far too many actions', () => {
    const actions = playStudentGame(setup);
    expect(replaySolo(setup, [...actions, { kind: 'roll' }])).toEqual({ ok: false, reason: 'actions after the game ended' });
    expect(replaySolo(setup, Array(2001).fill({ kind: 'roll' }))).toEqual({ ok: false, reason: 'too many actions' });
  });

  it('refuses a bad setup', () => {
    expect(replaySolo({ ...setup, bots: 4 }, [])).toMatchObject({ ok: false });
    expect(replaySolo({ ...setup, board: { galaxy: 'nope', size: 100 } }, [])).toMatchObject({ ok: false });
  });
});
