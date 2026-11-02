// Plays whole Sky Isles seasons with the real rules (shared/isles/engine.ts), for tuning the numbers
// (docs/ISLES-PLAN.md, section 6.1; docs/ISLES-COSY-PLAN.md). Pretend pupils who play 5, 3 or 1 days a week, with three ways of playing and
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
writeFileSync(
  entryFile,
  `export * from './shared/isles/engine.ts';\nexport * from './shared/isles/race.ts';\nexport * from './shared/isles/nextStep.ts';\nexport * as config from './shared/isles/config.ts';\n`,
);
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

/** Tries a choice on the running island; keeps it only if the rules allow it. */
function tryAction(state, action) {
  if (k.problemWith(state.island, action)) return false;
  state.island = k.apply(state.island, action);
  state.actions.push(action);
  return true;
}

const nearlyFull = (island) => k.room(island) - island.islanders <= 4;

/** What to build on an empty spot, for a sensible pupil: a House when it's nearly full, a Workshop for every 6 spots
 * (crystals), a Dock for every 5 (boats), then whatever earns most. */
function wantedPlot(island) {
  if (nearlyFull(island) && k.count(island, 'house') < k.spotCount(island) / 4) return 'house';
  if (k.count(island, 'workshop') < Math.max(1, Math.floor(k.spotCount(island) / 6))) return 'workshop';
  if (k.count(island, 'dock') < Math.floor(k.spotCount(island) / 5)) return 'dock';
  return k.count(island, 'library') <= k.count(island, 'mine') ? 'library' : 'mine';
}

/** Which spot to raise a level next: the best coins for the price first (Workshops when crystals are short). */
function spotToRaise(island) {
  let best = -1;
  let bestValue = 0;
  island.spots.forEach((spot, i) => {
    const price = k.raisePrice(island, i);
    if (!price || price.crystals > island.crystals) return;
    const value = (spot.kind === 'workshop' ? 10 : C.COINS[spot.kind]) / price.coins;
    if (value > bestValue) [best, bestValue] = [i, value];
  });
  return best;
}

const averageLevel = (island) => island.spots.reduce((s, spot) => s + spot.level, 0) / island.spots.length;
const freePlace = (island) => {
  for (let p = 0; p < k.placeCount(island); p++) if (!island.decorations.some((d) => d.place === p)) return p;
  return -1;
};

/** The pupil's building for one turn, made on the island after collecting. */
function decide(island, style) {
  const state = { island, actions: [] };
  for (let guard = 0; guard < 40; guard++) {
    const empty = state.island.spots.findIndex((spot) => spot.kind === 'empty');
    if (empty >= 0) {
      if (!tryAction(state, { kind: 'build', spot: empty, plot: wantedPlot(state.island) })) break;
      continue;
    }
    if (k.isGrandIsle(state.island)) {
      if (tryAction(state, { kind: 'lighthouse' })) continue;
      // After the Lighthouse, or while saving crystals for it, coins go on raising buildings.
      const spot = spotToRaise(state.island);
      const stage = C.LIGHTHOUSE[state.island.lighthouse];
      if (spot >= 0 && (!stage || state.island.coins - k.raisePrice(state.island, spot).coins >= stage.coins)) {
        if (tryAction(state, { kind: 'raise', spot })) continue;
      }
      break;
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
    if (state.island.driftLeft > 0 && state.island.coins - price.coins < k.chunkPrice(state.island)) break;
    if (!tryAction(state, { kind: 'raise', spot })) break;
  }
  // Sail flags and the Welcome arch once they're easily afforded; after the Lighthouse, something pretty with spare coins.
  for (const id of ['flags', 'arch']) {
    const d = C.DECORATIONS.find((x) => x.id === id);
    if (state.island.coins > d.coins * 4 && freePlace(state.island) >= 0) tryAction(state, { kind: 'decorate', id, place: freePlace(state.island) });
  }
  if (state.island.lighthouse === C.LIGHTHOUSE.length) {
    for (const d of [...C.DECORATIONS].reverse()) {
      if (freePlace(state.island) < 0) break;
      if (state.island.coins > d.coins * 2) tryAction(state, { kind: 'decorate', id: d.id, place: freePlace(state.island) });
    }
  }
  return state.actions;
}

const PLAYERS = [
  { name: 'every day', days: [1, 1, 1, 1, 1, 0, 0] },
  { name: '3 days a week', days: [1, 0, 1, 0, 1, 0, 0] },
  { name: '1 day a week', days: [0, 0, 1, 0, 0, 0, 0] },
];
const STYLES = ['steady', 'balanced', 'grabber'];
const MATHS = [1, 0.7, 0];
const SEASON_DAYS = 35;

function season(player, style, right, seed) {
  const random = seeded(seed);
  let island = k.newIsland();
  let lastDay = 0;
  const out = { grandDay: null, lightDay: null, turns: 0, maxCoins: 0, end: null, races: 0, wins: 0 };
  for (let day = 0; day < SEASON_DAYS; day++) {
    if (!player.days[day % 7]) continue;
    if (day > 0) island = k.newDay(island, day - lastDay, 10);
    lastDay = day;
    // A lesson's play: up to 6 turns.
    for (let t = 0; t < C.TURNS_PER_DAY && island.turnsLeft > 0; t++) {
      const windy = random() < right;
      const { island: ready } = k.beforeBuilding(island, windy);
      const actions = decide(ready, style);
      const result = k.playTurn(island, windy, actions, random);
      if (!result.ok) throw new Error(`refused: ${result.problem} at ${result.at}`);
      island = result.island;
      out.turns++;
      out.maxCoins = Math.max(out.maxCoins, island.coins);
      // Races, from the season's second turn: against the Gull Riders whenever the rules allow (one a turn, two a day),
      // with each race question right as often as the turn questions. The first is turn 2's starter race, which can't
      // be lost.
      if (out.turns >= 2 && !k.raceProblem(island, k.GULL_RIDERS, 'me')) {
        const rightAnswers = Array.from({ length: C.RACE_QUESTIONS }, () => random() < right).filter(Boolean).length;
        const me = k.racerOf(island);
        const seedText = `sim-${seed}-${out.turns}`;
        const race = out.races === 0 ? k.starterRace(seedText, me, rightAnswers) : k.runRace(seedText, me, k.gullRiders(me), rightAnswers);
        island = k.settleRace(island, null, race).challenger;
        out.races++;
        if (race.won && out.races > 1) out.wins++;
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
console.log('pupil            style     maths  Grand Isle   %got  Lighthouse  %lit  spots  levels  islanders  decor  most coins  end coins  crystals  races won% (not counting the starter)');
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
          style.padEnd(9),
          `${Math.round(right * 100)}%`.padStart(5),
          week(median(grand)).padStart(11),
          `${Math.round((grand.length / RUNS) * 100)}`.padStart(5),
          week(median(lit)).padStart(11),
          `${Math.round((lit.length / RUNS) * 100)}`.padStart(5),
          String(median(ends.map((e) => k.spotCount(e)))).padStart(6),
          String(median(ends.map((e) => e.spots.reduce((s, spot) => s + spot.level, 0)))).padStart(7),
          String(median(ends.map((e) => e.islanders))).padStart(10),
          String(median(ends.map((e) => e.decorations.length))).padStart(5),
          String(median(runs.map((r) => r.maxCoins))).padStart(11),
          String(median(ends.map((e) => e.coins))).padStart(10),
          String(median(ends.map((e) => Math.floor(e.crystals)))).padStart(9),
          `${Math.round((runs.reduce((s, r) => s + r.wins, 0) / Math.max(1, runs.reduce((s, r) => s + r.races - 1, 0))) * 100)}`.padStart(10),
        ].join('  '),
      );
    }
  }
}
