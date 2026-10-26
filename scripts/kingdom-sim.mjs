// Plays thousands of Kingdom Keeper reigns with the real rules (shared/kingdom/engine.ts), for tuning the numbers
// (docs/KINGDOM-PLAN.md). Three pretend rulers, each with a pupil who gets 0%, 50%, 80% or all of the council right.
//
//   npm run kingdom:sim -- [--runs 2000]
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
const RUNS = Number(option('runs', 2000));

// The rules are TypeScript, so bundle them into one plain JavaScript file first.
const dir = mkdtempSync(join(tmpdir(), 'kingdom-sim-'));
const entryFile = join(process.cwd(), `.kingdom-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export * from './shared/kingdom/engine.ts';\nexport * from './shared/kingdom/reign.ts';\nexport * as config from './shared/kingdom/config.ts';\n`);
let k;
try {
  const bundle = await rolldown({ input: entryFile, logLevel: 'silent' });
  await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
  await bundle.close();
  k = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
} finally {
  rmSync(entryFile, { force: true });
  rmSync(dir, { recursive: true, force: true });
}
const { FOOD_PER_PERSON, ACRES_PER_PERSON } = k.config;

/** Each ruler decides a year from the city and the boons won. Every decision must pass problemWith. */
const RULERS = {
  // Feeds everyone, sells land only to do it, plants all it can, buys land when it's cheap and the store is full.
  careful(city, boons) {
    const { buy: buyPrice, sell: sellPrice } = k.landPrices(city, boons);
    const food = city.people * FOOD_PER_PERSON;
    let sell = city.grain < food ? Math.ceil((food - city.grain) / sellPrice) : 0;
    sell = Math.min(sell, city.land);
    let grain = city.grain + sell * sellPrice - food;
    const wantLand = city.people * ACRES_PER_PERSON - (city.land - sell);
    let buy = 0;
    if (!sell && buyPrice <= 20 && wantLand > 0) buy = Math.max(0, Math.min(wantLand, Math.floor((grain - city.land / 2) / buyPrice)));
    grain -= buy * buyPrice;
    const land = city.land - sell + buy;
    const plant = Math.max(0, Math.min(land, city.people * ACRES_PER_PERSON, grain * 2));
    return { buy, sell, feed: Math.min(food, city.grain + sell * sellPrice), plant };
  },
  // Feeds everyone if it can, plants the rest, never trades.
  simple(city) {
    const feed = Math.min(city.grain, city.people * FOOD_PER_PERSON);
    return { buy: 0, sell: 0, feed, plant: Math.max(0, Math.min(city.land, city.people * ACRES_PER_PERSON, (city.grain - feed) * 2)) };
  },
  // Feeds only 80% to plant more.
  thrifty(city) {
    const feed = Math.min(city.grain, Math.floor(city.people * 0.8) * FOOD_PER_PERSON);
    return { buy: 0, sell: 0, feed, plant: Math.max(0, Math.min(city.land, city.people * ACRES_PER_PERSON, (city.grain - feed) * 2)) };
  },
};

function play(ruler, rightShare, seed) {
  let city = k.newCity(seed);
  const pupil = Math.random;
  while (city.status === 'playing') {
    const council = k.councilFor(k.councilRandom(seed, city.year));
    const boons = council.filter(() => pupil() < rightShare);
    let d = RULERS[ruler](city, boons);
    if (k.problemWith(city, d, boons)) d = { buy: 0, sell: 0, feed: Math.min(city.grain, city.people * FOOD_PER_PERSON), plant: 0 };
    const problem = k.problemWith(city, d, boons);
    if (problem) throw new Error(`${ruler} made a bad year: ${problem} ${JSON.stringify({ city, d })}`);
    city = k.turnYear(city, d, boons, k.yearRandom(seed, city.year));
  }
  return city;
}

const pct = (n) => `${Math.round(n * 100)}%`.padStart(4);
console.log(`Kingdom Keeper: ${RUNS} reigns each\n`);
console.log('ruler     right  legend  good  fair  hard  early  people  points');
for (const ruler of Object.keys(RULERS)) {
  for (const right of [0, 0.5, 0.8, 1]) {
    const tally = { legendary: 0, good: 0, fair: 0, hard: 0 };
    let early = 0;
    let people = 0;
    let points = 0;
    for (let i = 0; i < RUNS; i++) {
      const seed = (i * 2654435761 + right * 1e6 + ruler.length).toString(16).padStart(16, '0').slice(-16);
      const end = play(ruler, right, seed);
      tally[k.ratingOf(end)] += 1;
      if (end.status === 'ended') early += 1;
      people += end.people;
      points += k.pointsFor(end);
    }
    console.log(
      `${ruler.padEnd(9)} ${pct(right)}  ${pct(tally.legendary / RUNS)}  ${pct(tally.good / RUNS)}  ${pct(tally.fair / RUNS)}  ${pct(tally.hard / RUNS)}   ${pct(early / RUNS)}  ${String(Math.round(people / RUNS)).padStart(6)}  ${(points / RUNS).toFixed(1).padStart(6)}`,
    );
  }
}
