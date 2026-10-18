import { describe, expect, it } from 'vitest';
import { BOND_SETS, findBondSet } from './bonds';
import { BOARD_SIZES, buildDeck, partnersOf } from './deck';
import { newGame } from './engine';
import { perfectFlips, play } from './perfectPlayer';
import { replay, type BondMatchSave } from './save';
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
