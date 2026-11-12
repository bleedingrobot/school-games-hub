/**
 * Keeps the test suite small (docs/TESTING.md "How many"). Counts the tests in each game and each part of the site and
 * fails when one goes over its budget, so the suite can't grow back to thousands of slow tests (it was 6,728 until
 * James chose to cut it on 11 Nov 2026). Over budget? Delete a weaker test to make room, don't raise the number.
 *
 * Not counted: the voice-lines tests, the "index.ts is up to date" checks, scripts/ and the database tests.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

/** Junior (Foundational) games: 8 rule and server tests plus up to 4 screen tests. */
const JUNIOR = ['beanstalk', 'hop', 'korora', 'tui', 'pipi', 'weka', 'subitising', 'parrot', 'robin', 'swamphen', 'lizard', 'pigeon', 'toonflap'];

/** Folders that belong to one game under another name. */
const SAME_AS: Record<string, string> = {
  'card-game': 'card101',
  monster: 'monsters',
  'space-game': 'space',
  'src/training': 'training',
  'src/subitising': 'subitising',
  // Chess, checkers, the bot-game save and the live multiplayer server are budgeted together.
  chess: 'chess+checkers',
  checkers: 'chess+checkers',
  'save-bot-game': 'chess+checkers',
  multiplayer: 'chess+checkers',
  'src/multiplayer': 'chess+checkers',
  // The shared maths in the browser and the rules.
  maths: 'maths',
  'src/maths': 'maths',
  // Small site parts budgeted together.
  'src/components': 'site parts',
  'src/theme': 'site parts',
  'src/avatar': 'site parts',
  'src top level': 'site parts',
};

/** Budgets that differ from an older game's 8 (James's choices, docs/TESTING.md). */
const BUDGET: Record<string, number> = {
  ...Object.fromEntries(JUNIOR.map((id) => [id, 12])),
  clans: 20,
  trader: 12,
  monsters: 10,
  'chess+checkers': 16,
  maths: 27,
  'src/pages': 29, // 25, plus 4 for the profile page (docs/TESTING.md, 12 Nov 2026)
  'src/teacher': 25,
  'src/data': 20,
  'src/App': 6,
  'site parts': 8,
  'src/kit': 4,
  'src/auth': 4,
  _shared: 10,
  'shared top level': 5,
  'src/games top level': 10,
  kit: 14, // shared/kit: the junior games' shared rules
  badge: 8,
};

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...testFiles(path));
    else if (/\.test\.tsx?$/.test(name) && !/^voiceLines?\.test\.ts$|^voice\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}

/** Which game or site part a test file counts towards. */
export function areaOf(file: string): string {
  const parts = file.split(sep);
  let area: string;
  if (parts[0] === 'src' && parts[1] === 'games') area = parts.length > 3 ? parts[2] : 'src/games top level';
  else if (parts[0] === 'shared') area = parts.length > 2 ? parts[1] : 'shared top level';
  else if (parts[0] === 'supabase' && parts[1] === 'functions') area = parts[2];
  else if (parts[0] === 'src' && parts.length === 2) area = parts[1].startsWith('App.') ? 'src/App' : 'src top level';
  else area = `${parts[0]}/${parts[1]}`;
  return SAME_AS[area] ?? area;
}

/** The tests in a file: each it( or test( call, less the "index.ts is up to date" checks. */
export function countTests(source: string): number {
  const calls = source.match(/^\s*(?:it|test)(?:\.each\([\s\S]*?\))?\s*\(\s*(['"`])(.*?)\1/gm) ?? [];
  return calls.filter((call) => !/up[ -]to[ -]date/i.test(call)).length;
}

it('every game and part of the site is within its test budget (docs/TESTING.md)', () => {
  const counts = new Map<string, number>();
  for (const dir of ['src', 'shared', 'supabase/functions']) {
    for (const path of testFiles(join(ROOT, dir))) {
      const area = areaOf(relative(ROOT, path));
      counts.set(area, (counts.get(area) ?? 0) + countTests(readFileSync(path, 'utf8')));
    }
  }
  const over = [...counts]
    .filter(([area, n]) => n > (BUDGET[area] ?? 8))
    .map(([area, n]) => `${area}: ${n} tests, budget ${BUDGET[area] ?? 8}`);
  expect(over, 'Over budget: delete weaker tests to make room (docs/TESTING.md)').toEqual([]);
  // The whole suite stays small too.
  expect([...counts.values()].reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(650);
});
