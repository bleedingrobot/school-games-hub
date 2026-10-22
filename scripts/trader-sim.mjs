// Plays bot traders through many days of Star Trader and prints how fast they get rich and how often they are wrecked.
// Run from the project folder with: npm run trader:sim  [-- --games 60] [-- --days 40] [-- --maths 0.7] [-- --sloppy 0.3] [-- --offset 0]
// A busy school on one shared market (stage T.4): npm run trader:sim -- --school 28,60,100 [--info none|news|all] [--days 30] [--seeds 3]
//   [--full 3000] [--pupilcap 2000] [--cap 5000] [--keep 50] [--play 1]
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
const GAMES = Number(option('games', 60));
const DAYS = Number(option('days', 40));
const MATHS = Number(option('maths', 0.7));
const OFFSET = Number(option('offset', 0));

const dir = mkdtempSync(join(tmpdir(), 'trader-sim-'));
const entryFile = join(process.cwd(), `.trader-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { simulate, simulateSchool } from './shared/trader/sim.ts';\n`);
let simulate;
let simulateSchool;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  ({ simulate, simulateSchool } = await import(pathToFileURL(join(dir, 'sim.mjs')).href));
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}

const pct = (n) => `${(n * 100).toFixed(0)}%`;

if (option('school', '')) {
  const sizes = option('school', '28').split(',').map(Number);
  const seeds = Number(option('seeds', 3));
  const info = option('info', 'news');
  const days = Number(option('days', 30));
  const play = option('play', '') ? Number(option('play', '1')) : undefined;
  const rules = {};
  if (option('cap', '')) rules.cap = Number(option('cap', ''));
  if (option('keep', '')) rules.keep = Number(option('keep', ''));
  const limits = {};
  if (option('full', '')) limits.full = Number(option('full', ''));
  if (option('pupilcap', '')) limits.pupilCap = Number(option('pupilcap', ''));
  const sloppy = option('sloppy', '0,0.4,0.7').split(',').map(Number);
  console.log(`school mode: bots know ${info === 'none' ? 'only normal prices' : info === 'news' ? 'normal prices and the news' : 'every school price'}, ${days} days, maths ${pct(MATHS)}, sloppy mix ${sloppy.join('/')}, rules ${JSON.stringify({ ...rules, ...limits })}${play !== undefined ? `, plays ${pct(play)} of days` : ''}`);
  for (const pupils of [0, ...sizes]) {
    const runs = [];
    for (let s = 0; s < seeds; s++) {
      runs.push(simulateSchool({ pupils: pupils || 30, days, mathsRate: MATHS, sloppy, info, seed: `school-${OFFSET + s}`, rules, limits, playShare: play, shared: pupils !== 0 }));
    }
    const avg = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
    const days3 = [0, 1, 2].map((i) => avg((r) => r.moonDays[i]).toFixed(1)).join(' / ');
    const label = pupils ? `${pupils} pupils, shared market` : '30 pupils, each alone (no shared market)';
    console.log(`\n${label} (${seeds} galaxies, ${avg((r) => r.seconds).toFixed(1)} s each)`);
    console.log(`  moon by day ${days}: ${pct(avg((r) => r.moonShare))} | moon day 10th/50th/90th: ${days3}`);
    console.log(`  credits at day 1/2/3/5/8: ${[0, 1, 2, 3, 4].map((i) => Math.round(avg((r) => r.creditsAt[i]))).join(' / ')}`);
    if (pupils) {
      console.log(`  prices traded at: bought ${avg((r) => r.boughtAtPct).toFixed(1)}% vs normal, sold ${avg((r) => r.soldAtPct).toFixed(1)}% | pupil 20% limit cut ${pct(avg((r) => r.pupilCapShare))} of trades`);
      console.log(`  end of day: ${pct(avg((r) => r.atCapShare))} of prices at the 50% limit, average push ${avg((r) => r.avgPushPct).toFixed(1)}%, biggest ${avg((r) => r.maxPushPct).toFixed(0)}% | ${avg((r) => r.newsPerDay).toFixed(1)} news lines a day`);
    }
  }
  process.exit(0);
}

const sloppyList = option('sloppy', '0,0.3,0.6').split(',').map(Number);
for (const sloppy of sloppyList) {
  const r = simulate({ games: GAMES, days: DAYS, mathsRate: MATHS, sloppy, offset: OFFSET });
  const s = r.stats;
  console.log(`\nsloppy ${pct(sloppy)}: ${r.games} games, ${DAYS} days, maths ${pct(MATHS)}`);
  console.log(`  moon bought by day ${DAYS}: ${pct(r.moonShare)} | moon day 10th/50th/90th percentile: ${r.moonDays.join(' / ')}`);
  console.log(`  credits at day 1/2/3/5/8: ${r.creditsAt.join(' / ')} | average ship number at day 10: ${r.shipAt10.toFixed(1)}`);
  console.log(`  per game: ${(s.jumps / r.games).toFixed(0)} jumps, ${pct(s.profitableJumps / Math.max(1, s.jumps))} made money, ${(s.fights / r.games).toFixed(1)} fights (${pct(s.piratesBeaten / Math.max(1, s.fights))} won), ${(s.wrecks / r.games).toFixed(2)} wrecks, ${(s.robbed / r.games).toFixed(2)} robbed, ${(s.customsFines / r.games).toFixed(2)} customs fines`);
}
