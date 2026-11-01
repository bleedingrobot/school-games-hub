/**
 * Every painted picture Sky Isles uses is there, and nothing is spare (not counted in the game's 8 tests, as with the
 * other games' art checks). A missing picture would only fall back to drawn shapes, but it should be caught here.
 */
import { describe, expect, it } from 'vitest';
import { BASES, KEEPERS, MAX_LEVEL, PLOT_KINDS } from '../../../shared/isles/config';
import { allArtFiles, SPOTS } from './art';

const NEEDED = [
  ...BASES.map((_, i) => `base-${i + 1}`),
  ...PLOT_KINDS.flatMap((kind) => Array.from({ length: MAX_LEVEL }, (_, l) => `bld-${kind}-${l + 1}`)),
  'bld-empty',
  ...['red', 'blue', 'yellow'].map((c) => `boat-${c}`),
  ...['wave', 'point', 'cheer', 'think'].map((p) => `pip-${p}`),
  ...['island', 'sky', 'race'].flatMap((b) => [`bg-${b}`, `bg-${b}-800`]),
  ...KEEPERS.flatMap((k) => [`keepers/${k}`, `keepers/${k}-96`]),
].map((name) => `./art/${name}.webp`);

describe('the painted pictures', () => {
  it('has every picture the game needs, and none spare', () => {
    const have = allArtFiles();
    expect(NEEDED.filter((f) => !have.includes(f)), 'missing').toEqual([]);
    expect(have.filter((f) => !NEEDED.includes(f)), 'spare').toEqual([]);
  });

  it('places every building spot on every base', () => {
    expect(SPOTS.map((spots) => spots.length)).toEqual([...BASES]);
  });
});
