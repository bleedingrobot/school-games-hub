import { describe, expect, it } from 'vitest';
import { findBondSet } from './bonds';
import { buildDeck } from './deck';
import { newGame } from './engine';
import { perfectFlips } from './perfectPlayer';
import { replay, type BondMatchSave } from './save';

const perfectSave = (bondId: string, size: BondMatchSave['size'], seed: number): BondMatchSave => {
  const state = newGame(buildDeck(findBondSet(bondId)!, size, seed));
  return { seed, bondId, size, flips: perfectFlips(state), seconds: 42 };
};

describe('replay', () => {
  it('rejects a doctored flip list', () => {
    const save = perfectSave('whole-10', 'small', 3);
    const bad = (flips: number[]) => replay({ ...save, flips });
    expect(bad(save.flips.slice(0, -2))).toMatchObject({
      ok: false,
      error: 'the game did not finish',
    });
    expect(bad(save.flips.slice(0, -1))).toMatchObject({ ok: false });
    expect(bad([...save.flips, 0])).toMatchObject({ ok: false });
    expect(bad([save.flips[0], save.flips[0], ...save.flips.slice(2)])).toMatchObject({ ok: false });
    expect(bad([...save.flips.slice(0, 2), save.flips[0], ...save.flips.slice(3)]).ok).toBe(false);
    expect(bad([99, ...save.flips])).toMatchObject({ ok: false });
    expect(bad([])).toMatchObject({ ok: false });
    // A flip list from a different seed.
    const other = perfectSave('whole-100-any', 'large', 1);
    expect(replay({ ...other, seed: 2 }).ok).toBe(false);
  });
});
