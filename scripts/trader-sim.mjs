// Plays bot traders through many days of Star Trader and prints how fast they get rich and how often they are wrecked.
// Run from the project folder with: npm run trader:sim  [-- --games 60] [-- --days 40] [-- --maths 0.7] [-- --sloppy 0.3] [-- --offset 0]
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
writeFileSync(entryFile, `export { simulate } from './shared/trader/sim.ts';\n`);
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
const sloppyList = option('sloppy', '0,0.3,0.6').split(',').map(Number);
for (const sloppy of sloppyList) {
  const r = simulate({ games: GAMES, days: DAYS, mathsRate: MATHS, sloppy, offset: OFFSET });
  const s = r.stats;
  console.log(`\nsloppy ${pct(sloppy)}: ${r.games} games, ${DAYS} days, maths ${pct(MATHS)}`);
  console.log(`  moon bought by day ${DAYS}: ${pct(r.moonShare)} | moon day 10th/50th/90th percentile: ${r.moonDays.join(' / ')}`);
  console.log(`  credits at day 1/2/3/5/8: ${r.creditsAt.join(' / ')} | average ship number at day 10: ${r.shipAt10.toFixed(1)}`);
  console.log(`  per game: ${(s.jumps / r.games).toFixed(0)} jumps, ${pct(s.profitableJumps / Math.max(1, s.jumps))} made money, ${(s.fights / r.games).toFixed(1)} fights (${pct(s.piratesBeaten / Math.max(1, s.fights))} won), ${(s.wrecks / r.games).toFixed(2)} wrecks, ${(s.robbed / r.games).toFixed(2)} robbed, ${(s.customsFines / r.games).toFixed(2)} customs fines`);
}
