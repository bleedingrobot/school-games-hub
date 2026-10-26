import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The whole site's test budget (docs/TESTING.md). Don't raise it without James's yes: swap out a weaker test instead.
const MAX_TESTS = 210;

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : testFiles(path);
    return /\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

it(`the site has at most ${MAX_TESTS} tests (read docs/TESTING.md before adding one)`, () => {
  const count = ['src', 'shared', 'supabase/functions', 'scripts']
    .flatMap(testFiles)
    .reduce((sum, file) => sum + (readFileSync(file, 'utf8').match(/^\s*(it|test)(\.each\(.*?\)|\.skip|\.only)?\(/gm)?.length ?? 0), 0);
  expect(count).toBeLessThanOrEqual(MAX_TESTS);
});
