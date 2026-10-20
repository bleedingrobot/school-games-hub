import { describe, expect, it } from 'vitest';
import { BOND_SETS, findBondSet } from './bonds';
import { BOARD_SIZES, buildDeck, partnersOf } from './deck';
import { newGame } from './engine';
import { perfectFlips, play } from './perfectPlayer';
import { BOND_MATCH_SAVE, checkItem, minSecondsFor, replay, type BondMatchItem, type BondMatchSave } from './save';
import { scoreGame } from './score';

const perfectSave = (bondId: string, size: BondMatchSave['size'], seed: number): BondMatchSave => {
  const state = newGame(buildDeck(findBondSet(bondId)!, size, seed));
  return { seed, bondId, size, flips: perfectFlips(state), seconds: 42 };
};

describe('replay', () => {
  it('gives the same result as playing, for every bond set and board size', () => {
    for (const set of BOND_SETS) {
      for (const size of BOARD_SIZES) {
        const save = perfectSave(set.id, size, 99);
        const played = play(newGame(buildDeck(set, size, 99)), save.flips);
        const r = replay(save);
        if (!r.ok) throw new Error(r.error);
        expect(r.state).toEqual(played);
        expect(r.score).toEqual(scoreGame(played, 42));
        expect(r.score.stars).toBe(3);
      }
    }
  });

  it('replays a messy game with mistakes the same way', () => {
    const base = perfectSave('whole-20', 'medium', 5);
    const state = newGame(buildDeck(findBondSet('whole-20')!, 'medium', 5));
    const b = state.deck.cards.findIndex((_, j) => j > 0 && !partnersOf(state.deck)[0].includes(j));
    const flips = [0, b, 0, b, ...base.flips];
    const r = replay({ ...base, flips });
    expect(r.ok && r.score).toMatchObject({ flips: 10, stars: 3 });
  });

  it('rejects a doctored flip list', () => {
    const save = perfectSave('whole-10', 'small', 3);
    const bad = (flips: number[]) => replay({ ...save, flips });
    expect(bad(save.flips.slice(0, -2))).toMatchObject({ ok: false, error: 'the game did not finish' });
    expect(bad(save.flips.slice(0, -1))).toMatchObject({ ok: false });
    expect(bad([...save.flips, 0])).toMatchObject({ ok: false });
    expect(bad([save.flips[0], save.flips[0], ...save.flips.slice(2)])).toMatchObject({ ok: false });
    expect(bad([...save.flips.slice(0, 2), save.flips[0], ...save.flips.slice(3)]).ok).toBe(false);
    expect(bad([99, ...save.flips])).toMatchObject({ ok: false });
    expect(bad([])).toMatchObject({ ok: false });
  });

  it('rejects a flip list from a different seed', () => {
    const save = perfectSave('whole-100-any', 'large', 1);
    expect(replay({ ...save, seed: 2 }).ok).toBe(false);
  });

  it('rejects bad fields', () => {
    const save = perfectSave('whole-10', 'small', 3);
    expect(replay({ ...save, seed: -1 }).ok).toBe(false);
    expect(replay({ ...save, seed: 1.5 }).ok).toBe(false);
    expect(replay({ ...save, bondId: 'nope' }).ok).toBe(false);
    expect(replay({ ...save, size: 'huge' as never }).ok).toBe(false);
    expect(replay({ ...save, seconds: -1 }).ok).toBe(false);
    expect(replay({ ...save, seconds: 1.5 }).ok).toBe(false);
    expect(replay({ ...save, flips: 'x' as never }).ok).toBe(false);
    expect(replay({ ...save, flips: [0.5, 1] }).ok).toBe(false);
  });
});

describe('checkItem (what the server checks)', () => {
  const RUN = '6f1c2a54-1d3e-4b5a-9c7d-0e1f2a3b4c5d';
  const item = (over: Partial<BondMatchItem> = {}): BondMatchItem => ({ ...perfectSave('whole-10', 'small', 3), runId: RUN, seconds: 60, ...over });

  it('takes a good game and gives the server\'s own score', () => {
    const c = checkItem(item());
    expect(c.ok && c.score).toMatchObject({ flips: 6, stars: 3 });
  });

  it('is not fooled by the browser: stars and flips come from the replay', () => {
    const c = checkItem({ ...item(), stars: 1, flipCount: 99 });
    expect(c.ok && c.score.stars).toBe(3);
  });

  it('refuses a bad run id, bond, size, seed, time, or flip list', () => {
    for (const bad of [
      { runId: 'nope' }, { bondId: 'whole-7' }, { size: 'huge' }, { seed: 1.5 }, { seed: -1 }, { seconds: -3 }, { seconds: 1.5 },
      { flips: [0, 1, 2.5] }, { flips: [0, 99] }, { flips: [] }, { flips: Array(500).fill(0) },
    ]) {
      expect(checkItem({ ...item(), ...bad }).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(checkItem(null).ok).toBe(false);
    expect(checkItem('x').ok).toBe(false);
  });

  it('refuses a game that is too fast for a human, and takes one right at the limit', () => {
    const flips = item().flips;
    expect(checkItem(item({ seconds: Math.floor(minSecondsFor(flips.length)) - 1 })).ok).toBe(false);
    expect(checkItem(item({ seconds: Math.ceil(minSecondsFor(flips.length)) })).ok).toBe(true);
  });

  it('says what the numbers are', () => {
    expect(BOND_MATCH_SAVE).toEqual({ minSecondsPerCardFlip: 0.5, pointsPerGame: 2, pointsGamesPerDay: 10, maxGamesPerDay: 100 });
  });
});
