import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Foundational (junior) games' painted pictures: every one is a small .webp (a Chromebook on school wifi has to load
// them) and the folder says where its pictures came from. Quick looks has no painted pictures yet, only a CREDITS.md.
const FOLDERS = ['beanstalk', 'hop', 'korora', 'pipi', 'tui', 'weka'].map((g) => join(__dirname, g, 'art'));
const MAX_KB = 150;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

describe('the junior games\' painted pictures', () => {
  it('are small .webp files, and each art folder has a CREDITS.md', () => {
    for (const dir of [...FOLDERS, join(__dirname, '..', 'subitising', 'art')]) {
      expect(existsSync(join(dir, 'CREDITS.md')), `${dir} needs a CREDITS.md`).toBe(true);
    }
    for (const dir of FOLDERS) {
      const files = walk(join(dir, 'paint'));
      expect(files.length, `${dir} has no pictures`).toBeGreaterThan(0);
      for (const f of files) {
        expect(f, 'should be a .webp').toMatch(/\.webp$/);
        expect(statSync(f).size / 1024, `${f} is too big`).toBeLessThan(MAX_KB);
      }
    }
  });
});
