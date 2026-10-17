// Plays thousands of all-bot Power Clash matches and prints who wins and how long they last.
// Run from the project folder with: npm run power-clash:sim  [-- --matches 1000] [-- --json]
//   [-- --powers]  also tries every set of three powers for Medium against Medium.
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
const MATCHES = Number(option('matches', 1000));
const JSON_OUT = args.includes('--json');
const TRY_POWERS = args.includes('--powers');

// The rules are TypeScript, so bundle them into one plain JavaScript file first.
const dir = mkdtempSync(join(tmpdir(), 'power-clash-sim-'));
const entryFile = join(process.cwd(), `.power-clash-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { simulate } from './shared/power-clash/sim.ts';\n`);
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

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const fmt = (n, digits = 1) => n.toFixed(digits);

// Rough seconds a real 8-10 year old needs. A student's own go: read the board, think, pick a power or a square, tap. The bot's go:
// its pause (0.6-1 s) plus the animation lock. Between rounds: read the result, tap Next.
const STUDENT_GO_SECONDS = 9;
const BOT_GO_SECONDS = 1.9;
const BETWEEN_ROUNDS_SECONDS = 5;

const pairs = [
  ['medium', 'easy'],
  ['easy', 'very-easy'],
  ['medium', 'very-easy'],
  ['medium', 'medium'],
  ['easy', 'easy'],
  ['very-easy', 'very-easy'],
];
const results = [];
for (const [a, b] of pairs) {
  const report = simulate({ a, b, matches: MATCHES, seed: `${a}:${b}` });
  results.push({ a, b, report });
  if (!JSON_OUT) {
    const decided = report.rounds.a + report.rounds.b;
    // If "b" were the student: their goes, the bot's goes, and the pauses between rounds.
    const minutes = (report.actionsPerMatch.b * STUDENT_GO_SECONDS + report.actionsPerMatch.a * BOT_GO_SECONDS +
      report.roundsPerMatch * BETWEEN_ROUNDS_SECONDS) / 60;
    console.log(
      `${a.padEnd(9)} v ${b.padEnd(9)} | rounds won ${pct(report.aRoundShare)} of decided (${report.rounds.a}-${report.rounds.b}, ${report.rounds.draws} drawn, ${decided + report.rounds.draws} total)` +
        ` | matches won ${pct(report.matchWins.a / report.matches)} - ${pct(report.matchWins.b / report.matches)}` +
        ` | ${fmt(report.roundsPerMatch)} rounds, ${fmt(report.actionsPerMatch.a + report.actionsPerMatch.b)} turns a match (${fmt(report.actionsPerMatch.b)} by the weaker side)` +
        ` | ~${fmt(minutes)} min if the weaker side were a student` +
        ` | thinking: mean ${fmt(report.meanMs)} ms, slowest ${fmt(report.slowestMs, 0)} ms`,
    );
  }
}

if (TRY_POWERS) {
  // All 56 sets of three from the eight powers. Each set plays Medium against Medium with a sample of
  // other sets (the same sample size for every set), on equal terms. `--opponents` sets the sample size.
  const IDS = ['body-swap', 'freeze-ray', 'board-wipe', 'force-field', 'portal-chaos', 'wild-card', 'time-heist'];
  const sets = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) for (let k = j + 1; k < 8; k++) sets.push([IDS[i], IDS[j], IDS[k]]);
  const opponents = Number(option('opponents', 8));
  const chaos = args.includes('--chaos');
  const rows = [];
  for (const [index, set] of sets.entries()) {
    let won = 0;
    let decided = 0;
    for (let n = 1; n <= opponents; n++) {
      const other = sets[(index + n * 7) % sets.length];
      if (other === set) continue;
      const r = simulate({ a: 'medium', b: 'medium', matches: Math.round(MATCHES / opponents), seed: `powers:${set}:${other}`, powers: { a: set, b: other }, chaos });
      won += r.rounds.a;
      decided += r.rounds.a + r.rounds.b;
    }
    rows.push({ set, share: won / decided });
  }
  rows.sort((x, y) => y.share - x.share);
  for (const row of rows) console.log(`${row.set.join(' + ').padEnd(48)} wins ${pct(row.share)} of decided rounds against other sets`);
  // How much each power adds: the average share of the sets that hold it.
  for (const id of IDS) {
    const mine = rows.filter((r) => r.set.includes(id));
    console.log(`${id.padEnd(16)} sets holding it win ${pct(mine.reduce((t, r) => t + r.share, 0) / mine.length)} on average`);
  }
}
if (JSON_OUT) console.log(JSON.stringify(results, null, 2));
