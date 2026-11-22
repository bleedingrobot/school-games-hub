// Drives every Circuit Racer road with careful, average and wild bots and prints times, medal times and
// battery/signal margins (docs/CIRCUIT-PLAN.md, "Stage 1 results" and "Stage 4 results").
// Run from the project folder with: npm run circuit:sim  [-- --json] [-- --world graphics] [-- --road hot-wire]
//
// Checks (exit 1 if any fails):
// - the careful and average bots finish every road on their first go, and the server's replay agrees exactly;
// - a careful driver stays above half battery (James, 23 Nov 2026: harder through jumps, never a tight battery);
// - with every recharge port answered wrong (a half charge), the careful bot still finishes on its first go;
// - every road a careful driver takes over 60 seconds on has a checkpoint.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : null;
};
const JSON_OUT = process.argv.includes('--json');
const ONLY_WORLD = arg('world');
const ONLY_ROAD = arg('road');
const entryFile = join(process.cwd(), `.circuit-sim-entry-${process.pid}.ts`);
writeFileSync(
  entryFile,
  `export { botRun } from './shared/circuit/bot.ts';\nexport { replay } from './shared/circuit/physics.ts';\nexport { parseRoad, countRuns } from './shared/circuit/road.ts';\nexport { WORLDS } from './shared/circuit/game.ts';\nexport { STEPS_PER_SECOND, HALF_REFILL } from './shared/circuit/config.ts';\n`,
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
const problems = [];
for (const world of mod.WORLDS) {
  if (ONLY_WORLD && world.id !== ONLY_WORLD) continue;
  for (const def of world.roads) {
    if (ONLY_ROAD && def.id !== ONLY_ROAD) continue;
    const road = mod.parseRoad(def);
    const row = { world: world.id, id: def.id, road: def.name, rows: road.length, ports: road.ports.length, gates: road.gates.length, checkpoints: road.checkpoints.length };
    for (const name of ['careful', 'average', 'wild']) {
      const r = mod.botRun(road, name);
      const done = r.state.outcome === 'finished';
      if (name !== 'wild' && (!done || r.attempts > 1)) problems.push(`${def.id} ${name}: ${done ? `${r.attempts} goes` : r.state.outcome} (${r.fails.join('; ')})`);
      // The server's replay must agree with the run exactly.
      const again = mod.replay(road, r.log);
      if (done && (again.outcome !== 'finished' || again.steps !== r.state.steps)) problems.push(`${def.id} ${name}: replay gave ${again.outcome} in ${again.steps} steps, the run ${r.state.steps}`);
      row[name] = {
        time: done ? +secs(r.state.steps).toFixed(1) : null,
        outcome: r.state.outcome,
        attempts: r.attempts,
        fails: r.fails,
        battery: Math.round(r.minBattery),
        signal: Math.round(r.minSignal),
      };
    }
    if (row.careful.battery <= 50) problems.push(`${def.id}: careful battery dips to ${row.careful.battery}%`);
    if (row.careful.signal <= 40) problems.push(`${def.id}: careful signal dips to ${row.careful.signal}%`);
    // Every port answered wrong: half charges only. A careful driver must still finish.
    if (road.ports.length) {
      const half = mod.botRun(road, 'careful', { refills: road.ports.map(() => mod.HALF_REFILL), gateRight: null }, 1);
      row.halfCharge = { outcome: half.state.outcome, battery: Math.round(half.minBattery), signal: Math.round(half.minSignal) };
      if (half.state.outcome !== 'finished') problems.push(`${def.id}: with half charges the careful bot ${half.state.outcome}`);
    }
    if (row.careful.time > 60 && !road.checkpoints.length) problems.push(`${def.id}: ${row.careful.time}s careful but no checkpoint`);
    // Medals: gold a little slower than the wild bot, silver than the average bot.
    const fast = row.wild.time ?? row.average.time;
    row.gold = fast && Math.ceil(fast * 1.1);
    row.silver = row.average.time && Math.ceil(Math.max(row.average.time * 1.15, row.gold + 3));
    rows.push(row);
    if (!JSON_OUT) process.stderr.write(`${def.id} `);
  }
}

if (JSON_OUT) console.log(JSON.stringify(rows, null, 2));
else {
  console.log('');
  const cell = (b) => (b.time === null ? `${b.outcome} (${b.attempts} goes)` : `${b.time}s${b.attempts > 1 ? ` (${b.attempts} goes)` : ''}, ${b.battery}% / ${b.signal}%`);
  console.log('| Road | Rows | Ports / gates / checkpoints | Careful (time, lowest battery / signal) | Half charges (careful) | Average | Wild | Gold | Silver |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const h = r.halfCharge ? `${r.halfCharge.battery}% / ${r.halfCharge.signal}%` : '-';
    console.log(`| ${r.road} | ${r.rows} | ${r.ports} / ${r.gates} / ${r.checkpoints} | ${cell(r.careful)} | ${h} | ${cell(r.average)} | ${cell(r.wild)} | ${r.gold}s | ${r.silver}s |`);
  }
  for (const r of rows) for (const n of ['careful', 'average', 'wild']) if (r[n].fails.length) console.log(`${r.road} ${n}: ${r[n].fails.join('; ')}`);
  console.log('');
  console.log(`MEDAL_SECONDS: ${rows.map((r) => `'${r.id}': { gold: ${r.gold}, silver: ${r.silver} }`).join(', ')}`);
}
if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
