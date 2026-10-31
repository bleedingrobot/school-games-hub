import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_NAMES } from './art';

const DIR = join(__dirname, 'art');
const MAX_KB: Record<string, number> = { boards: 320, sprites: 60, campaign: 320 };

describe('the painted pictures', () => {
  // A typo would mean a picture never shows; a huge file would be slow on a Chromebook.
  it('every file has a name the game looks for, and is small enough', () => {
    for (const [group, names] of Object.entries(ART_NAMES)) {
      let files: string[] = [];
      try {
        files = readdirSync(join(DIR, group)).filter((f) => !f.startsWith('.'));
      } catch {
        continue;
      }
      for (const f of files) {
        expect(names, `${group}/${f} is not a name the game looks for`).toContain(f.replace(/\.webp$/, ''));
        expect(f, `${group}/${f} should be a .webp`).toMatch(/\.webp$/);
        expect(statSync(join(DIR, group, f)).size / 1024, `${group}/${f} is too big`).toBeLessThan(MAX_KB[group]);
      }
    }
    expect(Object.keys(MAX_KB).sort()).toEqual(Object.keys(ART_NAMES).sort());
  });
});
