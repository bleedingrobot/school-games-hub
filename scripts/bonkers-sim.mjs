// Smash Quest's pace check (docs/BONKERS-PLAN.md): pupils of each kind (how often right, how often they play) go on
// one adventure a school day, using their special move on the first question of each fight. Prints the school day each
// level is reached, fights won and how often the trainer beat them.
// Run from the project folder: npm run bonkers:sim  [-- --json]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const JSON_OUT = process.argv.includes('--json');
const entryFile = join(process.cwd(), `.bonkers-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, "export * from './shared/bonkers/engine.ts';\nexport * as config from './shared/bonkers/config.ts';\n");
const dir = mkdtempSync(join(tmpdir(), 'bonkers-sim-'));
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
const { emptyProgress, questOptions, makeAdventure, replay, rewardsFor, seeded, config } = mod;

const PUPILS = [
  { name: 'strong (90% right), every day', right: 0.9, plays: 1 },
  { name: 'steady (75% right), every day', right: 0.75, plays: 1 },
  { name: 'finding it hard (55% right), every day', right: 0.55, plays: 1 },
  { name: 'steady, 3 days a week', right: 0.75, plays: 0.6 },
];
const SCHOOL_DAYS = 25; // the 5-week season
const RUNS = 200;

function play(pupil, run) {
  const r = seeded(run * 7919 + 13);
  let p = { ...emptyProgress(), hero: { cls: ['knight', 'dazzler', 'granny', 'ninja'][run % 4], look: 'boy' } };
  const reached = { 1: 0 };
  let fights = 0, won = 0, trainers = 0, trainerLosses = 0, questions = 0;
  for (let day = 1; day <= SCHOOL_DAYS; day++) {
    if (r() > pupil.plays) continue;
    const quests = questOptions(`pupil${run}`, `day${day}`, p.level);
    const adv = makeAdventure(Math.floor(r() * 1e9), quests[Math.floor(r() * 2)], p);
    const marks = [];
    let rep = replay(adv, marks);
    while (rep.phase !== 'done' && marks.length < config.QUESTIONS_AN_ADVENTURE) {
      const fresh = !rep.specialUsed;
      marks.push({ right: r() < pupil.right, special: fresh });
      rep = replay(adv, marks);
    }
    questions += marks.length;
    const res = rep.results.filter((x) => !x.trainer);
    fights += res.length;
    won += res.filter((x) => x.outcome === 'won').length;
    if (rep.trainerMet) { trainers++; if (!rep.trainerWon) trainerLosses++; }
    const got = rewardsFor(p, rep);
    p = got.progress;
    if (got.levelUp && !reached[got.levelUp]) reached[got.levelUp] = day;
  }
  return { reached, level: p.level, fights, won, trainers, trainerLosses, questions, adventures: p.stats.adventures };
}

const out = PUPILS.map((pupil) => {
  const runs = Array.from({ length: RUNS }, (_, i) => play(pupil, i));
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const dayFor = {};
  for (let l = 2; l <= config.MAX_LEVEL; l++) {
    const days = runs.map((x) => x.reached[l] ?? Infinity);
    const m = median(days);
    dayFor[l] = Number.isFinite(m) ? m : null;
  }
  const sum = (k) => runs.reduce((s, x) => s + x[k], 0);
  return {
    pupil: pupil.name,
    endLevel: median(runs.map((x) => x.level)),
    dayFor,
    wonShare: Math.round((100 * sum('won')) / Math.max(1, sum('fights'))),
    trainerLossShare: Math.round((100 * sum('trainerLosses')) / Math.max(1, sum('trainers'))),
    questionsAnAdventure: Math.round(sum('questions') / Math.max(1, sum('adventures'))),
    questionsAFight: Math.round((10 * sum('questions')) / Math.max(1, sum('fights') + sum('trainers'))) / 10,
  };
});

if (JSON_OUT) console.log(JSON.stringify(out, null, 2));
else for (const o of out) {
  console.log(`\n${o.pupil}`);
  console.log(`  level after 5 weeks (median): ${o.endLevel}   fights won ${o.wonShare}%   trainer beat them ${o.trainerLossShare}% of meetings   ~${o.questionsAnAdventure} questions an adventure (${o.questionsAFight} a fight)`);
  console.log(`  school day each level is reached: ${Object.entries(o.dayFor).map(([l, d]) => `L${l} ${d ?? '-'}`).join('  ')}`);
}
