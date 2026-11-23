// Class Showdown's simulator: plays rounds with typical classes of pretend pupils (fast, steady, slow and wobbly) and
// tunes boss health by mode, round length and class size so a typical class beats the boss in about 80% of rounds.
// Run from the project folder:
//   npm run showdown:sim                 check the tuned table: win rate per mode, length and class size
//   npm run showdown:sim -- --write      tune again and write shared/showdown/bossHealth.ts
//   npm run showdown:sim -- --rounds 400 more rounds per cell (default 300)
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const WRITE = process.argv.includes('--write');
const roundsArg = process.argv.indexOf('--rounds');
const ROUNDS = roundsArg > 0 ? Number(process.argv[roundsArg + 1]) : 300;
const TARGET_WIN = 0.8;
const MODES = ['class', 'teams2', 'teams4', 'solo'];
const LENGTHS = [5, 10, 15];
const SIZES = [8, 12, 16, 20, 24, 28, 32];

const entryFile = join(process.cwd(), `.showdown-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, [
  "export { playRound } from './shared/showdown/sim.ts';",
  "export { bossHealth } from './shared/showdown/bossHealth.ts';",
  "export { recap } from './shared/showdown/awards.ts';",
].join('\n') + '\n');
const dir = mkdtempSync(join(tmpdir(), 'showdown-sim-'));
let mod;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  mod = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}
const { playRound, bossHealth, recap } = mod;

const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);

/** Tune one cell: play rounds against a boss that can't fall, and find the health 80% of classes would beat. */
function tuneCell(mode, lengthMin, size) {
  const need = [];
  for (let i = 0; i < ROUNDS; i++) {
    const res = playRound({ seed: 1000 + i * 7919 + size * 31 + lengthMin, size, lengthMin, mode, bossHealth: 1e9 });
    // Each broken shield heals the boss 10% of its health, so a boss of health H needs H x (1 + 0.1 x heals) damage.
    need.push(res.damage / (1 + 0.1 * res.heals));
  }
  need.sort((a, b) => a - b);
  return Math.round(need[Math.floor(need.length * (1 - TARGET_WIN))] / 5) * 5;
}

/** Check: real rounds on fresh seeds with the tuned boss; how many does a class win, and how many award winners? */
function checkCell(mode, lengthMin, size, health) {
  let wins = 0;
  let awarded = 0;
  let hpLeft = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const res = playRound({ seed: 900000 + i * 104729 + size * 13 + lengthMin, size, lengthMin, mode, bossHealth: health, teacherEnrage: i % 3 === 0 });
    if (res.beaten) wins++;
    else hpLeft += res.round.boss.hp / res.round.boss.max;
    awarded += new Set(recap(res.round).awards.map((a) => a.pupil)).size;
  }
  return { win: wins / ROUNDS, awarded: awarded / ROUNDS, hpLeftWhenLost: ROUNDS - wins ? hpLeft / (ROUNDS - wins) : 0 };
}

const started = Date.now();
const table = {};
const rows = [];
for (const mode of MODES) {
  table[mode] = {};
  for (const lengthMin of LENGTHS) {
    table[mode][lengthMin] = [];
    for (const size of SIZES) {
      const health = WRITE ? tuneCell(mode, lengthMin, size) : bossHealth(mode, lengthMin, size);
      table[mode][lengthMin].push([size, health]);
      const c = checkCell(mode, lengthMin, size, health);
      rows.push({ mode, lengthMin, size, health, ...c });
      console.log(`${mode.padEnd(6)} ${String(lengthMin).padStart(2)} min ${String(size).padStart(2)} pupils  boss ${String(health).padStart(5)}  wins ${pct(c.win)}  shout-outs to ${c.awarded.toFixed(1)} pupils  boss left when lost ${pct(c.hpLeftWhenLost)}`);
    }
  }
}
const all = rows.reduce((s, r) => s + r.win, 0) / rows.length;
const worst = rows.reduce((a, b) => (Math.abs(b.win - TARGET_WIN) > Math.abs(a.win - TARGET_WIN) ? b : a));
console.log(`\nAll cells: wins ${pct(all)} on average; furthest from 80%: ${worst.mode} ${worst.lengthMin} min ${worst.size} pupils at ${pct(worst.win)}. ${Math.round((Date.now() - started) / 1000)} s.`);

if (WRITE) {
  const file = join(process.cwd(), 'shared/showdown/bossHealth.ts');
  const src = readFileSync(file, 'utf8');
  const body = MODES.map((mode) => `  ${mode}: {\n${LENGTHS.map((l) => `    ${l}: [${table[mode][l].map(([n, h]) => `[${n}, ${h}]`).join(', ')}],`).join('\n')}\n  },`).join('\n');
  const next = src.replace(/export const BOSS_HEALTH[\s\S]*?\n};\n/, `export const BOSS_HEALTH: Record<Mode, Record<number, [number, number][]>> = {\n${body}\n};\n`);
  writeFileSync(file, next);
  console.log('Wrote shared/showdown/bossHealth.ts');
}
