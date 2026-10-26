// Archery Challenge's bot simulator (docs/ARCHERY-PLAN.md, sections 6 and 12): bots against bots in
// every world, how long rounds take, rounds that hit the shot cap, lands with no hurting shot, and timing.
// Run from the project folder: node scripts/archery-sim.mjs [fightsPerPairing]   (default 120)
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';

const FIGHTS = Number(process.argv[2]) > 0 ? Math.floor(Number(process.argv[2])) : 120;
/** `--balance` runs only the balance section (quick tuning). */
const ONLY_BALANCE = process.argv.includes('--balance');
const LANDS_PER_WORLD = 150;

// ——— Bundle shared/archery for Node ———
const dir = mkdtempSync(join(tmpdir(), 'archery-sim-'));
const src = join(process.cwd(), 'shared/archery');
const entry = join(dir, 'entry.ts');
writeFileSync(
  entry,
  [
    `export * from ${JSON.stringify(join(src, 'bot.ts'))};`,
    `export * from ${JSON.stringify(join(src, 'fight.ts'))};`,
    `export * from ${JSON.stringify(join(src, 'land.ts'))};`,
    `export * from ${JSON.stringify(join(src, 'config.ts'))};`,
    `export * from ${JSON.stringify(join(src, 'types.ts'))};`,
    `export { mixSeed } from ${JSON.stringify(join(src, 'random.ts'))};`,
    `export { flyArrow } from ${JSON.stringify(join(src, 'shot.ts'))};`,
    `export { ARROWS } from ${JSON.stringify(join(src, 'arrows.ts'))};`,
  ].join('\n'),
);
const bundle = await rolldown({ input: entry, logLevel: 'silent' });
await bundle.write({ file: join(dir, 'sim.mjs'), format: 'esm' });
await bundle.close();
const A = await import(pathToFileURL(join(dir, 'sim.mjs')).href);
rmSync(dir, { recursive: true, force: true });

const { BOT_KITS, botSetup, chooseForRun, chooseBotShot, startFight, takeShot, playFight, playShot, flyArrow, copyLand, mixSeed, WORLD_IDS, MAX_SHOTS_PER_ROUND, BOT_MAX_SIMS, ARROWS } = A;

const PAIRS = [['easy', 'easy'], ['easy', 'medium'], ['easy', 'hard'], ['medium', 'medium'], ['medium', 'hard'], ['hard', 'hard']];
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(0).padStart(3) + '%' : '  - ');
const stats = (xs) => {
  if (!xs.length) return { mean: 0, median: 0, p90: 0 };
  const s = [...xs].sort((a, b) => a - b);
  return { mean: s.reduce((a, b) => a + b, 0) / s.length, median: s[Math.floor(s.length / 2)], p90: s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] };
};
const copyRound = (r) => ({ ...r, land: copyLand(r.land), archers: [{ ...r.archers[0] }, { ...r.archers[1] }] });

let turnMs = 0, turns = 0, maxSims = 0, deliberate = 0, specialShots = 0;
let replayMs = 0, replayTurns = 0;
const roundLands = Object.fromEntries(WORLD_IDS.map((w) => [w, []])); // {round copy, shots, capped}
const roundCount = Object.fromEntries(WORLD_IDS.map((w) => [w, 0]));
// About 2.4 rounds a fight, 6 pairings: spread the sampled lands over all of them.
const LAND_STRIDE = Math.max(1, Math.floor((PAIRS.length * FIGHTS * 2.4) / LANDS_PER_WORLD));

/** Plays one fight between two bot levels (levels[0] is player 0, the left archer). */
function playOne(seed, world, levels) {
  const setup = { world, players: [botSetup(levels[0]), botSetup(levels[1])] };
  const run = startFight(seed, setup);
  const shots = [];
  const rounds = [];
  let start = copyRound(run.round);
  while (run.winner === null) {
    const p = run.round.turn;
    const t0 = performance.now();
    const c = chooseForRun(run, levels[p]);
    turnMs += performance.now() - t0;
    turns++;
    if (c.sims > maxSims) maxSims = c.sims;
    if (c.deliberateMiss) deliberate++;
    if (c.shot.arrow !== 'plain') specialShots++;
    // Now and then, check the full replay path gives the same shot, and time it.
    if (shots.length % 15 === 7) {
      const r0 = performance.now();
      const again = chooseBotShot({ seed, setup, shots, level: levels[p] });
      replayMs += performance.now() - r0;
      replayTurns++;
      if (JSON.stringify(again) !== JSON.stringify(c.shot)) throw new Error('replayed bot shot differs');
    }
    const taken = takeShot(run, c.shot);
    if (taken.problem) throw new Error(`bot shot refused: ${taken.problem}`);
    shots.push(c.shot);
    if (taken.ended) {
      const capped = taken.ended.shots >= MAX_SHOTS_PER_ROUND && !taken.ended.archers[0].popped && !taken.ended.archers[1].popped;
      rounds.push({ shots: taken.ended.shots, capped });
      // Every few rounds (spread over all the pairings), keep its starting land for the check below.
      if (roundCount[world]++ % LAND_STRIDE === 0 && roundLands[world].length < LANDS_PER_WORLD) roundLands[world].push({ round: start, shots: taken.ended.shots, capped, levels });
      if (run.winner === null) start = copyRound(run.round);
    }
  }
  const check = playFight(seed, setup, shots);
  if (check.winner !== run.winner) throw new Error('replay disagrees');
  return { winner: run.winner, rounds };
}

// ——— Bots against bots ———
if (!ONLY_BALANCE) {
const t0 = performance.now();
const results = {}; // [world][pair] = {wins:[a,b], draws, roundShots:[], capped}
for (const [wi, world] of WORLD_IDS.entries()) {
  results[world] = {};
  for (const [pi, pair] of PAIRS.entries()) {
    const r = { wins: [0, 0], draws: 0, roundShots: [], capped: 0, rounds: 0 };
    for (let i = 0; i < FIGHTS; i++) {
      const swap = i % 2 === 1;
      const levels = swap ? [pair[1], pair[0]] : [pair[0], pair[1]];
      const seed = mixSeed(20261021, wi * 1_000_000 + pi * 10_000 + i);
      const f = playOne(seed, world, levels);
      if (f.winner === 'draw') r.draws++;
      else r.wins[swap ? 1 - f.winner : f.winner]++;
      for (const rd of f.rounds) {
        r.roundShots.push(rd.shots);
        r.rounds++;
        if (rd.capped) r.capped++;
      }
    }
    results[world][pair.join('-')] = r;
  }
}
const simSecs = (performance.now() - t0) / 1000;

console.log(`Archery bots: ${FIGHTS} fights per pairing per world (seats swapped half the time), ${simSecs.toFixed(1)} s\n`);
console.log('Win rates (first level wins / second level wins / draws):');
const header = 'pairing        ' + WORLD_IDS.map((w) => w.padEnd(20)).join('') + 'overall';
console.log(header);
for (const pair of PAIRS) {
  const key = pair.join('-');
  let tot = [0, 0, 0];
  const cells = WORLD_IDS.map((w) => {
    const r = results[w][key];
    const n = r.wins[0] + r.wins[1] + r.draws;
    tot = [tot[0] + r.wins[0], tot[1] + r.wins[1], tot[2] + r.draws];
    return `${pct(r.wins[0], n)} ${pct(r.wins[1], n)} ${pct(r.draws, n)}`.padEnd(20);
  });
  const n = tot[0] + tot[1] + tot[2];
  console.log(key.padEnd(15) + cells.join('') + `${pct(tot[0], n)} ${pct(tot[1], n)} ${pct(tot[2], n)}`);
}

console.log('\nShots per round (mean / median / 90th percentile), and rounds that hit the 60-shot cap:');
console.log('pairing        ' + WORLD_IDS.map((w) => w.padEnd(24)).join('') + 'overall');
let allCapped = 0, allRounds = 0;
for (const pair of PAIRS) {
  const key = pair.join('-');
  const every = [];
  let capped = 0;
  const cells = WORLD_IDS.map((w) => {
    const r = results[w][key];
    every.push(...r.roundShots);
    capped += r.capped;
    allRounds += r.rounds;
    const s = stats(r.roundShots);
    return `${s.mean.toFixed(1)}/${s.median}/${s.p90} cap ${r.capped}/${r.rounds}`.padEnd(24);
  });
  allCapped += capped;
  const s = stats(every);
  console.log(key.padEnd(15) + cells.join('') + `${s.mean.toFixed(1)}/${s.median}/${s.p90} cap ${capped}/${every.length}`);
}
console.log(`All capped rounds: ${allCapped} of ${allRounds}`);

// ——— Lands with no shot that can hurt the other archer at the start ———
/** Can `shooter` hurt the other archer with any Plain shot (angle and power in steps of `step`)? */
function canHurt(round, shooter, step) {
  const target = round.archers[1 - shooter];
  const dir = target.x > round.archers[shooter].x ? 1 : -1;
  // Likely angles first (towards the target), then the rest, so it usually stops early.
  const angles = [];
  for (let a = 20; a <= 85; a += step) angles.push(dir > 0 ? a : 180 - a);
  for (let a = 0; a <= 180; a += step) if (!angles.includes(a)) angles.push(a);
  for (const angle of angles) {
    for (let power = 0; power <= 100; power += step) {
      const shot = { angle, power, arrow: 'plain' };
      const f = flyArrow(round.land, round.archers, shooter, shot, round.wind);
      const dx = f.hit.x - target.x, dy = f.hit.y - (target.y - 12);
      if (dx * dx + dy * dy > 76 * 76) continue; // too far to hurt (blast 24 px, plus a fall)
      const copy = copyRound(round);
      if (playShot(copy, shooter, shot).damage[1 - shooter] > 0) return true;
    }
  }
  return false;
}

console.log(`\nLands with no Plain shot that can hurt the other archer at the start (up to ${LANDS_PER_WORLD} round lands per world, spread over the fights above, with each round's own wind, every 2° and 2 power):`);
const l0 = performance.now();
for (const world of WORLD_IDS) {
  const lands = roundLands[world];
  let noLeft = 0, noEither = 0;
  const stuck = [];
  for (const L of lands) {
    if (canHurt(L.round, 0, 2)) continue;
    noLeft++;
    const right = canHurt(L.round, 1, 2);
    if (!right) noEither++;
    stuck.push(L);
  }
  const capOf = (xs) => xs.filter((L) => L.capped).length;
  const meanShots = (xs) => (xs.length ? (xs.reduce((a, L) => a + L.shots, 0) / xs.length).toFixed(1) : '-');
  console.log(`  ${world.padEnd(7)} left archer can't hurt: ${noLeft}/${lands.length}; neither can: ${noEither}/${lands.length}. ` +
    `Those rounds: ${capOf(stuck)}/${stuck.length} capped, ${meanShots(stuck)} shots on average ` +
    `(all ${lands.length} sampled rounds: ${capOf(lands)} capped, ${meanShots(lands)} shots).`);
}
console.log(`  (checked in ${((performance.now() - l0) / 1000).toFixed(1)} s)`);

console.log(`\nTiming: ${(turnMs / turns).toFixed(2)} ms per bot turn (thinking on a running fight, ${turns} turns); ` +
  `${(replayMs / replayTurns).toFixed(2)} ms per turn including the replay of the fight so far (${replayTurns} sampled turns, all matched).`);
console.log(`Most trial flights in one turn: ${maxSims} (limit ${BOT_MAX_SIMS}). Deliberate misses: ${pct(deliberate, turns)} of shots. Special arrows shot: ${specialShots}.`);
}

// ——— Balance (docs/ARCHERY-PLAN.md, section 2): gear helps, but good aim can still win ———
/** Plays one fight with custom setups and bot overrides; returns the winner (0, 1 or 'draw'). */
function playCustom(seed, world, levels, setups, overrides) {
  const setup = { world, players: setups };
  const run = startFight(seed, setup);
  while (run.winner === null) {
    const p = run.round.turn;
    const c = chooseForRun(run, levels[p], overrides[p]);
    const taken = takeShot(run, c.shot);
    if (taken.problem) throw new Error(`balance: shot refused: ${taken.problem}`);
  }
  return run.winner;
}
function versus(label, levels, setups, overrides, n = Math.max(40, Math.floor(FIGHTS / 2))) {
  const wins = [0, 0];
  let draws = 0;
  for (const [wi, world] of WORLD_IDS.entries()) {
    for (let i = 0; i < n; i++) {
      const swap = i % 2 === 1;
      const L = swap ? [levels[1], levels[0]] : levels;
      const S = swap ? [setups[1], setups[0]] : setups;
      const O = swap ? [overrides[1], overrides[0]] : overrides;
      const w = playCustom(mixSeed(31337, wi * 100000 + i), world, L, S, O);
      if (w === 'draw') draws++;
      else wins[swap ? 1 - w : w]++;
    }
  }
  const tot = wins[0] + wins[1] + draws;
  console.log(`  ${label.padEnd(64)} ${pct(wins[0], tot)} ${pct(wins[1], tot)} ${pct(draws, tot)}`);
  return wins[0] / tot;
}
const b0 = performance.now();
console.log('\nBalance (first side wins / second side wins / draws, all four worlds):');
const plainOnly = { quiver: {}, shield: null };
const richKit = { giant: 5, firework: 5, rain: 5, steel: 5 };
const rich = { quiver: { ...richKit }, shield: 'bubble', bow: 'golden' };
versus('Hard, Plain Arrows only  v  Medium with a rich bag + Bubble + Golden', ['hard', 'medium'], [plainOnly, rich], [{ kit: {} }, { kit: richKit }]);
versus('Medium, Plain Arrows only  v  Medium with a rich bag + Bubble + Golden', ['medium', 'medium'], [plainOnly, rich], [{ kit: {} }, { kit: richKit }]);
for (const shield of ['wood', 'charm', 'bubble']) {
  versus(`Medium + ${shield} shield  v  Medium, no shield`, ['medium', 'medium'], [{ quiver: {}, shield }, plainOnly], [{ kit: {} }, { kit: {} }]);
}
console.log('\n  Each arrow: Medium shooting it on every aimed shot (5 of them) v Medium with Plain only:');
for (const a of ARROWS) {
  if (a.id === 'plain' || a.id === 'bolt') continue;
  const kit = { [a.id]: 5 };
  versus(`${a.name}`, ['medium', 'medium'], [{ quiver: { ...kit }, shield: null }, plainOnly], [{ kit, specials: [a.id], always: true }, { kit: {} }], 30);
}
console.log(`  (balance checked in ${((performance.now() - b0) / 1000).toFixed(1)} s)`);
