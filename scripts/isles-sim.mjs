// Plays whole Sky Isles seasons with the real rules (shared/isles/engine.ts), for tuning the numbers
// (docs/ISLES-PLAN.md, section 6.1). Pretend pupils who play 5, 3 or 1 days a week, with three ways of playing and
// maths right all, most or none of the time. Prints when each reaches Grand Isle and lights the Lighthouse.
//
//   npm run isles:sim -- [--runs 300]
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
const RUNS = Number(option('runs', 300));

// The rules are TypeScript, so bundle them into one plain JavaScript file first.
const dir = mkdtempSync(join(tmpdir(), 'isles-sim-'));
const entryFile = join(process.cwd(), `.isles-sim-entry-${process.pid}.ts`);
writeFileSync(entryFile, `export * from './shared/isles/engine.ts';\nexport * as config from './shared/isles/config.ts';\n`);
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
const C = k.config;

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRICES = { ...C.MARKET_PRICE };

/** Tries a choice on the running island; keeps it only if the rules allow it. */
function tryAction(state, action) {
  if (k.problemWith(state.island, action, PRICES)) return false;
  state.island = k.apply(state.island, action, PRICES);
  state.actions.push(action);
  return true;
}

const foodPerTurn = (island) => k.levels(island, 'farm') * C.FARM_FOOD * (k.has(island, 'ploughs') ? C.UPGRADE_BOOST : 1);
const hungry = (island) => foodPerTurn(island) < k.foodNeeded(island) + 2;
const crowded = (island) => island.people > k.room(island) * 0.85;

/** What to build on an empty spot, for a sensible pupil. */
function wantedPlot(island, style) {
  if (hungry(island)) return 'farm';
  if (crowded(island)) return 'house';
  if (style !== 'grabber' && k.count(island, 'library') < (k.spotCount(island) >= 10 ? 2 : 1)) return 'library';
  if (k.count(island, 'workshop') < Math.max(1, Math.floor(k.spotCount(island) / 6))) return 'workshop';
  return island.happiness >= 60 && k.count(island, 'dock') <= k.count(island, 'mine') ? 'dock' : 'mine';
}

/** Which spot to raise a level next: food or room first if short, then the money-makers, cheapest first. */
function spotToRaise(island) {
  const want = hungry(island) ? ['farm'] : crowded(island) ? ['house'] : ['dock', 'mine', 'library', 'workshop', 'farm', 'house'];
  let best = -1;
  let bestCost = Infinity;
  island.spots.forEach((spot, i) => {
    const price = k.raisePrice(island, i);
    if (!price || !want.includes(spot.kind)) return;
    const cost = price.coins * (1 + want.indexOf(spot.kind) * 0.15);
    if (cost < bestCost) [best, bestCost] = [i, cost];
  });
  return best;
}

const averageLevel = (island) => island.spots.reduce((s, spot) => s + spot.level, 0) / island.spots.length;

/** The pupil's spending for one turn, made on the island after collecting and feeding. */
function decide(island, style, day) {
  const state = { island, actions: [] };
  const tax = style === 'greedy' ? 'high' : island.happiness < 45 ? 'low' : 'fair';
  if (island.tax !== tax) tryAction(state, { kind: 'tax', level: tax });
  const share = k.isGrandIsle(state.island) ? 0 : 25;
  if (state.island.boatShare !== share) tryAction(state, { kind: 'workshop', boatShare: share });

  for (const u of C.UPGRADES) tryAction(state, { kind: 'upgrade', id: u.id });
  if (state.island.happiness < 50 && state.island.coins > 120) tryAction(state, { kind: 'festival' });

  // Keep goods for level 3 buildings and the Lighthouse; sell the rest, and food over the store.
  const keepGoods = k.isGrandIsle(state.island) ? 1000 : 12;
  if (state.island.goods > keepGoods) tryAction(state, { kind: 'sell', good: 'goods', amount: state.island.goods - keepGoods });
  const spareFood = state.island.food - k.store(state.island);
  if (spareFood > 0) tryAction(state, { kind: 'sell', good: 'food', amount: spareFood });
  // Buy food if it would run out next turn.
  const short = k.foodNeeded(state.island) - state.island.food - foodPerTurn(state.island);
  if (short > 0) tryAction(state, { kind: 'buy', good: 'food', amount: short });

  for (let guard = 0; guard < 30; guard++) {
    const empty = state.island.spots.findIndex((spot) => spot.kind === 'empty');
    if (empty >= 0) {
      if (!tryAction(state, { kind: 'build', spot: empty, plot: wantedPlot(state.island, style) })) break;
      continue;
    }
    if (hungry(state.island) || crowded(state.island)) {
      const spot = spotToRaise(state.island);
      if (spot >= 0 && tryAction(state, { kind: 'raise', spot })) continue;
    }
    if (k.isGrandIsle(state.island)) {
      if (tryAction(state, { kind: 'lighthouse' })) continue;
      const spot = spotToRaise(state.island);
      // After Grand Isle, save up for the next Lighthouse stage before raising more.
      if (state.island.lighthouse < C.LIGHTHOUSE.length || spot < 0 || !tryAction(state, { kind: 'raise', spot })) break;
      continue;
    }
    // A grabber anchors whenever it can; the others raise buildings until the island averages level 1.5 (2 for steady).
    const goal = style === 'grabber' ? 0 : style === 'steady' ? 2 : 1.5;
    if (averageLevel(state.island) < goal) {
      const spot = spotToRaise(state.island);
      if (spot >= 0 && tryAction(state, { kind: 'raise', spot })) continue;
    }
    if (tryAction(state, { kind: 'anchor' })) continue;
    // Can't anchor (no coins or no drift): raise a building instead, keeping enough back for the next chunk if one's waiting.
    const spot = spotToRaise(state.island);
    if (spot < 0) break;
    const price = k.raisePrice(state.island, spot);
    if (state.island.driftLeft > 0 && state.island.coins - price.coins < k.chunkPrice(state.island) * 0.5) break;
    if (!tryAction(state, { kind: 'raise', spot })) break;
  }
  return state.actions;
}

const PLAYERS = [
  { name: 'every day', days: [1, 1, 1, 1, 1, 0, 0] },
  { name: '3 days a week', days: [1, 0, 1, 0, 1, 0, 0] },
  { name: '1 day a week', days: [0, 0, 1, 0, 0, 0, 0] },
];
const STYLES = ['steady', 'greedy', 'grabber'];
const MATHS = [1, 0.7, 0];
const SEASON_DAYS = 35;

function season(player, style, right, seed) {
  const random = seeded(seed);
  let island = k.newIsland();
  let lastDay = 0;
  const out = { grandDay: null, lightDay: null, hungryTurns: 0, turns: 0, maxCoins: 0, end: null };
  for (let day = 0; day < SEASON_DAYS; day++) {
    if (!player.days[day % 7]) continue;
    if (day > 0) island = k.newDay(island, day - lastDay, 10);
    lastDay = day;
    // A lesson's play: up to 6 turns.
    let prizes = 0;
    for (let t = 0; t < C.TURNS_PER_DAY && island.turnsLeft > 0; t++) {
      const windy = random() < right;
      const { island: ready } = k.beforeSpending(island, windy);
      const actions = decide(ready, style, day);
      const result = k.playTurn(island, windy, actions, PRICES, random);
      if (!result.ok) throw new Error(`refused: ${result.problem} at ${result.at}`);
      island = result.island;
      out.turns++;
      if (result.report.hungryLeft > 0) out.hungryTurns++;
      out.maxCoins = Math.max(out.maxCoins, island.coins);
      // Races: two a day against the Gull Riders or a classmate, about an even chance each.
      if (t < C.RACES_PER_DAY && random() < 0.4 + 0.1 * right) {
        const prize = prizes++ === 0 ? C.FIRST_WIN_PRIZE : C.LATER_WIN_PRIZE;
        island = { ...island, coins: island.coins + prize.coins, goods: island.goods + prize.goods };
      }
      if (out.grandDay === null && k.isGrandIsle(island)) out.grandDay = day + 1;
      if (out.lightDay === null && island.lighthouse === C.LIGHTHOUSE.length) out.lightDay = day + 1;
    }
  }
  out.end = island;
  return out;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const week = (day) => (day === null ? '  -  ' : `wk ${Math.ceil(day / 7)} (d${String(day).padStart(2)})`);

console.log(`Sky Isles: ${RUNS} seasons for each pupil (${SEASON_DAYS}-day season, ${C.TURNS_PER_DAY} turns a play day)\n`);
console.log('pupil            style    maths  Grand Isle   %got  Lighthouse  %lit  spots  levels  people  upgr  hungry%  most coins');
for (const player of PLAYERS) {
  for (const style of STYLES) {
    for (const right of MATHS) {
      const runs = Array.from({ length: RUNS }, (_, i) => season(player, style, right, i * 7919 + 13));
      const grand = runs.filter((r) => r.grandDay !== null).map((r) => r.grandDay);
      const lit = runs.filter((r) => r.lightDay !== null).map((r) => r.lightDay);
      const ends = runs.map((r) => r.end);
      console.log(
        [
          player.name.padEnd(16),
          style.padEnd(8),
          `${Math.round(right * 100)}%`.padStart(5),
          week(median(grand)).padStart(11),
          `${Math.round((grand.length / RUNS) * 100)}`.padStart(5),
          week(median(lit)).padStart(11),
          `${Math.round((lit.length / RUNS) * 100)}`.padStart(5),
          String(median(ends.map((e) => k.spotCount(e)))).padStart(6),
          String(median(ends.map((e) => e.spots.reduce((s, spot) => s + spot.level, 0)))).padStart(7),
          String(median(ends.map((e) => e.people))).padStart(7),
          String(median(ends.map((e) => e.upgrades.length))).padStart(5),
          `${Math.round((runs.reduce((s, r) => s + r.hungryTurns, 0) / runs.reduce((s, r) => s + r.turns, 0)) * 100)}`.padStart(8),
          String(median(runs.map((r) => r.maxCoins))).padStart(11),
        ].join('  '),
      );
    }
  }
}
