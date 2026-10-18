// Checks every Marble Rush course can be finished and prints the reference times.
// Run from the project folder with: npm run marble:sim  [-- --json]
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const JSON_OUT = process.argv.includes('--json');
const WRITE_MEDALS = process.argv.includes('--write-medals');
const entryFile = join(process.cwd(), `.marble-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { botRun } from './shared/marble/bot.ts';\nexport { COURSES } from './shared/marble/courses.ts';\nexport { medalFor } from './shared/marble/engine.ts';\nexport { encodeInputs } from './shared/marble/inputs.ts';\nexport { doorsForSeed } from './shared/marble/maths.ts';\n`);
const dir = mkdtempSync(join(tmpdir(), 'marble-sim-'));
let mod;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  mod = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
}
const rows = [];
let bad = 0;
const SEEDS = 8;
for (const c of mod.COURSES) {
  // Gates: which tunnel is open depends on the run's seed, so play several seeds and report the slowest (and the fastest).
  for (const [mode, wrongFirst] of [['up', false], ['down', false], ['up', true]]) {
    let worst = null;
    let best = Infinity;
    let fails = 0;
    for (let n = 1; n <= (c.gates.length ? SEEDS : 1); n++) {
      const doors = mod.doorsForSeed(c, `sim-seed-${n}`, null);
      const bot = mod.botRun(c, { mode, openDoors: doors, wrongFirst });
      if (bot.state.outcome !== 'finished') {
        fails++;
        continue;
      }
      best = Math.min(best, bot.state.finishSteps / 60);
      if (!worst || bot.state.finishSteps > worst.state.finishSteps) worst = bot;
    }
    if (fails) bad++;
    const ok = worst !== null;
    rows.push({
      course: c.def.id, mode: wrongFirst ? 'wrong' : mode, outcome: fails ? `${fails} FAILED` : 'finished', seconds: ok ? worst.state.finishSteps / 60 : null, fastest: ok ? best : null,
      falls: ok ? worst.state.falls : 0, medal: ok && mode !== 'down' ? mod.medalFor(c, worst.state.finishSteps) : null, gold: c.def.medals.gold, inputBytes: ok ? mod.encodeInputs(worst.runs).length : 0,
    });
  }
}
if (WRITE_MEDALS) {
  // Medal times from each course's reference run: gold is the bot's perfect run (every gate's open tunnel, slowest seed); silver must be reachable
  // with every gate wrong first (a guessed-wrong tunnel costs about GATE_COST seconds, so it is worked out from the perfect run); bronze and hard mode are looser.
  const GATE_COST = 6.5;
  const medals = {};
  for (const c of mod.COURSES) {
    if (!c.def.id.includes('-') || c.def.id.startsWith('test-')) continue;
    const ref = rows.find((r) => r.course === c.def.id && r.mode === 'up').seconds;
    const wrong = ref + GATE_COST * c.gates.length;
    const gold = Math.ceil(ref);
    const silver = Math.max(Math.round(gold * 1.48), Math.ceil(wrong * 1.05));
    const bronze = Math.max(Math.round(gold * 2.3), Math.ceil(silver * 1.45));
    const hard = Math.max(Math.round(gold * 2), Math.ceil(wrong * 1.1));
    medals[c.def.id] = { gold, silver, bronze, hard };
  }
  writeFileSync('scripts/marble-medals.json', JSON.stringify(medals, null, 1) + '\n');
  console.log('wrote scripts/marble-medals.json');
}
if (JSON_OUT) console.log(JSON.stringify(rows, null, 2));
else {
  for (const r of rows) {
    console.log(`${r.course.padEnd(16)} ${r.mode === 'up' ? 'count-up  ' : r.mode === 'wrong' ? 'wrong first' : 'hard mode '} ${r.outcome.padEnd(9)} ${r.seconds === null ? '   -  ' : r.seconds.toFixed(2).padStart(6) + 's (fastest ' + r.fastest.toFixed(2) + 's)'}  falls ${r.falls}  ${r.medal ? r.medal + ' (gold is ' + r.gold + 's)' : ''}  run ${r.inputBytes} bytes`);
  }
}
process.exit(bad ? 1 : 0);
