/**
 * Saving a Mine Runner run (docs/MINE-PLAN.md, section 8).
 *
 * Before a run the server hands out a seed with a stamp (a signature only the server can make). When the pupil finishes,
 * the browser sends the seed, the stamp, the level, the flight mode, whether the run had maths, and the recorded inputs.
 * The server never takes the time from the browser: it replays the inputs itself (`judgeRun`), needs the exit reached,
 * refuses a time faster than the real time since the seed was handed out, and tells the caller which doors and pads were
 * opened by an answer and how many wrong-answer penalties were charged, so it can check them against the answers it
 * marked. The seed can only be saved once (the database keeps it).
 */
import { MAX_RUN_STEPS, REACTOR_LOCK_ANSWERS, STEPS_PER_SECOND } from './config';
import { decodeInputs, MAX_INPUT_STEPS } from './inputs';
import { makeLevel, reactorTargetId, recipeById } from './level';
import { makeWorld, replay } from './engine';

/** How long a seed can be used for. A mine takes minutes; a forgotten tab, hours. */
export const MINE_SEED_LIFETIME_SECONDS = 6 * 60 * 60;
/** Counted runs a pupil can save in a day (James, 20 Oct 2026). */
export const MINE_RUNS_PER_DAY = 20;
/** The longest inputs text a save may carry (the database keeps the same limit). A 15-minute worst case is about 190 KB. */
export const MAX_INPUTS_TEXT = 200_000;
/**
 * A run cannot be saved faster than it takes to play: the real time since the seed was handed out must be at least the
 * steps played (at 30 a second), less this much slack for the clock (the seed's time is only to the second).
 */
export const MIN_REAL_TIME_SLACK_SECONDS = 3;

export type FlightMode = 'steady' | 'free';

const SEED_PATTERN = /^n1-(\d{10})-[0-9a-f]{24}$/;
const LEVEL_ID = /^l[1-6](:hard)?$/;

/** A new seed: when it was made and 12 random bytes. */
export function makeMineSeed(nowSeconds: number, randomHex: string): string {
  return `n1-${String(Math.floor(nowSeconds)).padStart(10, '0')}-${randomHex}`;
}

/** What the server signs: who, which level, flight mode and maths, and the seed, so a stamp is no use for another run. */
export function mineStampText(player: string, level: string, mode: FlightMode, maths: boolean, seed: string): string {
  return `mine-run:v1:${player}:${level}:${mode}:${maths ? 'maths' : 'plain'}:${seed}`;
}

/** When the seed was handed out (seconds since 1970), or null if it isn't a server seed. */
export function mineSeedTime(seed: string): number | null {
  const match = SEED_PATTERN.exec(seed);
  return match ? Number(match[1]) : null;
}

/** Null if the seed is well made and still fresh, else what's wrong. */
export function mineSeedProblem(seed: string, nowSeconds: number): string | null {
  const made = mineSeedTime(seed);
  if (made === null) return 'not a server seed';
  const age = nowSeconds - made;
  if (age < -300) return 'seed from the future';
  if (age > MINE_SEED_LIFETIME_SECONDS) return 'seed too old';
  return null;
}

/** A level the real game has (the six mines, and each in hard mode). Not the practice mine. */
export const isCountedLevel = (id: unknown): id is string => typeof id === 'string' && LEVEL_ID.test(id) && recipeById(id) !== undefined;

/** What the browser sends to save a run. */
export interface MineRunReport {
  seed: string;
  stamp: string;
  level: string;
  mode: FlightMode;
  maths: boolean;
  inputs: string;
}

/** Null if it isn't shaped like a report. (Nothing about it is trusted yet.) */
export function parseMineReport(input: unknown): MineRunReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.seed !== 'string' || typeof r.stamp !== 'string' || !isCountedLevel(r.level)) return null;
  if (r.mode !== 'steady' && r.mode !== 'free') return null;
  if (typeof r.maths !== 'boolean') return null;
  if (typeof r.inputs !== 'string' || r.inputs.length > MAX_INPUTS_TEXT) return null;
  if (r.seed.length > 80 || r.stamp.length > 200) return null;
  return { seed: r.seed, stamp: r.stamp, level: r.level, mode: r.mode, maths: r.maths, inputs: r.inputs };
}

/** A run the server has replayed itself. */
export interface JudgedRun {
  /** The clock at the finish, in steps (30 a second), as the server worked it out. */
  steps: number;
  /** Steps played (the clock stops while a question shows). At least how long the run took in real time. */
  played: number;
  held: number;
  deaths: number;
  /** `GRANT` numbers for every right answer the run used: one for each question door opened, one for each of a pad's answers, one for each of the reactor's. */
  grants: number[];
  /** Wrong-answer penalties charged at question doors and the reactor's console. */
  penalties: number;
}

export type RunJudgement = { ok: true; run: JudgedRun } | { ok: false; problem: string };

/**
 * Replays the recorded inputs and checks the run. `nowSeconds` and the seed's time give the real time that has passed
 * since the seed was handed out. Does not look at the answers: the caller checks `grants` and `penalties` against the
 * list of answers it marked.
 */
export function judgeRun(report: MineRunReport, nowSeconds: number): RunJudgement {
  const recipe = recipeById(report.level);
  if (!recipe) return { ok: false, problem: 'unknown level' };
  const runs = decodeInputs(report.inputs);
  if (!runs) return { ok: false, problem: 'inputs not readable' };
  const world = makeWorld(makeLevel(recipe), { steady: report.mode === 'steady', maths: report.maths });
  const state = replay(world, runs);
  if (state.outcome !== 'finished' || state.finishSteps <= 0) return { ok: false, problem: 'no finish' };
  if (state.badGrants > 0) return { ok: false, problem: 'a door or pad opened that was not earned' };
  const made = mineSeedTime(report.seed);
  if (made === null) return { ok: false, problem: 'not a server seed' };
  // Held steps (a question showing) stop the clock but real time goes on, so only played steps are a lower bound.
  const realSeconds = nowSeconds - made + 1;
  if (realSeconds + MIN_REAL_TIME_SLACK_SECONDS < state.steps / STEPS_PER_SECOND) return { ok: false, problem: 'faster than real time' };
  if (state.steps + state.held > MAX_INPUT_STEPS || state.steps > MAX_RUN_STEPS) return { ok: false, problem: 'too long' };
  const grants: number[] = [];
  world.level.doors.forEach((door) => {
    if (door.kind === 'question' && state.doorsOpen[door.id] === 1 && world.maths) grants.push(door.id);
  });
  world.level.pads.forEach((pad, n) => {
    for (let k = 0; k < state.padsUsed[n]; k++) grants.push(pad.id);
  });
  if (world.maths) for (let k = state.reactorLock; k < REACTOR_LOCK_ANSWERS; k++) grants.push(reactorTargetId(world.level));
  return {
    ok: true,
    run: { steps: state.finishSteps, played: state.steps, held: state.held, deaths: state.deaths, grants, penalties: state.wrongAnswers },
  };
}
