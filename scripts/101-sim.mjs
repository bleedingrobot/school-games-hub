// Plays thousands of all-bot games of 101 and prints how long they last and who wins.
// Run from the project folder with: npm run 101:sim  [-- --games 2000] [-- --json]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const GAMES = Number(option('games', 1000));
const JSON_OUT = args.includes('--json');

// The rules are TypeScript, so bundle them into one plain JavaScript file first.
const dir = mkdtempSync(join(tmpdir(), '101-sim-'));
const entryFile = join(process.cwd(), `.101-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { simulate } from './shared/card101/sim.ts';\n`);
let simulate;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  ({ simulate } = await import(pathToFileURL(join(dir, 'sim.mjs')).href));
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}

const fmt = (n, digits = 1) => n.toFixed(digits);
const pct = (n) => `${(n * 100).toFixed(0)}%`;
const results = [];

for (const level of ['easy', 'medium']) {
  for (const target of [101, 50]) {
    for (const players of [2, 3, 4]) {
      const report = simulate({ levels: Array(players).fill(level), games: GAMES, seed: `${level}:${target}:${players}`, settings: { target } });
      results.push({ level, target, players, report });
      if (!JSON_OUT) {
        console.log(
          `${level.padEnd(6)} to ${String(target).padEnd(3)} ${players}p | rounds ${fmt(report.rounds.mean)} (p95 ${report.rounds.p95})` +
            ` | turns ${fmt(report.turns.mean, 0)} (${fmt(report.turnsPerRound)}/round, longest round ${report.longestRound})` +
            ` | ~${fmt(report.minutes.mean)} min (p95 ${fmt(report.minutes.p95)})` +
            ` | wins by seat ${report.winsBySeat.map(pct).join('/')} shared ${pct(report.sharedWins)}` +
            ` | hand ${fmt(report.averageHand)} zero ${pct(report.zeroHands)} knocker lowest ${pct(report.knockerWon)} reshuffles ${fmt(report.reshufflesPerGame, 2)}`,
        );
      }
    }
  }
}
if (JSON_OUT) console.log(JSON.stringify(results, null, 2));
