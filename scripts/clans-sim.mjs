// Plays bot clans through many days of Clan Quest and prints how fast they grow and how often they win.
// Run from the project folder with: npm run clans:sim  [-- --days 60] [-- --seeds 20] [-- --maths 0.7] [-- --offset 0] [-- --empire 1] [-- --play 7]  (--play = days a week the clan plays)
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
const PLAY = Math.max(1, Math.min(7, Number(option('play', 7))));
// --monster 1: play each clan to the start of monster week (day 28, with the empire), then try the monster 40 times at each tiredness.
const MONSTER = option('monster', '0') !== '0';

const dir = mkdtempSync(join(tmpdir(), 'clans-sim-'));
const entryFile = join(process.cwd(), `.clans-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { simulate, monsterTry } from './shared/clans/sim.ts';\n`);
let simulate;
let monsterTry;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  ({ simulate, monsterTry } = await import(pathToFileURL(join(dir, 'sim.mjs')).href));
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}

const pct = (n) => `${(n * 100).toFixed(0)}%`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const lineup of ['balanced', 'fighters']) {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) runs.push(simulate({ days: DAYS, seed, lineup, mathsRate: MATHS, depthOffset: OFFSET, empire: EMPIRE, playDays: PLAY }));
  console.log(`\n${lineup}: ${SEEDS} clans, ${DAYS} days, maths ${pct(MATHS)}, depth offset ${OFFSET}, plays ${PLAY} days a week`);
  console.log(`win rate ${pct(mean(runs.map((r) => r.wins / r.fights)))} | knocked out per day ${mean(runs.map((r) => mean(r.days.map((d) => d.knockOuts)))).toFixed(2)} | rounds per fight ${mean(runs.map((r) => mean(r.days.map((d) => d.rounds / Math.max(1, d.fights))))).toFixed(1)} | SP spent per fight ${mean(runs.map((r) => mean(r.days.map((d) => d.spSpent / Math.max(1, d.fights))))).toFixed(1)}`);
  const maxed = runs.filter((r) => r.dayAtMax !== null);
  console.log(`reached level 20: ${maxed.length}/${SEEDS}${maxed.length ? ` (day ${mean(maxed.map((r) => r.dayAtMax)).toFixed(0)} on average)` : ''} | boss wins per clan ${mean(runs.map((r) => r.bossWins)).toFixed(1)}`);
  console.log('day | avg level | depth | win rate | gold');
  for (const day of [1, 2, 3, 5, 7, 10, 14, 21, 28, 35, 42, 56, 70].filter((d) => d <= DAYS)) {
    const ds = runs.map((r) => r.days[day - 1]);
    console.log(`${String(day).padStart(3)} | ${mean(ds.map((d) => d.avgLevel)).toFixed(1).padStart(9)} | ${mean(ds.map((d) => d.depth)).toFixed(1).padStart(5)} | ${pct(mean(ds.map((d) => d.wins / Math.max(1, d.fights)))).padStart(8)} | ${mean(ds.map((d) => d.gold)).toFixed(0)}`);
  }
  if (MONSTER) {
    const kinds = ['giant', 'golem', 'troll'];
    const clans = runs.map((r) => r.clan);
    const lvl = mean(clans.map((c) => mean(c.members.map((m) => m.level))));
    console.log(`monster week: clans at day ${DAYS}, average level ${lvl.toFixed(1)}, village levels ${mean(runs.map((r) => r.days[DAYS - 1].empire?.levels ?? 0)).toFixed(1)} of 39, army ${mean(runs.map((r) => r.days[DAYS - 1].empire?.might ?? 0)).toFixed(0)}`);
    for (const kind of kinds) {
      const line = [];
      for (let losses = 0; losses <= 4; losses++) {
        let wins = 0;
        let n = 0;
        let rounds = 0;
        for (const [i, c] of clans.entries()) for (let t = 0; t < 40; t++) {
          const r = monsterTry(c, kind, losses, i * 1000 + t + 1, MATHS);
          wins += r.won ? 1 : 0;
          rounds += r.rounds;
          n++;
        }
        line.push(`${pct(wins / n)} (${(rounds / n).toFixed(1)} rounds)`);
      }
      console.log(`${kind.padEnd(6)} win per try, 0..4 losses before: ${line.join(' | ')}`);
    }
  }
  if (EMPIRE) {
    // "All max" = all eight buildings at their top level (39 levels in total).
    const allMaxDays = runs.map((r) => (r.days.find((d) => d.empire?.allMax)?.day ?? null));
    const done = allMaxDays.filter((d) => d !== null);
    const sorted = [...done].sort((a, b) => a - b);
    console.log(`village all-max: ${done.length}/${SEEDS} clans by day ${DAYS}${done.length ? ` | day ${mean(done).toFixed(0)} on average (earliest ${sorted[0]}, median ${sorted[Math.floor(sorted.length / 2)]}, latest ${sorted[sorted.length - 1]}) = ${(mean(done) / 7).toFixed(1)} weeks` : ''}`);
    const levelsAt = (d) => (d <= DAYS ? mean(runs.map((r) => r.days[d - 1].empire.levels)).toFixed(1) : 'n/a');
    console.log(`village complete (play ${PLAY} days a week): ${done.length ? `day ${mean(done).toFixed(0)} on average` : 'none'}, ${done.length}/${SEEDS} clans | levels of 39 at day 21: ${levelsAt(21)}, day 28: ${levelsAt(28)}, day 35: ${levelsAt(35)}`);
    console.log('village: day | purse (lowest) | purse (avg) | barracks lvl | building levels (of 39) | army strength | raid gold | strength lost');
    for (const day of [3, 5, 7, 10, 14, 21, 28, 35, 42, 56, 70].filter((d) => d <= DAYS)) {
      const ds = runs.map((r) => r.days[day - 1]);
      console.log(`${String(day).padStart(12)} | ${String(Math.min(...ds.map((d) => d.gold))).padStart(14)} | ${mean(ds.map((d) => d.gold)).toFixed(0).padStart(11)} | ${mean(ds.map((d) => d.empire.barracks)).toFixed(1).padStart(12)} | ${mean(ds.map((d) => d.empire.levels)).toFixed(1).padStart(23)} | ${mean(ds.map((d) => d.empire.might)).toFixed(0).padStart(13)} | ${mean(ds.map((d) => d.empire.raidGold)).toFixed(0).padStart(9)} | ${mean(ds.map((d) => d.empire.lostMight)).toFixed(1)}`);
    }
  }
}
