/**
 * Circuit Racer's game rules around the physics (docs/CIRCUIT-PLAN.md, sections 4, 5 and 8): which roads are open, the
 * 5 finished roads a day, medals and stars, and what the browser sends to save a finish. Pure: the `circuit` server
 * function, the screens and the preview's pretend server all use these.
 *
 * Nothing the browser says is trusted: the server replays the inputs (`judgeFinish`) and works out the time, medal and
 * battery star itself, and refuses a time faster than the real time since the run's seed was handed out.
 */
import { FULL, STEPS_PER_SECOND, type World } from './config';
import { decodeLog } from './inputs';
import { replay, type RaceOptions } from './physics';
import { parseRoad, type Road, type RoadDef } from './road';
import { CLOUD_ROADS } from './roads/cloud';
import { GRAPHICS_ROADS } from './roads/graphics';
import { MEMORY_ROADS } from './roads/memory';
import { MOTHERBOARD_ROADS } from './roads/motherboard';
import { QUANTUM_ROADS } from './roads/quantum';

/** Finished roads a day (James, 22 Nov 2026). Only a finish uses one; crashes, restarts and quitting are free. */
export const FINISHES_A_DAY = 5;
/** Hub points for a finished road on a normal turn (an Unlimited day's extra finishes give none). */
export const FINISH_POINTS = 3;
/** And this many more the first time a road is finished with gold. */
export const GOLD_POINTS = 2;

/** The five worlds inside the computer (docs/CIRCUIT-PLAN.md, section 3), 6 roads each. */
export const WORLDS: readonly { id: World; name: string; roads: readonly RoadDef[] }[] = [
  { id: 'motherboard', name: 'The Motherboard', roads: MOTHERBOARD_ROADS },
  { id: 'graphics', name: 'Graphics Card', roads: GRAPHICS_ROADS },
  { id: 'memory', name: 'Memory Lanes', roads: MEMORY_ROADS },
  { id: 'cloud', name: 'The Cloud', roads: CLOUD_ROADS },
  { id: 'quantum', name: 'Quantum Core', roads: QUANTUM_ROADS },
];

/** Every road pupils can play, world by world, in the order they open. */
export const ROADS: readonly RoadDef[] = WORLDS.flatMap((w) => w.roads);

/** A world opens when this many of the roads of the world before it are finished (James, 22 Nov 2026: "4 of 6"). */
export const WORLD_OPENS_AT = 4;

/** Roads only the preview and the tests add (`allowTestRoad`): open from the start, never in the live function. */
const testRoads: RoadDef[] = [];
export function allowTestRoad(def: RoadDef): void {
  if (!testRoads.some((r) => r.id === def.id)) testRoads.push(def);
}
export const extraRoads = (): readonly RoadDef[] => testRoads;

const parsed = new Map<string, Road>();
/** A road by id, read once. */
export function roadById(id: string): Road | undefined {
  const def = ROADS.find((r) => r.id === id) ?? testRoads.find((r) => r.id === id);
  if (!def) return undefined;
  let road = parsed.get(id);
  if (!road) parsed.set(id, (road = parseRoad(def)));
  return road;
}

/** Which world a road is in (0 to 4) and its number in it (0 to 5), or null. */
export function roadPlace(id: string): { world: number; index: number } | null {
  for (let world = 0; world < WORLDS.length; world++) {
    const index = WORLDS[world].roads.findIndex((r) => r.id === id);
    if (index >= 0) return { world, index };
  }
  return null;
}

/**
 * What a road needs finished first: `count` of `roads`. Inside a world, roads open in order (the road before); a world's
 * first road opens when WORLD_OPENS_AT of the world before's roads are finished, so one stuck road never blocks anyone.
 * Null for the very first road. The database checks the same (`record_circuit_finish`'s needs and need).
 */
export function roadNeeds(id: string): { roads: string[]; count: number } | null {
  const at = roadPlace(id);
  if (!at || (at.world === 0 && at.index === 0)) return null;
  if (at.index > 0) return { roads: [WORLDS[at.world].roads[at.index - 1].id], count: 1 };
  return { roads: WORLDS[at.world - 1].roads.map((r) => r.id), count: WORLD_OPENS_AT };
}

/**
 * Medal times in seconds for every road, from `npm run circuit:sim` (Stage 4, 23 Nov 2026): gold is 10% slower than the
 * wild bot, silver 15% slower than the average bot (and at least 3 s after gold), bronze is any finish. Re-run the
 * simulator and copy its MEDAL_SECONDS line here after changing a road.
 */
export const MEDAL_SECONDS: Record<string, { gold: number; silver: number }> = {
  'power-on': { gold: 19, silver: 25 },
  'clock-speed': { gold: 21, silver: 25 },
  'first-charge': { gold: 18, silver: 24 },
  'data-bus': { gold: 24, silver: 31 },
  'bridge-chips': { gold: 22, silver: 30 },
  'kernel-run': { gold: 32, silver: 44 },
  'hot-wire': { gold: 19, silver: 23 },
  'fan-alley': { gold: 21, silver: 25 },
  'pixel-pipeline': { gold: 24, silver: 30 },
  'render-farm': { gold: 22, silver: 29 },
  'shader-storm': { gold: 27, silver: 34 },
  'overclock-peak': { gold: 46, silver: 60 },
  'ram-stick': { gold: 17, silver: 23 },
  'cache-hit': { gold: 20, silver: 25 },
  'cold-storage': { gold: 20, silver: 27 },
  'tunnel-bus': { gold: 21, silver: 26 },
  'bit-flip': { gold: 26, silver: 34 },
  'stack-overflow': { gold: 44, silver: 60 },
  'upload': { gold: 16, silver: 21 },
  'sky-server': { gold: 21, silver: 24 },
  'cloud-hop': { gold: 18, silver: 22 },
  'stream-jump': { gold: 24, silver: 30 },
  'data-drift': { gold: 24, silver: 31 },
  'storm-cell': { gold: 45, silver: 57 },
  'qubit': { gold: 15, silver: 19 },
  'superposition': { gold: 15, silver: 19 },
  'entangled': { gold: 21, silver: 26 },
  'wave-bridge': { gold: 23, silver: 29 },
  'quantum-leap': { gold: 28, silver: 35 },
  'the-core': { gold: 50, silver: 61 },
};

export type Medal = 'bronze' | 'silver' | 'gold';
export const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };

export function medalFor(roadId: string, steps: number): Medal {
  const m = MEDAL_SECONDS[roadId];
  const seconds = steps / STEPS_PER_SECOND;
  if (m && seconds <= m.gold) return 'gold';
  if (m && seconds <= m.silver) return 'silver';
  return 'bronze';
}

/** A time as "23.4s". */
export const timeText = (steps: number): string => `${(steps / STEPS_PER_SECOND).toFixed(1)}s`;

/** Today's date in New Zealand, 'YYYY-MM-DD' (the day the 5 finishes count against). */
export const nzDay = (ms: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

/** Milliseconds until the next New Zealand midnight (for "See you tomorrow!"). */
export function msToNzMidnight(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Pacific/Auckland', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const into = (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000 + (ms % 1000);
  return Math.max(1000, 24 * 3600 * 1000 - into);
}

/** One road's saved progress for a pupil. */
export interface RoadProgress {
  /** Best time in steps (30 a second). */
  best: number;
  medal: Medal;
  /** Stars ever won on this road: finished with no crash, finished with the battery over half. */
  clean: boolean;
  charged: boolean;
  finishes: number;
  /** Hard mode (Stage 4): finishes and best time with Auto-Pilot off inside the count-down clock (🔥). Missing: none. */
  hardFinishes?: number;
  hardBest?: number | null;
}

/** What the server sends when the game opens. `left` is null on an Unlimited day. */
export interface CircuitSave {
  roads: Record<string, RoadProgress>;
  /** Finishes counted today (NZ day). */
  today: number;
  left: number | null;
  /** The teacher's maths switch ('choose': the pupil picks maths on or off for each go). Missing from an old reply: on. */
  maths?: 'off' | 'choose' | 'on';
}

/** Is a road open? See roadNeeds. */
export function roadOpen(roads: Record<string, RoadProgress>, id: string): boolean {
  if (testRoads.some((r) => r.id === id)) return true;
  if (!ROADS.some((r) => r.id === id)) return false;
  const needs = roadNeeds(id);
  return needs === null || needs.roads.filter((r) => (roads[r]?.finishes ?? 0) > 0).length >= needs.count;
}

/** Is a world open (its first road open)? */
export const worldOpen = (roads: Record<string, RoadProgress>, world: number): boolean => roadOpen(roads, WORLDS[world].roads[0].id);

/** Hard mode's count-down clock for a road, in seconds: this share of the silver time (no Auto-Pilot, crashes cost time). */
export const HARD_CLOCK_SHARE = 1.3;
export const hardSeconds = (roadId: string): number => Math.ceil((MEDAL_SECONDS[roadId]?.silver ?? 90) * HARD_CLOCK_SHARE);

export const finishesLeft = (today: number, unlimited: boolean): number | null => (unlimited ? null : Math.max(0, FINISHES_A_DAY - today));

// ——— Seeds and stamps (copied from Marble Rush: shared/marble/save.ts) ———

/** How long a seed can be used for: a road takes minutes, a forgotten tab hours. */
export const SEED_LIFETIME_SECONDS = 6 * 60 * 60;
/** Slack for the clock in the "not faster than real time" check (the seed's time is only to the second). */
export const REAL_TIME_SLACK_SECONDS = 3;
/** The longest inputs text a finish may carry. */
export const MAX_INPUTS_TEXT = 60_000;
/** Crashes before the finish (for the no-crash star) are counted up to this. */
export const MAX_CRASHES = 999;

const SEED_PATTERN = /^c1-(\d{10})-[0-9a-f]{24}$/;
const ROAD_ID = /^[a-z0-9-]{1,40}$/;

export const makeSeed = (nowSeconds: number, randomHex: string): string => `c1-${String(Math.floor(nowSeconds)).padStart(10, '0')}-${randomHex}`;

/** What the server signs: who, which road and the seed, so a stamp is no use for another pupil or road. */
export const stampText = (player: string, road: string, seed: string): string => `circuit-run:v1:${player}:${road}:${seed}`;

export function seedTime(seed: string): number | null {
  const m = SEED_PATTERN.exec(seed);
  return m ? Number(m[1]) : null;
}

/** Null if the seed is well made and still fresh, else what's wrong. */
export function seedProblem(seed: string, nowSeconds: number): string | null {
  const made = seedTime(seed);
  if (made === null) return 'not a server seed';
  if (nowSeconds - made < -300) return 'seed from the future';
  if (nowSeconds - made > SEED_LIFETIME_SECONDS) return 'seed too old';
  return null;
}

/** What the browser sends to save a finish. Nothing in it is trusted yet. */
export interface FinishReport {
  road: string;
  seed: string;
  stamp: string;
  /** The finishing go's inputs (`encodeLog`). */
  inputs: string;
  /**
   * Crashes since the road was opened, for the no-crash star only (it gives no points). The server can't see a crash that
   * isn't sent, but quitting and opening the road again is free anyway, so this is no easier to fake than a fresh start.
   */
  crashes: number;
  /** Hard mode: replayed with Auto-Pilot off and the count-down clock, and saved as a hard finish. */
  hard: boolean;
}

export function parseFinish(input: unknown): FinishReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.road !== 'string' || !ROAD_ID.test(r.road)) return null;
  if (typeof r.seed !== 'string' || r.seed.length > 80 || typeof r.stamp !== 'string' || r.stamp.length > 200) return null;
  if (typeof r.inputs !== 'string' || r.inputs.length > MAX_INPUTS_TEXT) return null;
  const crashes = Number.isInteger(r.crashes) && (r.crashes as number) >= 0 ? Math.min(r.crashes as number, MAX_CRASHES) : 0;
  return { road: r.road, seed: r.seed, stamp: r.stamp, inputs: r.inputs, crashes, hard: r.hard === true };
}

/** A finish the server has replayed itself. */
export interface JudgedFinish {
  steps: number;
  medal: Medal;
  clean: boolean;
  charged: boolean;
  /** Battery left at the finish, 0 to 100. */
  battery: number;
  /** Finished in hard mode (Auto-Pilot off, inside the clock). */
  hard: boolean;
}

/** `choices`: the lane the racer was in at each data gate's split row (-1: never crossed), read from the replay. */
export type Judgement = { ok: true; run: JudgedFinish; choices: readonly number[] } | { ok: false; problem: string };

/**
 * Replays the inputs from the start of the road. Only a real finish, no faster than real time, is accepted. `maths` is what
 * the server's marks say (each port's refill, each gate's right lane), so the replay's battery is the one the pupil earned.
 */
export function judgeFinish(report: FinishReport, nowSeconds: number, maths: RaceOptions = {}): Judgement {
  const road = roadById(report.road);
  if (!road) return { ok: false, problem: 'unknown road' };
  const log = decodeLog(report.inputs);
  if (!log) return { ok: false, problem: 'inputs not readable' };
  // Hard mode replays with Auto-Pilot off and the clock: past the clock is no finish at all.
  const end = replay(road, log, {
    refills: maths.refills ?? null, gateRight: maths.gateRight ?? null, autoPilot: !report.hard, timeLimit: report.hard ? hardSeconds(report.road) * STEPS_PER_SECOND : 0,
  });
  if (end.outcome !== 'finished') return { ok: false, problem: 'no finish' };
  const made = seedTime(report.seed);
  if (made === null) return { ok: false, problem: 'not a server seed' };
  if (nowSeconds - made + 1 + REAL_TIME_SLACK_SECONDS < end.steps / STEPS_PER_SECOND) return { ok: false, problem: 'faster than real time' };
  return {
    ok: true,
    run: { steps: end.steps, medal: medalFor(report.road, end.steps), clean: report.crashes === 0, charged: end.battery > FULL / 2, battery: end.battery, hard: report.hard },
    choices: end.choices,
  };
}
