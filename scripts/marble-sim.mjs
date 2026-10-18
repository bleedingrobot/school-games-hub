// Checks every Marble Rush course can be finished and prints the reference times.
// Run from the project folder with: npm run marble:sim  [-- --json]
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const JSON_OUT = process.argv.includes('--json');
const entryFile = join(process.cwd(), `.marble-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export { botRun } from './shared/marble/bot.ts';\nexport { COURSES } from './shared/marble/courses.ts';\nexport { medalFor } from './shared/marble/engine.ts';\nexport { encodeInputs } from './shared/marble/inputs.ts';\n`);
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
for (const c of mod.COURSES) {
  for (const mode of ['up', 'down']) {
    const bot = mod.botRun(c, { mode });
    const s = bot.state;
    const ok = s.outcome === 'finished';
    if (!ok) bad++;
    rows.push({
      course: c.def.id, mode, outcome: s.outcome, seconds: ok ? s.finishSteps / 60 : null, falls: s.falls,
      medal: ok && mode === 'up' ? mod.medalFor(c, s.finishSteps) : null, gold: c.def.medals.gold, inputBytes: mod.encodeInputs(bot.runs).length,
    });
  }
}
if (JSON_OUT) console.log(JSON.stringify(rows, null, 2));
else {
  for (const r of rows) {
    console.log(`${r.course.padEnd(16)} ${r.mode === 'up' ? 'count-up  ' : 'hard mode '} ${r.outcome.padEnd(9)} ${r.seconds === null ? '   -  ' : r.seconds.toFixed(2).padStart(6) + 's'}  falls ${r.falls}  ${r.medal ? r.medal + ' (gold is ' + r.gold + 's)' : ''}  run ${r.inputBytes} bytes`);
  }
}
process.exit(bad ? 1 : 0);
