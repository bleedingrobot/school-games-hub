// Plays bot clans through many days of Clan Quest and prints how fast they grow and how often they win.
// Run from the project folder with: npm run clans:sim  [-- --days 60] [-- --seeds 20] [-- --maths 0.7] [-- --offset 0] [-- --empire 1]
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
const DAYS = Number(option('days', 60));
const SEEDS = Number(option('seeds', 20));
const MATHS = Number(option('maths', 0.7));
const OFFSET = Number(option('offset', 0));
const EMPIRE = option('empire', '0') !== '0';

const dir = mkdtempSync(join(tmpdir(), 'clans-sim-'));
const entryFile = join(process.cwd(), `.clans-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { simulate } from './shared/clans/sim.ts';\n`);
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

const pct = (n) => `${(n * 100).toFixed(0)}%`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const lineup of ['balanced', 'fighters']) {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) runs.push(simulate({ days: DAYS, seed, lineup, mathsRate: MATHS, depthOffset: OFFSET, empire: EMPIRE }));
  console.log(`\n${lineup}: ${SEEDS} clans, ${DAYS} days, maths ${pct(MATHS)}, depth offset ${OFFSET}`);
  console.log(`win rate ${pct(mean(runs.map((r) => r.wins / r.fights)))} | knocked out per day ${mean(runs.map((r) => mean(r.days.map((d) => d.knockOuts)))).toFixed(2)} | rounds per fight ${mean(runs.map((r) => mean(r.days.map((d) => d.rounds / Math.max(1, d.fights))))).toFixed(1)} | SP spent per fight ${mean(runs.map((r) => mean(r.days.map((d) => d.spSpent / Math.max(1, d.fights))))).toFixed(1)}`);
  const maxed = runs.filter((r) => r.dayAtMax !== null);
  console.log(`reached level 20: ${maxed.length}/${SEEDS}${maxed.length ? ` (day ${mean(maxed.map((r) => r.dayAtMax)).toFixed(0)} on average)` : ''} | boss wins per clan ${mean(runs.map((r) => r.bossWins)).toFixed(1)}`);
  console.log('day | avg level | depth | win rate | gold');
  for (const day of [1, 2, 3, 5, 7, 10, 14, 21, 28, 35, 42, 56, 70].filter((d) => d <= DAYS)) {
    const ds = runs.map((r) => r.days[day - 1]);
    console.log(`${String(day).padStart(3)} | ${mean(ds.map((d) => d.avgLevel)).toFixed(1).padStart(9)} | ${mean(ds.map((d) => d.depth)).toFixed(1).padStart(5)} | ${pct(mean(ds.map((d) => d.wins / Math.max(1, d.fights)))).padStart(8)} | ${mean(ds.map((d) => d.gold)).toFixed(0)}`);
  }
  if (EMPIRE) {
    console.log('empire: day | clan purse (lowest) | vault | barracks | buildings | army strength | raid gold | strength lost');
    for (const day of [3, 5, 7, 10, 14, 21, 28, 35, 42, 56, 70].filter((d) => d <= DAYS)) {
      const ds = runs.map((r) => r.days[day - 1]);
      console.log(`${String(day).padStart(11)} | ${String(Math.min(...ds.map((d) => d.gold))).padStart(18)} | ${mean(ds.map((d) => d.empire.vault)).toFixed(0).padStart(5)} | ${mean(ds.map((d) => d.empire.barracks)).toFixed(1).padStart(8)} | ${mean(ds.map((d) => d.empire.buildings)).toFixed(1).padStart(9)} | ${mean(ds.map((d) => d.empire.might)).toFixed(0).padStart(14)} | ${mean(ds.map((d) => d.empire.raidGold)).toFixed(0).padStart(9)} | ${mean(ds.map((d) => d.empire.lostMight)).toFixed(1)}`);
    }
  }
}
