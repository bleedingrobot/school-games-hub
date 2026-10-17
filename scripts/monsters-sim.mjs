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
writeFileSync(entryFile, `export * from './shared/monsters/sim.ts';\n`);
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
const { STUDENTS, simWild, simTower, simLevelling } = mod;

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
if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
