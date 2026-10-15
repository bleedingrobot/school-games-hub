import { describe, expect, it } from 'vitest';
import { parseStudentAction, playBots, replaySolo, startSolo, type SoloSetup } from './solo';
import { playWholeGame } from './testing';

const setup = (over: Partial<SoloSetup> = {}): SoloSetup => ({ seed: 's1-test-abc', bots: 2, level: 'medium', settings: { target: 101 }, ...over });

describe('playing against bots', () => {
  it('the student is seat 0 and the bots play until it is their turn', () => {
    const { solo } = startSolo(setup({ bots: 3 }));
    expect(solo.game.players).toBe(4);
    playBots(solo);
    expect(solo.game.phase).toBe('peek');
    expect(solo.game.peeked).toEqual([false, true, true, true]);
  });

  it('1 to 3 bots only', () => {
    expect(() => startSolo(setup({ bots: 0 }))).toThrow();
    expect(() => startSolo(setup({ bots: 4 }))).toThrow();
  });

  it('the same seed gives the same game, and a different seed a different one', () => {
    expect(playWholeGame(setup()).solo.game).toEqual(playWholeGame(setup()).solo.game);
    expect(startSolo(setup({ seed: 'other' })).solo.game.hands).not.toEqual(startSolo(setup()).solo.game.hands);
  });
});

describe('replaying a saved bot game (what the server does)', () => {
  it.each([
    ['1 Very Easy bot', setup({ bots: 1, level: 'very-easy' })],
    ['2 Easy bots, Quick game', setup({ bots: 2, level: 'easy', settings: { target: 50 } })],
    ['3 Medium bots', setup({ bots: 3, level: 'medium' })],
  ])('%s: the replay gets exactly the same game', (_, s) => {
    const { solo, actions } = playWholeGame(s);
    const replay = replaySolo(s, actions);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.game).toEqual(solo.game);
    expect(replay.finished).toBe(true);
    expect(replay.left).toBe(false);
    expect(replay.rounds).toBe(solo.game.results.length);
    expect(replay.studentTurns).toBe(actions.filter((a) => a.startsWith('swap') || a === 'throw' || a === 'knock').length);
  });

  it('a game the student left part-way is replayed as left', () => {
    const s = setup();
    const { actions } = playWholeGame(s, 'easy', 30);
    const replay = replaySolo(s, actions);
    expect(replay.ok && replay.left).toBe(true);
    expect(replay.ok && replay.game.out[0]).toBe(true);
  });

  it('refuses made-up or changed games', () => {
    const s = setup();
    const { actions } = playWholeGame(s);
    expect(replaySolo(s, [...actions, 'throw'])).toEqual({ ok: false, reason: 'The game is over' });
    expect(replaySolo(s, ['draw:stack'])).toMatchObject({ ok: false });
    expect(replaySolo(s, ['peek', 'dance'])).toEqual({ ok: false, reason: 'Unknown move' });
    expect(replaySolo(s, Array(4000).fill('peek'))).toEqual({ ok: false, reason: 'Too many moves' });
    // The same moves with a different deal go wrong somewhere, or end differently.
    const other = replaySolo({ ...s, seed: 'different' }, actions);
    expect(!other.ok || JSON.stringify(other.game.totals) !== JSON.stringify(playWholeGame(s).solo.game.totals)).toBe(true);
  });

  it('only accepts the student action words', () => {
    expect(parseStudentAction('swap:3')).toEqual({ actor: 0, action: { type: 'swap', slot: 3 } });
    expect(parseStudentAction('next')).toEqual({ actor: 'system', action: { type: 'next-round' } });
    for (const bad of ['swap:4', 'swap:1.0', 'swap:', 'skip', 'end-peek', 'Knock', 42, null, { type: 'knock' }]) {
      expect(parseStudentAction(bad)).toBeNull();
    }
  });
});
