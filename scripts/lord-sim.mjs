// Plays many Dragon Maths seasons with a simple pupil and prints how fast heroes level.
// Run from the project folder with: npm run lord:sim  [-- --runs 200] [-- --json] [-- --class knight]
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
const RUNS = Number(option('runs', 100));
const JSON_OUT = args.includes('--json');
const ONLY_CLASS = option('class', null);

// The rules are TypeScript, so bundle them into one plain JavaScript file first.
const dir = mkdtempSync(join(tmpdir(), 'lord-sim-'));
const entryFile = join(process.cwd(), `.lord-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { STYLES, summarise } from './shared/lord/sim.ts';\n`);
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
const classes = ONLY_CLASS ? [ONLY_CLASS] : ['knight', 'mage', 'trickster'];
const results = [];
for (const heroClass of classes) for (const style of sim.STYLES) results.push(sim.summarise(heroClass, style, RUNS));

if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`Dragon Maths pace: ${RUNS} seasons (35 days) per row. Numbers are play-days to reach each level (median).\n`);
  for (const r of results) {
    const days = r.medianLevelDay.slice(2).map((d, i) => `L${i + 2}:${d ?? '-'}`).join(' ');
    const cal = r.medianLevelCalendarDay[12];
    console.log(`${r.heroClass.padEnd(9)} ${r.style.padEnd(14)} ${days}${cal === null ? '' : `  (level 12 on calendar day ${cal + 1} = week ${Math.floor(cal / 7) + 1})`}`);
    console.log(
      `${' '.repeat(24)}reach dragon ${pct(r.reachedDragonShare)}, beat it ${pct(r.beatDragonShare)} (${pct(r.dragonWinRate)} of tries); ` +
        `lose ${pct(r.lossPerFight)} of fights; win ${pct(r.masterWinRate)} of master tries; ` +
        `healing eats ${pct(r.healShareOfGold)} of gold; ${r.avgRounds.toFixed(1)} rounds a fight; ${r.medianPlayDays} play days`,
    );
  }
  console.log('\nTarget (docs/LORD-PLAN.md section 7): "4 days a week" reaches the dragon in week 4-5; "every day" around week 3;');
  console.log('lose a fight now and then (not never); healing eats a fair share of gold but not most of it.');
}
