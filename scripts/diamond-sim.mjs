// Plays bot pupils through a 35-day season of Diamond Drop and prints how long the climb to the Heart Diamond takes,
// how many tries levels take, and where the coins go.
// Run from the project folder with: npm run diamond:sim  [-- --pupils 40] [-- --minutes 12] [-- --seed 1]
// One try at each level on many seeds, by skill (for tuning targets and times): npm run diamond:sim -- --levels 200
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
const PUPILS = Number(option('pupils', 40));
const MINUTES = Number(option('minutes', 12));
const SEED = Number(option('seed', 1));

const dir = mkdtempSync(join(tmpdir(), 'diamond-sim-'));
const entryFile = join(process.cwd(), `.diamond-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { simulate, checkLevels, SKILLS, MATHS } from './shared/diamond/sim.ts';\n`);
let sim;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  sim = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}

const pct = (n) => `${(n * 100).toFixed(0)}%`;
const pad = (s, n) => String(s).padEnd(n);

if (option('levels', '')) {
  const seeds = Number(option('levels', 200));
  console.log(`One try at each level, ${seeds} fields each (middling maths). Pass rates by skill.\n`);
  console.log(`${pad('level', 6)}${pad('target', 8)}${pad('steady median', 15)}${Object.keys(sim.SKILLS).map((s) => pad(s, 8)).join('')}stuck`);
  for (const r of sim.checkLevels(seeds, SEED)) {
    console.log(`${pad(r.level, 6)}${pad(r.target || 'diamond', 8)}${pad(r.medianBanked, 15)}${Object.values(r.pass).map((p) => pad(pct(p), 8)).join('')}${r.stuck}`);
  }
  process.exit(0);
}

console.log(`Season of 35 days, ${PUPILS} pupils a row, ${MINUTES}-minute lessons. Half the pupils save for a Legendary first.\n`);
console.log(
  `${pad('pupil (skill/maths/days a week)', 32)}${pad('found', 7)}${pad('week', 6)}${pad('days', 6)}${pad('deepest', 9)}${pad('≤3 tries', 10)}` +
    `${pad('levels/day', 12)}${pad('upgrades', 10)}${pad('legendary', 11)}${pad('coins', 8)}${pad('left', 7)}${pad('boosts', 8)}q/level`,
);
const rows = [];
for (const days of [2, 3.5, 5]) {
  for (const [skill, maths] of [['good', 'strong'], ['steady', 'middling'], ['steady', 'weak'], ['shaky', 'middling'], ['shaky', 'weak']]) {
    const r = sim.simulate({ pupils: PUPILS, daysPerWeek: days, skill, maths, minutes: MINUTES, seed: SEED });
    rows.push(r);
    console.log(
      `${pad(r.label, 32)}${pad(pct(r.found), 7)}${pad(r.medianWeek ?? '-', 6)}${pad(r.medianDays ?? '-', 6)}${pad(r.meanDeepest.toFixed(1), 9)}` +
        `${pad(pct(r.withinThree), 10)}${pad(r.levelsPerDay.toFixed(1), 12)}${pad(r.upgrades.toFixed(1), 10)}${pad(pct(r.legendary), 11)}` +
        `${pad(Math.round(r.coinsEarned), 8)}${pad(Math.round(r.coinsLeft), 7)}${pad(pct(r.boostShare), 8)}${r.questionsPerLevel.toFixed(1)}`,
    );
  }
}
console.log('\nMean tries to pass each new level (3 to 4 days a week, steady/middling):');
const mid = rows.find((r) => r.label === 'steady/middling/3.5d');
console.log(mid.meanTries.map((t, i) => `L${i + 1} ${t.toFixed(1)}`).join('  '));
