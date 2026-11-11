// Toon Flap's sim: flies every level with the bot, checks each can be finished with no bumps (also with Gentle wings, and
// through every answer gap), and prints the times. With --write-medals it writes shared/toonflap/medals.ts.
// Run from the project folder: npm run toonflap:sim  [-- --write-medals] [-- --json]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const JSON_OUT = process.argv.includes('--json');
const WRITE_MEDALS = process.argv.includes('--write-medals');
const entryFile = join(process.cwd(), `.toonflap-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, [
  "export { botRun, planRun } from './shared/toonflap/bot.ts';",
  "export { LEVELS, buildCourse } from './shared/toonflap/levels.ts';",
  "export { replayRun, scoreRun, encodeFlaps, decodeFlaps } from './shared/toonflap/engine.ts';",
  "export * as config from './shared/toonflap/config.ts';",
  "export { addRun, emptyProgress, levelOpen } from './shared/toonflap/collection.ts';",
].join('\n') + '\n');
const dir = mkdtempSync(join(tmpdir(), 'toonflap-sim-'));
let mod;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  mod = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
}
const { config } = mod;
const sec = (steps) => steps / config.STEPS_PER_SECOND;
let bad = 0;
const rows = [];
const medals = {};

for (const def of mod.LEVELS) {
  const course = mod.buildCourse(def);
  const row = { level: def.n, id: def.id, walls: course.walls.length, checks: course.perches.length, signs: course.signs.length };
  // 1. The perfect flight: no bumps, through every answer wall's every gap (the right one depends on the seed).
  const gapCounts = course.signs.map((s) => course.walls[s.wall].gaps.length);
  const most = Math.max(1, ...gapCounts);
  let worstBumps = 0;
  let flying = 0;
  for (let g = 0; g < most; g++) {
    const run = mod.planRun(course, { gaps: gapCounts.map((n) => g % n) });
    if (!run) {
      bad++;
      row.problem = `gap ${g}: no way through found`;
      continue;
    }
    const replay = mod.replayRun(course, mod.decodeFlaps(mod.encodeFlaps(run.flaps)));
    const same = replay.valid && replay.state.t === run.state.t && replay.state.bumps === run.state.bumps;
    if (run.state.outcome !== 'finished' || !same) {
      bad++;
      row.problem = `gap ${g}: ${run.state.outcome}${same ? '' : ', replay differs'}`;
    }
    worstBumps = Math.max(worstBumps, run.state.bumps);
    flying = run.state.t;
  }
  row.flying = sec(flying);
  row.botBumps = worstBumps;
  if (worstBumps > 0) bad++;
  // 2. Gentle wings: still finishable.
  const gentle = mod.planRun(mod.buildCourse(def, true));
  row.gentle = gentle ? `${sec(gentle.state.t).toFixed(1)}s` : 'FAILED';
  if (!gentle) bad++;
  // 3. Wobbly flyers: how many bumps a less careful pupil might get (average of 20).
  let wobbly = 0;
  for (let n = 1; n <= 20; n++) wobbly += mod.botRun(course, { wobble: 0.4, seed: n * 977 }).state.bumps;
  row.wobblyBumps = wobbly / 20;
  // Medals. Gold: a perfect run with every bonus (or every flying second, maths off), rounded up.
  // Silver: SILVER_BUMPS bumps (each 3 s plus about the time to fly back) and SILVER_MISSES missed bonuses.
  const bonus = sec(course.perches.length * config.CHECK_BONUS_STEPS + course.signs.length * config.TAILWIND_STEPS);
  const bumpCost = sec(config.BUMP_PENALTY_STEPS) + def.spacing * config.RESPAWN_BACK;
  const miss = config.SILVER_MISSES * (course.signs.length ? sec(config.TAILWIND_STEPS) : sec(config.CHECK_BONUS_STEPS));
  const gold = Math.ceil(sec(flying) - bonus + 0.5);
  const goldPlain = Math.ceil(sec(flying) + 0.5);
  medals[def.id] = {
    gold,
    silver: Math.ceil(gold + config.SILVER_BUMPS * bumpCost + miss),
    goldPlain,
    silverPlain: Math.ceil(goldPlain + config.SILVER_BUMPS * bumpCost),
  };
  row.medals = medals[def.id];
  rows.push(row);
}

// About how long until the potions and flyers come: a steady pupil, 2 sittings of 8 runs a week, 70% checks right.
{
  let p = mod.emptyProgress();
  let seed = 7;
  const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  let runs = 0;
  let weekAll = null;
  for (let week = 1; week <= 8; week++) {
    for (let r = 0; r < 16; r++) {
      // Two sittings a week, on two different days (one new level opens a day).
      const day = `w${String(week).padStart(2, '0')}-${r < 8 ? 'a' : 'b'}`;
      const open = mod.LEVELS.filter((l) => mod.levelOpen(p, l.n, day));
      // Mostly the newest open level, sometimes an older one.
      const def = random() < 0.7 ? open[open.length - 1] : open[Math.floor(random() * open.length)];
      const course = mod.buildCourse(def);
      const checks = course.perches.map(() => random() < 0.7);
      const medal = random() < 0.15 ? 'gold' : random() < 0.5 ? 'silver' : 'bronze';
      const bumps = random() < 0.25 ? 0 : 3;
      p = mod.addRun(p, { level: def.id, maths: true, seconds: 50, medal, bumps, checks, rightGaps: 0, potionUsed: bumps > 0 && p.potions > 0 }, day).progress;
      runs++;
    }
    if (weekAll === null && Object.keys(p.levels).length === 10) weekAll = week;
  }
  console.log(`steady pupil: all 10 levels open by week ${weekAll ?? 'later than 8'}; potions earned in 8 weeks: ${p.potionsEarned} (${(p.potionsEarned / 8).toFixed(1)} a week)`);
}

if (WRITE_MEDALS) {
  const body = Object.entries(medals).map(([id, m]) => `  ${id}: { gold: ${m.gold}, silver: ${m.silver}, goldPlain: ${m.goldPlain}, silverPlain: ${m.silverPlain} },`).join('\n');
  writeFileSync('shared/toonflap/medals.ts', `/**
 * Medal times for each level, in seconds. Written by the sim: npm run toonflap:sim -- --write-medals
 * (scripts/toonflap-sim.mjs). Don't edit by hand.
 */
import type { LevelMedals } from './levels';

export const MEDALS: Readonly<Record<string, LevelMedals>> = {
${body}
};
`);
  console.log('wrote shared/toonflap/medals.ts');
}
if (JSON_OUT) console.log(JSON.stringify(rows, null, 2));
else {
  for (const r of rows) {
    console.log(`${String(r.level).padStart(2)} ${r.id.padEnd(8)} walls ${String(r.walls).padStart(2)}  checks ${r.checks}  signs ${r.signs}  flying ${r.flying.toFixed(1)}s  bot bumps ${r.botBumps}  wobbly ${r.wobblyBumps.toFixed(1)}  gentle ${r.gentle}  gold ${r.medals.gold}s silver ${r.medals.silver}s (maths off ${r.medals.goldPlain}/${r.medals.silverPlain})${r.problem ? '  PROBLEM ' + r.problem : ''}`);
  }
}
process.exit(bad ? 1 : 0);
