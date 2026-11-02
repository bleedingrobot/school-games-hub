// How long the quest rewards take: pretend pupils win their wild battles each day in their newest area,
// collect bits, and we count the days until each wake-up item can be made.
// Run from the project folder with: node scripts/monsters-quests-sim.mjs  [-- --wins 10] [-- --pupils 500]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const WINS = option('wins', 10);
const PUPILS = option('pupils', 500);

const dir = mkdtempSync(join(tmpdir(), 'monsters-qsim-'));
const entryFile = join(process.cwd(), `.monsters-qsim-entry-${process.pid}.ts`);
writeFileSync(entryFile, [
  "export * from './shared/monsters/quests/bits.ts';",
  "export * from './shared/monsters/quests/giants.ts';",
  "export { WORLD_MAPS } from './shared/monsters/maps/index.ts';",
  "export { wildFor } from './shared/monsters/world/encounters.ts';",
  "export { Dice } from './shared/monsters/world/rng.ts';",
].join('\n'));
let m;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'q.mjs'), format: 'esm' });
  await bundle.close();
  m = await import(pathToFileURL(join(dir, 'q.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}

// Each giant: the area a pupil farms while saving for it (the giant's own area), and its recipe.
const areaMap = Object.values(m.WORLD_MAPS).filter((x) => x.area >= 1 && x.wild.length);
const mapFor = (area) => areaMap.find((x) => x.area === area);
const GIANT_AREA = { snorumble: 3, drowsea: 2, yawnberg: 4 };
const out = [];
for (const g of m.GIANTS) {
  const recipe = m.RECIPES.find((r) => r.flag === g.item);
  const days = [];
  for (let p = 0; p < PUPILS; p++) {
    const dice = new m.Dice(1000 + p);
    const map = mapFor(GIANT_AREA[g.id]);
    let bits = {};
    let day = 0;
    while (!m.hasBits(bits, recipe.cost) && day < 60) {
      day++;
      for (let w = 0; w < WINS; w++) {
        // Pupils wander the area: half the time in the far half.
        const far = dice.next() < 0.5;
        const i = map.far.findIndex((f, k) => f === far && map.isGrass[k]);
        const k = i < 0 ? map.isGrass.indexOf(true) : i;
        const foe = m.wildFor(map, k % map.width, Math.floor(k / map.width), dice);
        bits = m.addBits(bits, m.bitsForWin([foe.species], false));
      }
    }
    days.push(day);
  }
  days.sort((a, b) => a - b);
  out.push({ giant: g.id, item: recipe.name, cost: m.describeBits(recipe.cost), area: map(GIANT_AREA[g.id]), median: days[days.length >> 1], fastest: days[0], slowest: days[days.length - 1] });
}
function map(a) { return mapFor(a).name; }
console.log(`Days of play (${WINS} wild wins a day, bits from that giant's own area) until the wake-up item's bits are collected:`);
console.table(out);
