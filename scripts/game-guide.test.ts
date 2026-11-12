import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The game guide is followed by Claude threads to the letter, so a link to a moved or deleted file sends them wrong.
describe('game guide', () => {
  it('every relative link in docs/game-guide/ points at a file that exists', () => {
    const missing: string[] = [];
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    for (const file of walk('docs/game-guide').filter((f) => f.endsWith('.md'))) {
      for (const [, target] of readFileSync(file, 'utf8').matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|#|mailto:)/.test(target)) continue;
        const path = join(dirname(file), target.split('#')[0]);
        if (!existsSync(path)) missing.push(`${file} -> ${target}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
