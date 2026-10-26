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
  it('a different seed, a changed action or actions after the end do not match', () => {
    const actions = playStudentGame(setup);
    const original = replaySolo(setup, actions);
    expect(original).toMatchObject({ ok: true, finished: true });
    const other = replaySolo({ ...setup, seed: 'another-seed' }, actions);
    // Either it breaks the rules somewhere, or it ends differently.
    if (other.ok && original.ok) expect(other.state).not.toEqual(original.state);
    const tampered = [...actions];
    tampered.splice(1, 0, { kind: 'use-item', item: 'navigator', value: 6 });
    expect(replaySolo(setup, tampered)).toMatchObject({ ok: false });
    expect(replaySolo(setup, [...actions, { kind: 'roll' }])).toEqual({ ok: false, reason: 'actions after the game ended' });
  });
});
