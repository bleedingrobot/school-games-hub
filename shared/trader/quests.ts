/**
 * Star Trader quests (docs/plans/trader-quests/PLAN.md, sections 2 and 3). One config entry per quest, in the order they
 * open, so more can be added later. The server is the boss: it works out each quest's planets from the school's galaxy,
 * checks every step and pays the reward. The browser runs the same rules only to show them.
 *
 * Planets are never a hand-written list: every school has its own galaxy, so each step says what kind of planet it wants
 * and `questPlanets` picks them from the galaxy in a set way. The same galaxy always gives the same planets, so a quest is
 * the same for every pupil in a school and they can help each other.
 */
import { GOODS, GOVERNMENTS, MEDICINE, SHIPS, WATER, GOOD_RULES } from './config';
import { seededRandom } from '../maths/serverQuestions';
import { chartPoint, coordText, distance, startPlanet, type Galaxy, type Planet } from './galaxy';
import { isBanned, marketFor, type MarketLine } from './market';
import { freeHolds, holdsOf, type Trader } from './state';
import { startFight, type Fight } from './fight';

/** Every stop is at most this far (fuel) from the one before, so any ship (the smallest tank is 13) does it in one jump. */
export const QUEST_MAX_LEG = 12;
/** Stops closer than this to the one before count against a set of planets (so a quest isn't three planets in a huddle). */
export const QUEST_SHORT_LEG = 5;
/** Hub points for a finished quest, inside the shared daily cap, as for a delivered contract (plan section 3 rule 11). */
export const QUEST_POINTS = 2;

/**
 * Commander Vex lends this laser for the quest's pirate fights, so even a Flea (no weapon slots) can fight. It is not a
 * real weapon: never in the shop or the hold, and it goes when the fight ends (plan section 3, rule 7).
 */
export const NAVY_LASER = { name: 'Navy laser', power: 25 } as const;

/** Government indexes (config.ts GOVERNMENTS), by name, so the rules below read plainly. */
const GOV = Object.fromEntries(GOVERNMENTS.map((g, i) => [g.name, i])) as Record<string, number>;
/** Resource indexes (config.ts RESOURCES). */
const RES = { minerals: 1, poorMinerals: 2, desert: 3, water: 4, animals: 5, lifeless: 6, poorSoil: 7, richSoil: 8, artistic: 9, warlike: 10, herbs: 12 } as const;

export type StepKind = 'pickup' | 'buy-deliver' | 'pirate' | 'clue' | 'deliver';

/** A test on a planet: the kind of planet a step wants. */
type Want = (p: Planet, g: Galaxy) => boolean;

export interface QuestStep {
  kind: StepKind;
  /** What the step is about, for screens: "Star-berries", "Beep", "a pirate ship", "Grandma Zuzu". */
  what: string;
  /**
   * How to choose its planet: tests in order of preference. A planet passing the first is best; one passing none is the
   * fallback (still allowed, so every galaxy gets a quest).
   */
  prefer: readonly Want[];
  /** Must be within QUEST_MAX_LEG of this step's planet too (Vex's pirates wait around the garden). */
  near?: number;
  /** buy-deliver: the good, how many, how many on a small ship, and what the giver pays for each. */
  good?: number;
  qty?: number;
  smallQty?: number;
  pays?: number;
  /** pickup: how many holds it fills (a daily job's crates). Missing: 1. */
  holds?: number;
  /** pickup: the name of one box in the hold, when it isn't `what` ("Games crate"). */
  cargo?: string;
}

export interface QuestConfig {
  id: string;
  title: string;
  giver: string;
  /** Credits paid on finishing. Dr Nettle's is worked out from what he pays for the goods (`questReward`). */
  reward: number;
  /** Steps must be done in the order listed (Lumi's trail). Otherwise any order, except the last, which waits for the rest. */
  ordered?: boolean;
  steps: readonly QuestStep[];
}

const isGov = (...names: string[]): Want => (p) => names.some((n) => p.government === GOV[n]);
const hasRes = (...res: number[]): Want => (p) => res.includes(p.resource);
const techAtLeast = (n: number): Want => (p) => p.tech >= n;
const techAtMost = (n: number): Want => (p) => p.tech <= n;
const calm: Want = (p) => GOVERNMENTS[p.government].pirates <= 2;
/** Can sell (make) a good. */
const makes = (good: number): Want => (p) => p.tech >= GOOD_RULES[good].makeTech;
const both = (...w: Want[]): Want => (p, g) => w.every((f) => f(p, g));

/** A ship with fewer holds than this gets Dr Nettle's smaller order. */
export const NETTLE_FULL_HOLDS = 15;

export const QUESTS: readonly QuestConfig[] = [
  {
    id: 'zuzu',
    title: "Grandma Zuzu's Big Party",
    giver: 'Grandma Zuzu',
    reward: 300,
    steps: [
      { kind: 'pickup', what: 'Star-berries', prefer: [isGov('Farming co-op'), hasRes(RES.richSoil), techAtMost(3)] },
      { kind: 'pickup', what: 'Sparkle Candles', prefer: [techAtLeast(7), techAtLeast(6), techAtLeast(5)] },
      { kind: 'pickup', what: 'a Robot Band', prefer: [isGov('Robot council'), makes(9), techAtLeast(5)] },
      { kind: 'deliver', what: 'Grandma Zuzu', prefer: [isGov('Temple', 'Peace garden'), calm] },
    ],
  },
  {
    id: 'sprocket',
    title: "Professor Sprocket's Runaway Robots",
    giver: 'Professor Sprocket',
    reward: 400,
    steps: [
      { kind: 'pickup', what: 'Beep', prefer: [hasRes(RES.desert), hasRes(RES.lifeless), hasRes(RES.poorSoil)] },
      { kind: 'pickup', what: 'Boop', prefer: [hasRes(RES.water), isGov('Peace garden')] },
      { kind: 'pickup', what: 'Clank', prefer: [hasRes(RES.minerals), hasRes(RES.poorMinerals), isGov('Merchant guild')] },
      { kind: 'pickup', what: 'Fizz', prefer: [hasRes(RES.warlike), both(makes(5), (p) => GOVERNMENTS[p.government].fireworksOk), (p) => GOVERNMENTS[p.government].fireworksOk] },
      { kind: 'deliver', what: 'Professor Sprocket', prefer: [isGov("Scientists' council"), techAtLeast(6), techAtLeast(4)] },
    ],
  },
  {
    id: 'nettle',
    title: 'Dr Nettle and the Sneezles',
    giver: 'Dr Nettle',
    reward: 0,
    steps: [
      // Bought at any market; their planet is Dr Nettle's, where they are handed over.
      { kind: 'buy-deliver', what: 'Medicine', good: MEDICINE, qty: 5, smallQty: 3, pays: 100, prefer: [], near: 2 },
      { kind: 'buy-deliver', what: 'Water', good: WATER, qty: 10, smallQty: 7, pays: 15, prefer: [], near: 2 },
      // A planet that can't make Medicine itself (that's the trouble), with a Medicine market within one jump.
      {
        kind: 'deliver',
        what: 'Dr Nettle',
        prefer: [both(isGov('Temple', 'Peace garden', 'Farming co-op'), techAtMost(3)), techAtMost(3), (p) => p.tech < GOOD_RULES[MEDICINE].makeTech + 1],
      },
    ],
  },
  {
    id: 'vex',
    title: 'Commander Vex and the Rust Raiders',
    giver: 'Commander Vex',
    reward: 600,
    steps: [
      { kind: 'pirate', what: 'a pirate ship', prefer: [isGov('Pirate haven'), (p) => GOVERNMENTS[p.government].pirates >= 5], near: 3 },
      { kind: 'pirate', what: 'a pirate ship', prefer: [isGov('Pirate haven'), (p) => GOVERNMENTS[p.government].pirates >= 5], near: 3 },
      { kind: 'pirate', what: 'a pirate ship', prefer: [isGov('Pirate haven'), (p) => GOVERNMENTS[p.government].pirates >= 5], near: 3 },
      // The peaceful garden planet the pirates are circling; you report to Commander Vex there.
      { kind: 'deliver', what: 'Commander Vex', prefer: [isGov('Peace garden'), isGov('Temple'), calm] },
    ],
  },
  {
    id: 'kai',
    title: 'Lumi the Little Star Whale',
    giver: 'Ranger Kai',
    reward: 800,
    ordered: true,
    steps: [
      { kind: 'clue', what: 'a clue', prefer: [] },
      { kind: 'clue', what: 'a clue', prefer: [] },
      { kind: 'clue', what: 'a clue', prefer: [] },
      { kind: 'deliver', what: "Lumi's family", prefer: [hasRes(RES.animals), hasRes(RES.water), hasRes(RES.artistic)] },
    ],
  },
];

export const questById = (id: string): QuestConfig | undefined => QUESTS.find((q) => q.id === id);

// ---------------------------------------------------------------------------------------------
// Choosing the planets
// ---------------------------------------------------------------------------------------------

/** A planet's rank for a step: 0 for its first wish, 1 for its second ..., `prefer.length` for none. */
function rank(step: QuestStep, p: Planet, g: Galaxy): number {
  const i = step.prefer.findIndex((w) => w(p, g));
  return i < 0 ? step.prefer.length : i;
}

/** Extra rules some steps have beyond their kind of planet. */
function allowed(quest: QuestConfig, i: number, p: Planet, g: Galaxy, chosen: readonly (number | undefined)[]): boolean {
  if (quest.id === 'nettle' && i === quest.steps.length - 1) {
    // Dr Nettle needs a Medicine market within one jump (and every planet sells Water).
    return g.planets.some((o) => o.id !== p.id && makes(MEDICINE)(o, g) && distance(o, p) <= QUEST_MAX_LEG);
  }
  const near = quest.steps[i].near;
  const anchor = near === undefined ? undefined : chosen[near];
  if (anchor !== undefined && distance(g.planets[anchor], p) > QUEST_MAX_LEG) return false;
  return true;
}

/**
 * The order the stops are visited in, as indexes into `steps`, and which steps have a planet of their own. Dr Nettle's
 * goods are bought anywhere and handed over at his planet; Vex's garden is picked first so the pirates can wait around it.
 */
function route(quest: QuestConfig): number[] {
  const own = quest.steps.map((s, i) => (s.kind === 'buy-deliver' ? -1 : i)).filter((i) => i >= 0);
  if (quest.steps.some((s) => s.near !== undefined && quest.steps[s.near].kind !== 'buy-deliver')) {
    const anchor = quest.steps.length - 1;
    return [anchor, ...own.filter((i) => i !== anchor)];
  }
  return own;
}

/** The legs a quest's stops make, in the order they are done (the steps listed, last delivery last). */
export function questLegs(galaxy: Galaxy, planets: readonly number[]): number[] {
  const stops = [...new Set(planets)];
  return stops.slice(1).map((id, i) => distance(galaxy.planets[stops[i]], galaxy.planets[id]));
}

/**
 * Picks one quest's planets: the best-scoring set (each step's rank, plus a little for short legs and for planets the
 * earlier quests or the start planet already use) where each stop is within `maxLeg` of the one before (and of its
 * `near` step) and no planet is used twice. A search with pruning, always in planet order, so it never varies.
 */
function pickFor(galaxy: Galaxy, quest: QuestConfig, used: ReadonlySet<number>, maxLeg: number): number[] | null {
  const order = route(quest);
  const n = quest.steps.length;
  const start = startPlanet(galaxy);
  const steps = quest.steps;
  // The order the steps are visited in for the leg rule: the listed order of the steps with planets of their own.
  const visit = steps.map((s, i) => (s.kind === 'buy-deliver' ? -1 : i)).filter((i) => i >= 0);
  const cost = (i: number, p: Planet): number => rank(steps[i], p, galaxy) * 10 + (used.has(p.id) ? 4 : 0) + (p.id === start ? 3 : 0);
  const candidates = order.map((i) =>
    galaxy.planets
      .map((p) => ({ p, c: cost(i, p) }))
      .sort((a, b) => a.c - b.c || a.p.id - b.p.id),
  );
  let best: (number | undefined)[] | null = null;
  let bestScore = Infinity;
  const chosen: (number | undefined)[] = new Array<number | undefined>(n).fill(undefined);
  let tries = 0;
  const legOk = (i: number, p: Planet): boolean => {
    // The stop before and after this one in visiting order, if already chosen.
    const at = visit.indexOf(i);
    for (const j of [visit[at - 1], visit[at + 1]]) {
      const other = j === undefined ? undefined : chosen[j];
      if (other !== undefined && distance(galaxy.planets[other], p) > maxLeg) return false;
    }
    return true;
  };
  const legPenalty = (i: number, p: Planet): number => {
    const at = visit.indexOf(i);
    let pen = 0;
    for (const j of [visit[at - 1], visit[at + 1]]) {
      const other = j === undefined ? undefined : chosen[j];
      if (other !== undefined && distance(galaxy.planets[other], p) < QUEST_SHORT_LEG) pen += 2;
    }
    return pen;
  };
  const search = (k: number, score: number): void => {
    if (++tries > 200_000 || score >= bestScore) return;
    if (k === order.length) {
      best = [...chosen];
      bestScore = score;
      return;
    }
    const i = order[k];
    for (const { p, c } of candidates[k]) {
      if (score + c >= bestScore) break;
      if (chosen.includes(p.id) || !legOk(i, p) || !allowed(quest, i, p, galaxy, chosen)) continue;
      chosen[i] = p.id;
      search(k + 1, score + c + legPenalty(i, p));
      chosen[i] = undefined;
    }
  };
  search(0, 0);
  const found: (number | undefined)[] | null = best;
  if (!found) return null;
  // Steps without a planet of their own (Dr Nettle's goods) are handed over at the delivery planet.
  return steps.map((s, i) => found[s.kind === 'buy-deliver' ? s.near ?? n - 1 : i] as number);
}

const picked = new WeakMap<Galaxy, number[][]>();

/**
 * Every quest's planets for a galaxy, in QUESTS order: one planet id per step. Worked out in a set way, so the same galaxy
 * always gives the same planets. Stops are kept within QUEST_MAX_LEG of each other; a galaxy too spread out for that (none
 * found in testing) is allowed a little more, up to the smallest fuel tank.
 */
export function questPlanets(galaxy: Galaxy): number[][] {
  const known = picked.get(galaxy);
  if (known) return known;
  const used = new Set<number>();
  const all = QUESTS.map((q) => {
    const set = pickFor(galaxy, q, used, QUEST_MAX_LEG) ?? pickFor(galaxy, q, used, 13) ?? pickFor(galaxy, q, used, 20);
    if (!set) throw new Error(`No planets for quest ${q.id}`);
    set.forEach((id) => used.add(id));
    return set;
  });
  picked.set(galaxy, all);
  return all;
}

// ---------------------------------------------------------------------------------------------
// The quest state kept in the saved game
// ---------------------------------------------------------------------------------------------

export interface QuestState {
  /** The quest taken now, or null. */
  open: string | null;
  /** Indexes of its steps done. */
  done: number[];
  /** Dr Nettle's smaller order (a ship under NETTLE_FULL_HOLDS holds when the quest was taken). */
  small?: boolean;
  /** Quests finished, in the order finished. */
  finished: string[];
  /** The NZ day the last quest was finished (null: none yet). At most one new quest opens a day. */
  lastDay: number | null;
  /** Today's delivery jobs (Q.6), once all five quests are finished this season. */
  jobs?: JobsToday;
}

export const emptyQuests = (): QuestState => ({ open: null, done: [], finished: [], lastDay: null });

/** The quest that can be taken next (null: all done, or the next one opens tomorrow, or one is open now). */
export function nextQuest(q: QuestState | undefined, day: number): QuestConfig | null {
  const s = q ?? emptyQuests();
  if (s.open) return null;
  const next = QUESTS.find((c) => !s.finished.includes(c.id));
  if (!next) return null;
  if (s.lastDay !== null && s.lastDay >= day) return null;
  return next;
}

/** How many of a buy-deliver step's goods are wanted on this attempt. */
export const stepQty = (step: QuestStep, small: boolean | undefined): number => (small ? step.smallQty ?? step.qty ?? 0 : step.qty ?? 0);

/** What a quest pays on finishing: its reward, or for Dr Nettle what he pays for the goods. */
export function questReward(quest: QuestConfig, small?: boolean): number {
  const goods = quest.steps.filter((s) => s.kind === 'buy-deliver');
  if (!goods.length) return quest.reward;
  return goods.reduce((sum, s) => sum + stepQty(s, small) * (s.pays ?? 0), 0);
}

/** Why a step can't be done right now, or null if it can. Shared by the server's moves and the screens. */
export function stepProblem(galaxy: Galaxy, t: Trader, q: QuestState | undefined, index: number): string | null {
  const open = openQuestOf(galaxy, q);
  if (!q || !open) return 'Take a quest first.';
  const { quest } = open;
  const step = quest.steps[index];
  if (!step) return 'That step could not be found.';
  if (q.done.includes(index)) return 'That step is done.';
  const last = quest.steps.length - 1;
  if (index === last && q.done.length < last) return 'Do the other steps first.';
  if (quest.ordered && quest.steps.some((_, i) => i < index && !q.done.includes(i))) return 'Do the steps in order.';
  const planet = galaxy.planets[open.planets[index]];
  if (t.location !== planet.id) return `Fly to ${planet.name} first.`;
  const holds = step.holds ?? 1;
  if (step.kind === 'pickup' && freeHolds(t) < holds) return `Make room: ${holds} free hold${holds === 1 ? '' : 's'} needed.`;
  if (step.kind === 'buy-deliver') {
    const want = stepQty(step, q.small);
    const have = t.cargo[step.good ?? 0] ?? 0;
    if (have < want) return `You need ${want} ${step.what} in your hold (you have ${have}).`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Commander Vex's pirates and Lumi's clues (Q.4)
// ---------------------------------------------------------------------------------------------

/** Vex's pirates: Scrappy pirates for the first two, a Raider for the third, never a Captain (PIRATE_TIERS indexes). */
export const questPirateTier = (step: number): number => (step >= 2 ? 1 : 0);

/** The open quest's pirate step waiting at the ship's planet, ready to fight (null: none). */
export function questFightHere(galaxy: Galaxy, t: Trader, q: QuestState | undefined): number | null {
  const quest = openQuestOf(galaxy, q)?.quest;
  if (!quest) return null;
  const i = quest.steps.findIndex((s, index) => s.kind === 'pirate' && stepProblem(galaxy, t, q, index) === null);
  return i < 0 ? null : i;
}

/** A quest fight against the pirate ship of step `step`, with Vex's Navy laser lent and a gentle loss. */
export const questFight = (t: Trader, step: number, seed: string): Fight => startFight(t, questPirateTier(step), seed, { lent: NAVY_LASER.power });

/**
 * Lumi's clue: the move on the star chart from one planet to another, "From here, go 3 right and 2 down." Only shown,
 * never marked or recorded; arriving at the right planet is what counts.
 */
export function trailClue(galaxy: Galaxy, from: number, to: number): { dx: number; dy: number; text: string } {
  const a = chartPoint(galaxy.planets[from]);
  const b = chartPoint(galaxy.planets[to]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const parts = [dx > 0 ? `${dx} right` : dx < 0 ? `${-dx} left` : '', dy > 0 ? `${dy} up` : dy < 0 ? `${-dy} down` : ''].filter(Boolean);
  const text = parts.length ? `From here, go ${parts.join(' and ')}.` : 'Lumi is right here!';
  return { dx, dy, text };
}

// ---------------------------------------------------------------------------------------------
// For the screens (Q.2)
// ---------------------------------------------------------------------------------------------

export interface StepView {
  index: number;
  kind: StepKind;
  what: string;
  done: boolean;
  /** Its planet (for Dr Nettle's goods: where they are handed over). */
  planet: number;
  name: string;
  /** On the chart pupils see (-10 to +10, y up), and as text "(3, −4)". */
  at: { x: number; y: number };
  coords: string;
  /** Fuel from where the ship is now (0: you're there). */
  fuel: number;
  /** The tank holds enough for that jump now. */
  fuelOk: boolean;
  /** buy-deliver: how many are wanted and how many are in the hold. */
  qty?: number;
  have?: number;
  /** Why it can't be done here and now, or null if it can. */
  problem: string | null;
}

/** The open quest's steps with their planets, coordinates and distances from the ship. Null if no quest is open. */
export function openQuestView(galaxy: Galaxy, t: Trader, q: QuestState | undefined): { quest: QuestConfig; reward: number; steps: StepView[] } | null {
  const open = openQuestOf(galaxy, q);
  if (!q || !open) return null;
  const { quest, planets } = open;
  const here = galaxy.planets[t.location];
  const steps = quest.steps.map((step, index): StepView => {
    const p = galaxy.planets[planets[index]];
    const fuel = distance(here, p);
    return {
      index,
      kind: step.kind,
      what: step.what,
      done: q.done.includes(index),
      planet: p.id,
      name: p.name,
      at: chartPoint(p),
      coords: coordText(p),
      fuel,
      fuelOk: fuel <= t.fuel,
      ...(step.kind === 'buy-deliver' ? { qty: stepQty(step, q.small), have: t.cargo[step.good ?? 0] ?? 0 } : {}),
      problem: q.done.includes(index) ? null : stepProblem(galaxy, t, q, index),
    };
  });
  return { quest, reward: questReward(quest, q.small), steps };
}

/** The nearest planets that sell a good today, with their price, nearest first (Dr Nettle's quest shows three). */
export function nearestSellers(galaxy: Galaxy, t: Trader, good: number, count = 3): { planet: number; name: string; fuel: number; price: number }[] {
  const here = galaxy.planets[t.location];
  return galaxy.planets
    .map((p) => ({ p, line: (p.id === t.location ? t.market : marketFor(galaxy, p.id, t.day))[good] }))
    .filter(({ line }) => line && line.buy > 0 && line.stock > 0)
    .map(({ p, line }) => ({ planet: p.id, name: p.name, fuel: distance(here, p), price: line.buy }))
    .sort((a, b) => a.fuel - b.fuel || a.planet - b.planet)
    .slice(0, count);
}

/** A ship small enough for Dr Nettle's smaller order. */
export const isSmallShip = (t: Trader): boolean => holdsOf(t) < NETTLE_FULL_HOLDS;

// ---------------------------------------------------------------------------------------------
// Daily delivery jobs, after all five quests (Q.6)
// ---------------------------------------------------------------------------------------------

/** A computer-made delivery: pick up `qty` crates of a good at `from`, take them to `to`, get `pay` credits. */
export interface Job {
  good: number;
  qty: number;
  from: number;
  to: number;
  pay: number;
}

/** Today's jobs: made on the server for one Star Trader day, kept in the saved game so a reload shows the same ones. */
export interface JobsToday {
  day: number;
  list: Job[];
  /** Indexes into `list` delivered today. */
  done: number[];
}

/** A job's id when it is the open "quest": job-0, job-1. */
export const jobId = (i: number): string => `job-${i}`;
/** The job index in an open id, or null for a story quest (or nothing). */
export function jobIndex(id: string | null | undefined): number | null {
  const m = id ? /^job-(\d)$/.exec(id) : null;
  return m ? Number(m[1]) : null;
}

/** All five story quests finished this season: daily jobs are on. */
export const allQuestsDone = (q: QuestState | undefined): boolean => !!q && QUESTS.every((c) => q.finished.includes(c.id));

/** A crate job pays what a normal trade of the same goods would make, plus this, plus JOB_BONUS_EACH a crate. */
export const JOB_BONUS = 10;
export const JOB_BONUS_EACH = 5;
/** Crates in a job: 2 to 5, never more than the ship's holds. */
export const JOB_MIN_QTY = 2;
export const JOB_MAX_QTY = 5;
/** The delivery is at least this far (fuel) from the pick-up, so it's a real trip. */
export const JOB_MIN_LEG = 4;

const roundUp5 = (n: number): number => Math.ceil(n / 5) * 5;

/**
 * Today's one or two jobs, made from a seed (school galaxy + pupil) and the day, so the same pupil always gets the same
 * jobs that day and the browser can't pick better ones. Short trips from where the ship is when they are made: the
 * pick-up is within one tank of fuel, the delivery `JOB_MIN_LEG` to two tanks further on (so 1 to 3 jumps in all). The
 * good is one the pick-up planet sells and the delivery planet buys, legal at both, and the pay is that trade's profit
 * plus a little.
 */
export function makeJobs(galaxy: Galaxy, seed: string, day: number, t: Trader): Job[] {
  const random = seededRandom(`trader-jobs:${seed}:${day}`);
  const tank = SHIPS[t.ship].fuelTank;
  const base = galaxy.planets[t.location];
  const markets = new Map<number, MarketLine[]>();
  const market = (id: number): MarketLine[] => {
    let m = markets.get(id);
    if (!m) markets.set(id, (m = marketFor(galaxy, id, day)));
    return m;
  };
  const options: { from: number; to: number; good: number; profit: number }[] = [];
  for (const from of galaxy.planets) {
    if (distance(base, from) > tank) continue;
    for (const to of galaxy.planets) {
      const leg = distance(from, to);
      if (to.id === from.id || leg < JOB_MIN_LEG || leg > 2 * tank) continue;
      for (let good = 0; good < GOODS.length; good++) {
        if (isBanned(from, good) || isBanned(to, good)) continue;
        const a = market(from.id)[good];
        const b = market(to.id)[good];
        if (!a || !b || a.buy <= 0 || b.sell <= 0) continue;
        const profit = b.sell - a.buy;
        if (profit > 0) options.push({ from: from.id, to: to.id, good, profit });
      }
    }
  }
  const count = random() < 0.5 ? 1 : 2;
  const holds = holdsOf(t);
  const jobs: Job[] = [];
  for (let k = 0; k < count && options.length; k++) {
    const left = options.filter((o) => !jobs.some((j) => j.good === o.good || (j.from === o.from && j.to === o.to)));
    if (!left.length) break;
    const o = left[Math.floor(random() * left.length)];
    const qty = Math.max(1, Math.min(holds, JOB_MIN_QTY + Math.floor(random() * (JOB_MAX_QTY - JOB_MIN_QTY + 1))));
    jobs.push({ good: o.good, qty, from: o.from, to: o.to, pay: roundUp5(qty * o.profit + JOB_BONUS + JOB_BONUS_EACH * qty) });
  }
  return jobs;
}

/** A job as a two-step quest (pick up, deliver), so it shares the quest steps, gold rings, Bolt's next stop and hold boxes. */
export function jobQuest(galaxy: Galaxy, job: Job, i: number): QuestConfig {
  const good = GOODS[job.good];
  const to = galaxy.planets[job.to]?.name ?? 'the planet';
  return {
    id: jobId(i),
    title: `Take ${job.qty} ${good} to ${to}`,
    giver: 'the Star Post',
    reward: job.pay,
    steps: [
      { kind: 'pickup', what: `${job.qty} crate${job.qty === 1 ? '' : 's'} of ${good}`, holds: job.qty, cargo: `${good} crate`, prefer: [] },
      { kind: 'deliver', what: to, prefer: [] },
    ],
  };
}

/** The quest open now (a story quest or today's job) and its step planets. Null when nothing is open. */
export function openQuestOf(galaxy: Galaxy, q: QuestState | undefined): { quest: QuestConfig; planets: number[]; job?: number } | null {
  if (!q?.open) return null;
  const ji = jobIndex(q.open);
  if (ji !== null) {
    const job = q.jobs?.list[ji];
    return job ? { quest: jobQuest(galaxy, job, ji), planets: [job.from, job.to], job: ji } : null;
  }
  const quest = questById(q.open);
  return quest ? { quest, planets: questPlanets(galaxy)[QUESTS.indexOf(quest)] } : null;
}

/**
 * The server's step at the start of each day (and after each move): once all five quests are done this season, make the
 * day's jobs if they aren't made yet. A job left undone goes at the end of the day, with its crates. Gives back the same
 * game when nothing changes. `seed` is the school's galaxy seed and the pupil.
 */
export function withJobs<G extends { t: Trader; quests?: QuestState }>(galaxy: Galaxy, game: G, seed: string): G {
  const q = game.quests;
  if (!q || !allQuestsDone(q) || q.jobs?.day === game.t.day) return game;
  const quests: QuestState = { ...q, jobs: { day: game.t.day, list: makeJobs(galaxy, seed, game.t.day, game.t), done: [] } };
  let t = game.t;
  if (jobIndex(q.open) !== null) {
    quests.open = null;
    quests.done = [];
    t = { ...t };
    delete t.questCargo;
  }
  return { ...game, quests, t };
}
