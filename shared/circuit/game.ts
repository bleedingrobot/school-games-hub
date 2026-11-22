/**
 * Circuit Racer's game rules around the physics (docs/CIRCUIT-PLAN.md, sections 4, 5 and 8): which roads are open, the
 * 5 finished roads a day, medals and stars, and what the browser sends to save a finish. Pure: the `circuit` server
 * function, the screens and the preview's pretend server all use these.
 *
 * Nothing the browser says is trusted: the server replays the inputs (`judgeFinish`) and works out the time, medal and
 * battery star itself, and refuses a time faster than the real time since the run's seed was handed out.
 */
import { FULL, STEPS_PER_SECOND } from './config';
import { decodeLog } from './inputs';
import { replay, type RaceOptions } from './physics';
import { parseRoad, type Road, type RoadDef } from './road';
import { MOTHERBOARD_ROADS } from './roads/motherboard';

/** Finished roads a day (James, 22 Nov 2026). Only a finish uses one; crashes, restarts and quitting are free. */
export const FINISHES_A_DAY = 5;
/** Hub points for a finished road on a normal turn (an Unlimited day's extra finishes give none). */
export const FINISH_POINTS = 3;
/** And this many more the first time a road is finished with gold. */
export const GOLD_POINTS = 2;

/** Every road pupils can play, in the order they open (world 1 only until Stage 4). */
export const ROADS: readonly RoadDef[] = MOTHERBOARD_ROADS;

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

/** The road a road needs finished first (null for the first road). Roads open in order. */
export function roadBefore(id: string): string | null {
  const i = ROADS.findIndex((r) => r.id === id);
  return i > 0 ? ROADS[i - 1].id : null;
}

/**
 * Medal times in seconds, from the simulator's suggestions for the redrawn roads (`npm run circuit:sim`, 23 Nov 2026): gold is 10%
 * slower than the wild bot, silver 15% slower than the average bot, bronze is any finish. Stage 4 sets them for real.
 */
export const MEDAL_SECONDS: Record<string, { gold: number; silver: number }> = {
  'power-on': { gold: 19, silver: 25 },
  'clock-speed': { gold: 21, silver: 25 },
  'first-charge': { gold: 18, silver: 24 },
  'data-bus': { gold: 24, silver: 31 },
  'bridge-chips': { gold: 22, silver: 30 },
  'kernel-run': { gold: 32, silver: 44 },
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

/** Is a road open? The first is; each next one when the one before has been finished. */
export function roadOpen(roads: Record<string, RoadProgress>, id: string): boolean {
  const before = roadBefore(id);
  if (testRoads.some((r) => r.id === id)) return true;
  return ROADS.some((r) => r.id === id) && (before === null || (roads[before]?.finishes ?? 0) > 0);
}

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
}

export function parseFinish(input: unknown): FinishReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.road !== 'string' || !ROAD_ID.test(r.road)) return null;
  if (typeof r.seed !== 'string' || r.seed.length > 80 || typeof r.stamp !== 'string' || r.stamp.length > 200) return null;
  if (typeof r.inputs !== 'string' || r.inputs.length > MAX_INPUTS_TEXT) return null;
  const crashes = Number.isInteger(r.crashes) && (r.crashes as number) >= 0 ? Math.min(r.crashes as number, MAX_CRASHES) : 0;
  return { road: r.road, seed: r.seed, stamp: r.stamp, inputs: r.inputs, crashes };
}

/** A finish the server has replayed itself. */
export interface JudgedFinish {
  steps: number;
  medal: Medal;
  clean: boolean;
  charged: boolean;
  /** Battery left at the finish, 0 to 100. */
  battery: number;
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
  const end = replay(road, log, { refills: maths.refills ?? null, gateRight: maths.gateRight ?? null });
  if (end.outcome !== 'finished') return { ok: false, problem: 'no finish' };
  const made = seedTime(report.seed);
  if (made === null) return { ok: false, problem: 'not a server seed' };
  if (nowSeconds - made + 1 + REAL_TIME_SLACK_SECONDS < end.steps / STEPS_PER_SECOND) return { ok: false, problem: 'faster than real time' };
  return {
    ok: true,
    run: { steps: end.steps, medal: medalFor(report.road, end.steps), clean: report.crashes === 0, charged: end.battery > FULL / 2, battery: end.battery },
    choices: end.choices,
  };
}
