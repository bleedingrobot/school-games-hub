/**
 * Saving a Marble Rush run (stage M.4).
 *
 * Before a run the server hands out a seed with a stamp (a signature only the server can make).
 * When the student finishes, the browser sends the seed, the stamp, the course, the mode and the
 * recorded inputs. The server never takes the time from the browser: it replays the inputs itself
 * (`judgeRun`), needs a finish, and refuses a time that is faster than the real time since the
 * seed was handed out. The stamp says the seed came from the server for this student, course and
 * mode; the seed can only be saved once (the database keeps it).
 */
import { courseById } from './courses';
import { replay, type ClockMode } from './engine';
import { decodeInputs, MAX_INPUT_STEPS } from './inputs';

/** How long a seed can be used for. A run takes minutes; a forgotten tab, hours. */
export const MARBLE_SEED_LIFETIME_SECONDS = 6 * 60 * 60;
/** Runs a student can save in a day (a very keen student does a few hundred). */
export const MARBLE_RUNS_PER_DAY = 400;
/** The longest inputs text a save may carry (the database keeps the same limit). */
export const MAX_INPUTS_TEXT = 60000;
/**
 * A run cannot be saved faster than it takes to play: the real time since the seed was handed
 * out must be at least the physics steps played (at 60 a second), less this much slack for the
 * clock (the seed's time is only to the second, and a device's clock steps may run a touch fast).
 */
export const MIN_REAL_TIME_SLACK_SECONDS = 3;

const SEED_PATTERN = /^m1-(\d{10})-[0-9a-f]{24}$/;
const COURSE_ID = /^[a-z0-9-]{1,40}$/;

/** A new seed: when it was made and 12 random bytes. */
export function makeMarbleSeed(nowSeconds: number, randomHex: string): string {
  return `m1-${String(Math.floor(nowSeconds)).padStart(10, '0')}-${randomHex}`;
}

/** What the server signs: who, which course and mode, and the seed, so a stamp is no use for another run. */
export function marbleStampText(player: string, course: string, mode: ClockMode, seed: string): string {
  return `marble-run:v1:${player}:${course}:${mode}:${seed}`;
}

/** When the seed was handed out (seconds since 1970), or null if it isn't a server seed. */
export function marbleSeedTime(seed: string): number | null {
  const match = SEED_PATTERN.exec(seed);
  return match ? Number(match[1]) : null;
}

/** Null if the seed is well made and still fresh, else what's wrong. */
export function marbleSeedProblem(seed: string, nowSeconds: number): string | null {
  const made = marbleSeedTime(seed);
  if (made === null) return 'not a server seed';
  const age = nowSeconds - made;
  if (age < -300) return 'seed from the future';
  if (age > MARBLE_SEED_LIFETIME_SECONDS) return 'seed too old';
  return null;
}

/** What the browser sends to save a run. */
export interface MarbleRunReport {
  seed: string;
  stamp: string;
  course: string;
  mode: ClockMode;
  inputs: string;
}

/** Null if it isn't shaped like a report. (Nothing about it is trusted yet.) */
export function parseMarbleReport(input: unknown): MarbleRunReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.seed !== 'string' || typeof r.stamp !== 'string' || typeof r.course !== 'string') return null;
  if (r.mode !== 'up' && r.mode !== 'down') return null;
  if (typeof r.inputs !== 'string' || r.inputs.length > MAX_INPUTS_TEXT) return null;
  if (r.seed.length > 80 || r.stamp.length > 200 || !COURSE_ID.test(r.course)) return null;
  return { seed: r.seed, stamp: r.stamp, course: r.course, mode: r.mode, inputs: r.inputs };
}

/** A run the server has replayed itself. */
export interface JudgedRun {
  steps: number;
  falls: number;
  checkpoints: number;
  held: number;
  /** Physics steps played, which is at least how long the run took in real time (held steps are not counted). */
  played: number;
}

export type RunJudgement = { ok: true; run: JudgedRun } | { ok: false; problem: string };

/**
 * Replays the recorded inputs and checks the run. `nowSeconds` and the seed's time give the real
 * time that has passed since the seed was handed out.
 */
export function judgeRun(report: MarbleRunReport, nowSeconds: number): RunJudgement {
  const course = courseById(report.course);
  if (!course) return { ok: false, problem: 'unknown course' };
  const runs = decodeInputs(report.inputs);
  if (!runs) return { ok: false, problem: 'inputs not readable' };
  const result = replay(course, runs, { mode: report.mode });
  if (!result) return { ok: false, problem: 'inputs not readable' };
  if (result.outcome !== 'finished' || result.finishSteps <= 0) return { ok: false, problem: 'no finish' };
  const made = marbleSeedTime(report.seed);
  if (made === null) return { ok: false, problem: 'not a server seed' };
  // Held steps (a question showing) stop the clock but real time keeps going, so only played steps are a lower bound.
  const realSeconds = nowSeconds - made + 1;
  if (realSeconds + MIN_REAL_TIME_SLACK_SECONDS < result.steps / 60) return { ok: false, problem: 'faster than real time' };
  if (result.steps + result.held > MAX_INPUT_STEPS) return { ok: false, problem: 'too long' };
  return {
    ok: true,
    run: { steps: result.finishSteps, falls: result.falls, checkpoints: result.checkpoints, held: result.held, played: result.steps },
  };
}
