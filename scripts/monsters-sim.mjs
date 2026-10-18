// Plays thousands of Maths Monsters battles with pretend students and prints how they went.
// Run from the project folder with: npm run monsters:sim  [-- --battles 2000] [-- --json]
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
const BATTLES = Number(option('battles', 2000));
const JSON_OUT = args.includes('--json');

// The rules are TypeScript, so bundle them into one plain JavaScript file first.
const dir = mkdtempSync(join(tmpdir(), 'monsters-sim-'));
const entryFile = join(process.cwd(), `.monsters-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export * from './shared/monsters/sim.ts';\nexport * from './shared/monsters/world/routeSim.ts';\n`);
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
const { STUDENTS, simWild, simTower, simLevelling, simRealTower, simRoute } = mod;

const pct = (n) => `${(n * 100).toFixed(0)}%`;
const f1 = (n) => n.toFixed(1);
const out = { wild: [], wildCatch: [], tower: [], levelling: [] };

const line = (label, r) =>
  `${label.padEnd(26)} win ${pct(r.winRate).padStart(4)} | questions ${f1(r.questions.mean)} (p50 ${r.questions.p50}, p90 ${r.questions.p90}, max ${r.questions.max}) | ${f1(r.minutes.mean)} min (p90 ${f1(r.minutes.p90)})`;

for (const [mode, key, catchBelow] of [['Wild battle, fight only', 'wild', 0], ['Wild battle, then catch', 'wildCatch', 0.4]]) {
  if (!JSON_OUT) console.log(`\n${mode} (team matched to the area):`);
  for (let area = 1; area <= 6; area++) {
    for (const [name, right] of Object.entries(STUDENTS)) {
      const r = simWild(area, { right, quick: 0.5, catchBelow }, BATTLES, `${key}:${area}:${name}`);
      out[key].push({ area, student: name, ...r });
      if (!JSON_OUT) console.log(line(`area ${area}, ${name} right`, r));
    }
  }
}

if (!JSON_OUT) console.log('\nFirst area, a single level-5 monster team of 3 against wild 2-6 (the 50% student):');
{
  const r = simWild(1, { right: 0.5, quick: 0.5, catchBelow: 0 }, BATTLES, 'first-area', 5);
  out.firstArea = r;
  if (!JSON_OUT) console.log(line('area 1, level-5 team, 50%', r));
}

if (!JSON_OUT) console.log('\nTower trainer (3 monsters), team at the area\'s top level:');
for (let area = 1; area <= 6; area++) {
  for (const [name, right] of Object.entries(STUDENTS)) {
    const r = simTower(area, { right, quick: 0.5, catchBelow: 0 }, Math.round(BATTLES / 2), `tower:${area}:${name}`);
    out.tower.push({ area, student: name, ...r });
    if (!JSON_OUT) console.log(line(`area ${area}, ${name} right`, r));
  }
}

if (!JSON_OUT) console.log('\nLevelling (fight wild until the lead is as strong as the area\'s top wild monster, then 3 trainers + the Tower):');
for (const [name, right] of Object.entries(STUDENTS)) {
  const runs = Array.from({ length: 20 }, (_, i) => simLevelling({ right, quick: 0.5, catchBelow: 0 }, `lv:${name}:${i}`));
  const avg = (get) => runs.reduce((a, r) => a + get(r), 0) / runs.length;
  const battlesToReady = runs[0].battlesToReady.map((_, a) => avg((r) => r.battlesToReady[a]));
  const levelAfterArea = runs[0].levelAfterArea.map((_, a) => avg((r) => r.levelAfterArea[a]));
  const per = runs[0].battlesPerLevel.map((_, b) => ({ ...runs[0].battlesPerLevel[b], battles: avg((r) => r.battlesPerLevel[b]?.battles ?? NaN) }));
  const row = { student: name, battlesToReady, levelAfterArea, battlesPerLevel: per, totalBattles: avg((r) => r.totalBattles), losses: avg((r) => r.losses), hours: avg((r) => r.minutes) / 60 };
  out.levelling.push(row);
  if (!JSON_OUT) {
    console.log(`${name} right: wild battles to get ready, per area: ${battlesToReady.map(f1).join(', ')}`);
    console.log(`   lead level at the end of each area ${levelAfterArea.map(f1).join(' → ')}`);
    console.log(`   battles per level gained: ${per.map((b) => `${b.from}-${b.to}: ${Number.isNaN(b.battles) ? 'not reached' : f1(b.battles)}`).join(', ')} | ${f1(row.totalBattles)} battles in all, ${f1(row.losses)} lost, ~${f1(row.hours)} h of battling`);
  }
}
if (!JSON_OUT) console.log('\nThe real game route (real wild lists, trainers and Towers), 40 students each:');
out.route = [];
for (const [name, right] of Object.entries(STUDENTS)) {
  const runs = Array.from({ length: 40 }, (_, i) => simRoute({ right, quick: 0.5, catchBelow: 0 }, `route:${name}:${i}`));
  const avg = (get) => runs.reduce((a, r) => a + get(r), 0) / runs.length;
  const row = {
    student: name,
    battlesToReady: runs[0].battlesToReady.map((_, a) => avg((r) => r.battlesToReady[a])),
    leadAtTower: runs[0].leadAtTower.map((_, a) => avg((r) => r.leadAtTower[a])),
    towerTries: runs[0].towerTries.map((_, a) => avg((r) => r.towerTries[a])),
    firstTry: runs[0].towerTries.map((_, a) => runs.filter((r) => r.towerTries[a] === 1).length / runs.length),
    battles: avg((r) => r.totalBattles),
    losses: avg((r) => r.losses),
    hours: avg((r) => r.minutes) / 60,
  };
  out.route.push(row);
  if (!JSON_OUT) {
    console.log(`${name} right: ${f1(row.battles)} battles in all (${f1(row.losses)} lost), ~${f1(row.hours)} h of battling`);
    console.log(`   wild battles to get ready, per area: ${row.battlesToReady.map(f1).join(', ')}`);
    console.log(`   lead level at each Tower: ${row.leadAtTower.map(f1).join(', ')}`);
    console.log(`   Towers beaten first time: ${row.firstTry.map(pct).join(', ')}; tries on average: ${row.towerTries.map(f1).join(', ')}`);
  }
}

if (!JSON_OUT) console.log('\nThe real Tower trainers: team of 3 at the area\'s top wild level (ready) and 3 levels lower (behind):');
out.realTower = [];
for (let area = 1; area <= 6; area++) {
  for (const [name, right] of Object.entries(STUDENTS)) {
    const r = simRealTower(area, { right, quick: 0.5, catchBelow: 0 }, Math.round(BATTLES / 2), `rt:${area}:${name}`);
    out.realTower.push({ student: name, ...r });
    if (!JSON_OUT) console.log(`area ${area}, ${name} right: ready wins ${pct(r.ready.winRate)} (${f1(r.ready.questions.mean)} questions, ${f1(r.ready.minutes.mean)} min) | behind wins ${pct(r.behind.winRate)}`);
  }
}
if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
