/**
 * The balance simulator (`npm run diamond:sim`): bot pupils of different skill and maths accuracy play a 35-day season
 * of Diamond Drop on 2, 3 to 4, or 5 school days a week, with the one-new-level-a-day rule, buying boosts and Workshop
 * upgrades. It reports how long the climb to the Heart Diamond takes, how many tries levels take, and the coin flow.
 */
import { BOOSTS, LAST_LEVEL, RARITY_PRICE, TICKS_PER_SECOND, levelSpec, type BoostId } from './config';
import { botLevel, type Skill } from './bot';
import { applyResult, boostPrice, levelsOpen, needsStarter, newPlayer, nzDate, takeBoosts, type Player } from './progress';
import { makeRandom, mixSeed, type Random } from './random';
import { BUYABLE, buy, priceOf, weekNumber } from './workshop';

export const SKILLS: Record<string, Omit<Skill, 'maths'>> = {
  good: { wobble: 2, choice: 1 },
  steady: { wobble: 4, choice: 3 },
  shaky: { wobble: 7, choice: 6 },
};
export const MATHS: Record<string, number> = { strong: 0.9, middling: 0.7, weak: 0.45 };

export interface SimOptions {
  pupils: number;
  /** School days a week (3.5 means 3 and 4 in turn). */
  daysPerWeek: number;
  skill: string;
  maths: string;
  /** Minutes of play in a lesson. */
  minutes?: number;
  seed?: number;
}

/** Seconds a lesson loses besides the level's own clock: answering a question, and the shop and results between levels. */
const SECONDS_PER_QUESTION = 10;
const SECONDS_BETWEEN_LEVELS = 15;
const SEASON_DAYS = 35;

export interface PupilRun {
  diamondDay: number | null;
  /** School days played by the time the diamond was found (or in all). */
  daysPlayed: number;
  /** School days played in the whole season. */
  daysInAll: number;
  deepest: number;
  /** Tries each new level took to pass (index = level − 1; 0 = not passed). */
  tries: number[];
  levelsPlayed: number;
  upgrades: number;
  legendary: boolean;
  coinsEarned: number;
  coinsOnBoosts: number;
  coinsOnUpgrades: number;
  coinsLeft: number;
  questions: number;
}

/** A Monday in November 2026; day n of the season is n days later, at midday in New Zealand. */
const dayDate = (n: number) => new Date(Date.UTC(2026, 10, 2 + n, 0));

function pickDays(rng: Random, perWeek: number, week: number): Set<number> {
  const n = Number.isInteger(perWeek) ? perWeek : week % 2 === 0 ? Math.floor(perWeek) : Math.ceil(perWeek);
  const days = [0, 1, 2, 3, 4];
  for (let i = days.length - 1; i > 0; i--) { const j = rng.int(i + 1); [days[i], days[j]] = [days[j], days[i]]; }
  return new Set(days.slice(0, n));
}

/** Which passed level to replay: one with a gem not in the Gem Book or under 3 stars, else the deepest (most coins). */
function replayChoice(p: Player): number {
  for (let l = 1; l <= p.deepest; l++) if (p.stars[l - 1] < 3) return l;
  return p.deepest;
}

/**
 * Spend coins in the Workshop like a pupil: pick an upgrade they like (savers want a Legendary first) and buy it as soon
 * as they can afford it, then pick the next.
 */
function shop(p: Player, now: Date, saver: boolean, run: PupilRun, rng: Random, wish: { id: string | null }): Player {
  const week = weekNumber(nzDate(now));
  for (;;) {
    const left = BUYABLE.filter((it) => !p.owned.includes(it.id));
    if (!left.length) return p;
    if (!wish.id || p.owned.includes(wish.id)) {
      const legends = left.filter((it) => it.rarity === 'legendary');
      const pool = saver && !run.legendary && legends.length ? legends : left;
      wish.id = pool[rng.int(pool.length)].id;
    }
    const item = left.find((it) => it.id === wish.id)!;
    const price = priceOf(item, week);
    if (p.coins < price) return p;
    p = buy(p, item.id, now)!;
    run.upgrades++;
    run.coinsOnUpgrades += price;
    if (item.rarity === 'legendary') run.legendary = true;
  }
}

export function simulatePupil(o: SimOptions, index: number): PupilRun {
  const rng = makeRandom(mixSeed(o.seed ?? 1, index));
  const skill: Skill = { ...SKILLS[o.skill], maths: MATHS[o.maths] };
  const saver = index % 2 === 1;
  const budget = (o.minutes ?? 12) * 60;
  let p = newPlayer();
  const run: PupilRun = {
    diamondDay: null, daysPlayed: 0, daysInAll: 0, deepest: 0, tries: Array(LAST_LEVEL).fill(0), levelsPlayed: 0, upgrades: 0,
    legendary: false, coinsEarned: 0, coinsOnBoosts: 0, coinsOnUpgrades: 0, coinsLeft: 0, questions: 0,
  };
  const triesNow = Array(LAST_LEVEL).fill(0);
  const wish = { id: null as string | null };
  let days = new Set<number>();
  for (let day = 0; day < SEASON_DAYS; day++) {
    const weekday = day % 7;
    if (weekday === 0) days = pickDays(rng, o.daysPerWeek, day / 7);
    if (weekday > 4 || !days.has(weekday)) continue;
    const now = dayDate(day);
    if (run.diamondDay === null) run.daysPlayed++;
    run.daysInAll++;
    let left = budget;
    while (left > 0) {
      const open = levelsOpen(p, now);
      const fresh = open.next !== null && open.nextOpen;
      if (!fresh && p.deepest === 0) break;
      const level = fresh ? open.next! : replayChoice(p);
      // Boosts after a failed try at a new level: Extra Time first, then a Strong Winch from level 4.
      const boosts: BoostId[] = p.freeBoost ? [p.freeBoost] : [];
      if (fresh && triesNow[level - 1] > 0) {
        for (const b of ['extraTime', 'strongWinch', 'luckyCharm'] as BoostId[]) {
          if (boosts.includes(b) || (b === 'strongWinch' && level < 4) || (b === 'luckyCharm' && triesNow[level - 1] < 2)) continue;
          if (takeBoosts(p, level, [...boosts, b]).ok) boosts.push(b);
        }
      }
      const paid = takeBoosts(p, level, boosts);
      if (!paid.ok) throw new Error('bot could not pay for its boosts');
      p = paid.player;
      run.coinsOnBoosts += paid.cost;
      const { result } = botLevel(level, rng.int(2 ** 31), boosts, skill, rng, needsStarter(p));
      const applied = applyResult(p, result, now);
      p = applied.player;
      run.coinsEarned += applied.coins;
      run.levelsPlayed++;
      run.questions += result.questions;
      if (fresh) {
        triesNow[level - 1]++;
        if (applied.newLevel) run.tries[level - 1] = triesNow[level - 1];
        if (applied.newLevel && level === LAST_LEVEL) run.diamondDay = day;
      }
      left -= result.endTick / TICKS_PER_SECOND + result.questions * SECONDS_PER_QUESTION + SECONDS_BETWEEN_LEVELS;
      p = shop(p, now, saver, run, rng, wish);
    }
  }
  run.deepest = p.deepest;
  run.coinsLeft = p.coins;
  return run;
}

export interface SimSummary {
  label: string;
  pupils: number;
  /** Share who caught the Heart Diamond. */
  found: number;
  /** Middle week (1 to 5) the diamond was found, among finders. */
  medianWeek: number | null;
  /** Middle school days played to reach it. */
  medianDays: number | null;
  meanDeepest: number;
  /** Share of new levels passed in 1 to 3 tries. */
  withinThree: number;
  meanTries: number[];
  levelsPerDay: number;
  upgrades: number;
  legendary: number;
  coinsEarned: number;
  coinsLeft: number;
  boostShare: number;
  questionsPerLevel: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function simulate(o: SimOptions): SimSummary {
  const runs = Array.from({ length: o.pupils }, (_, i) => simulatePupil(o, i));
  const finders = runs.filter((r) => r.diamondDay !== null);
  const tries = runs.flatMap((r) => r.tries.filter((t) => t > 0));
  const played = runs.reduce((a, r) => a + r.daysInAll, 0);
  return {
    label: `${o.skill}/${o.maths}/${o.daysPerWeek}d`,
    pupils: o.pupils,
    found: finders.length / runs.length,
    medianWeek: finders.length ? Math.floor(median(finders.map((r) => r.diamondDay!))! / 7) + 1 : null,
    medianDays: median(finders.map((r) => r.daysPlayed)),
    meanDeepest: mean(runs.map((r) => r.deepest)),
    withinThree: tries.length ? tries.filter((t) => t <= 3).length / tries.length : 0,
    meanTries: Array.from({ length: LAST_LEVEL }, (_, l) => mean(runs.map((r) => r.tries[l]).filter((t) => t > 0))),
    levelsPerDay: mean(runs.map((r) => r.levelsPlayed)) / Math.max(1, played / runs.length),
    upgrades: mean(runs.map((r) => r.upgrades)),
    legendary: runs.filter((r) => r.legendary).length / runs.length,
    coinsEarned: mean(runs.map((r) => r.coinsEarned)),
    coinsLeft: mean(runs.map((r) => r.coinsLeft)),
    boostShare: mean(runs.map((r) => r.coinsOnBoosts)) / Math.max(1, mean(runs.map((r) => r.coinsEarned))),
    questionsPerLevel: mean(runs.map((r) => r.questions / Math.max(1, r.levelsPlayed))),
  };
}

export interface LevelCheck {
  level: number;
  /** Share of single tries passed, by skill. */
  pass: Record<string, number>;
  /** Middle gem value banked by a steady bot, against the target. */
  medianBanked: number;
  target: number;
  /** Fields where even a good bot with strong maths failed every one of 3 tries (should be 0). */
  stuck: number;
}

/** One try at each level on many seeds, by each skill (middling maths): pass rates, for tuning targets and times. */
export function checkLevels(seeds: number, seed = 1): LevelCheck[] {
  const out: LevelCheck[] = [];
  for (let level = 1; level <= LAST_LEVEL; level++) {
    const pass: Record<string, number> = {};
    let banked: number[] = [];
    for (const name of Object.keys(SKILLS)) {
      let n = 0;
      for (let i = 0; i < seeds; i++) {
        const rng = makeRandom(mixSeed(seed, level * 100_000 + i));
        const { result } = botLevel(level, mixSeed(seed + 7, level * 1000 + i), [], { ...SKILLS[name], maths: MATHS.middling }, rng);
        if (result.passed) n++;
        if (name === 'steady') banked.push(result.banked);
      }
      pass[name] = n / seeds;
    }
    let stuck = 0;
    for (let i = 0; i < seeds; i++) {
      const fieldSeed = mixSeed(seed + 7, level * 1000 + i);
      let ok = false;
      for (let t = 0; t < 3 && !ok; t++) ok = botLevel(level, fieldSeed, [], { ...SKILLS.good, maths: MATHS.strong }, makeRandom(mixSeed(seed, i * 7 + t))).result.passed;
      if (!ok) stuck++;
    }
    out.push({ level, pass, medianBanked: median(banked) ?? 0, target: levelSpec(level).target, stuck });
    banked = [];
  }
  return out;
}

/** Boost prices on every level, for the rule sheet. */
export const boostTable = () => BOOSTS.map((b) => ({ name: b.name, prices: Array.from({ length: LAST_LEVEL }, (_, l) => boostPrice(b.id, l + 1)) }));
export const RARITIES = RARITY_PRICE;
