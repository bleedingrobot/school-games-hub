// Drives every Circuit Racer road with careful, average and wild bots and prints times, medal times and
// battery/signal margins (docs/CIRCUIT-PLAN.md, "Stage 1 results").
// Run from the project folder with: npm run circuit:sim  [-- --json]
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const JSON_OUT = process.argv.includes('--json');
const entryFile = join(process.cwd(), `.circuit-sim-entry-${process.pid}.ts`);
writeFileSync(
  entryFile,
  `export { botRun } from './shared/circuit/bot.ts';\nexport { replay } from './shared/circuit/physics.ts';\nexport { parseRoad, countRuns } from './shared/circuit/road.ts';\nexport { MOTHERBOARD_ROADS } from './shared/circuit/roads/motherboard.ts';\nexport { STEPS_PER_SECOND } from './shared/circuit/config.ts';\n`,
);
const dir = mkdtempSync(join(tmpdir(), 'circuit-sim-'));
let mod;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  mod = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
}

const secs = (steps) => steps / mod.STEPS_PER_SECOND;
const rows = [];
let bad = 0;
for (const def of mod.MOTHERBOARD_ROADS) {
  const road = mod.parseRoad(def);
  const row = { road: def.name, rows: road.length, ports: mod.countRuns(road, '+') };
  for (const name of ['careful', 'average', 'wild']) {
    const r = mod.botRun(road, name);
    const done = r.state.outcome === 'finished';
    if (name !== 'wild' && (!done || r.attempts > 1)) bad++;
    // The server's replay must agree with the run exactly.
    const again = mod.replay(road, r.log);
    if (done && (again.outcome !== 'finished' || again.steps !== r.state.steps)) {
      bad++;
      console.error(`${def.id} ${name}: replay gave ${again.outcome} in ${again.steps} steps, the run ${r.state.steps}`);
    }
    row[name] = {
      time: done ? +secs(r.state.steps).toFixed(1) : null,
      outcome: r.state.outcome,
      attempts: r.attempts,
      fails: r.fails,
      battery: Math.round(r.minBattery),
      signal: Math.round(r.minSignal),
    };
  }
  // Medals (Stage 4 sets them from these): gold a little slower than the wild bot, silver than the average bot.
  const fast = row.wild.time ?? row.average.time;
  row.gold = fast && Math.ceil(fast * 1.1);
  row.silver = row.average.time && Math.ceil(Math.max(row.average.time * 1.15, row.gold + 3));
  rows.push(row);
}

if (JSON_OUT) console.log(JSON.stringify(rows, null, 2));
else {
  const cell = (b) => (b.time === null ? `${b.outcome} (${b.attempts} goes)` : `${b.time}s${b.attempts > 1 ? ` (${b.attempts} goes)` : ''}, ${b.battery}% / ${b.signal}%`);
  console.log('| Road | Rows | Ports | Careful (time, lowest battery / signal) | Average | Wild | Gold | Silver |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.road} | ${r.rows} | ${r.ports} | ${cell(r.careful)} | ${cell(r.average)} | ${cell(r.wild)} | ${r.gold}s | ${r.silver}s |`);
  for (const r of rows) for (const n of ['careful', 'average', 'wild']) if (r[n].fails.length) console.log(`${r.road} ${n}: ${r[n].fails.join('; ')}`);
}
if (bad) {
  console.error(`${bad} problem(s): a careful or average bot needed more than one go, or a replay disagreed.`);
  process.exit(1);
}
