/**
 * What the pilot did, one step at a time, stored as "same input for N steps" (docs/MINE-PLAN.md, section 4).
 *
 * A normal step is one whole number that packs everything the pilot can do at once: push in three
 * directions (−1, 0, +1 each), turn left/right and up/down (−TURN_MAX..TURN_MAX), roll (−1, 0, +1),
 * and the laser and missile buttons. Mouse movement is turned into whole numbers before it is
 * stored, so what is replayed is the number, never the mouse.
 *
 * Special codes (all at or above `SPECIAL_BASE`):
 * - HOLD: nothing moves and the clock stops (a question is showing).
 * - PENALTY: a wrong answer at a question door (shield and time are lost). The server only
 *   allows as many as it marked wrong.
 * - GRANT + n: a right answer for door or pad number n. The server only allows as many as it
 *   marked right, and the ship must be close enough.
 */
import { MAX_TARGETS, TURN_MAX } from './config';

export interface PilotInput {
  /** Slide right (+1) or left (−1). */
  tx: number;
  /** Rise (+1) or sink (−1). */
  ty: number;
  /** Forward (+1) or back (−1). */
  tz: number;
  /** Turn right (+) or left (−). */
  yaw: number;
  /** Look up (+) or down (−). */
  pitch: number;
  /** Roll right (+) or left (−). Ignored in steady flight. */
  roll: number;
  fire: boolean;
  missile: boolean;
}

const TURN_SPAN = TURN_MAX * 2 + 1;
export const SPECIAL_BASE = 1_000_000;
export const HOLD = SPECIAL_BASE;
export const PENALTY = SPECIAL_BASE + 1;
export const GRANT = SPECIAL_BASE + 2;
export const MAX_CODE = GRANT + MAX_TARGETS - 1;

export const NO_INPUT: PilotInput = { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0, roll: 0, fire: false, missile: false };

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}
function whole(n: number, lo: number, hi: number): number {
  return clamp(Math.round(n), lo, hi);
}

/** One whole number for a step. Anything out of range is trimmed to the nearest allowed value. */
export function packInput(i: PilotInput): number {
  let n = whole(i.tx, -1, 1) + 1;
  n = n * 3 + whole(i.ty, -1, 1) + 1;
  n = n * 3 + whole(i.tz, -1, 1) + 1;
  n = n * TURN_SPAN + whole(i.yaw, -TURN_MAX, TURN_MAX) + TURN_MAX;
  n = n * TURN_SPAN + whole(i.pitch, -TURN_MAX, TURN_MAX) + TURN_MAX;
  n = n * 3 + whole(i.roll, -1, 1) + 1;
  n = n * 4 + (i.fire ? 1 : 0) + (i.missile ? 2 : 0);
  return n;
}

export const IDLE = packInput(NO_INPUT);
/** The biggest packed number a normal step can be. */
export const MAX_PACKED = 27 * TURN_SPAN * TURN_SPAN * 3 * 4 - 1;

export function unpackInput(code: number): PilotInput {
  let n = code;
  const buttons = n % 4;
  n = (n - buttons) / 4;
  const roll = (n % 3) - 1;
  n = Math.floor(n / 3);
  const pitch = (n % TURN_SPAN) - TURN_MAX;
  n = Math.floor(n / TURN_SPAN);
  const yaw = (n % TURN_SPAN) - TURN_MAX;
  n = Math.floor(n / TURN_SPAN);
  const tz = (n % 3) - 1;
  n = Math.floor(n / 3);
  const ty = (n % 3) - 1;
  n = Math.floor(n / 3);
  const tx = (n % 3) - 1;
  return { tx, ty, tz, yaw, pitch, roll, fire: (buttons & 1) !== 0, missile: (buttons & 2) !== 0 };
}

export function isSpecial(code: number): boolean {
  return code >= SPECIAL_BASE;
}
export function isValidCode(code: number): boolean {
  return Number.isInteger(code) && code >= 0 && (code <= MAX_PACKED || (code >= SPECIAL_BASE && code <= MAX_CODE));
}

/** A run of inputs: [code, how many steps]. */
export type InputRuns = ReadonlyArray<readonly [number, number]>;

/** The most steps a replay will accept. */
export const MAX_INPUT_STEPS = 30 * 60 * 15;

/** Adds one step to a list of runs, joining it to the last run when the input is the same. PENALTY and GRANT never join. */
export function pushInput(runs: [number, number][], code: number): void {
  const last = runs[runs.length - 1];
  if (last && last[0] === code && code !== PENALTY && code < GRANT) last[1]++;
  else runs.push([code, 1]);
}

/** "1a2bx4,0x1e" – short and safe to send (the code in hex, then the count in decimal). */
export function encodeInputs(runs: InputRuns): string {
  return runs.map(([code, n]) => `${code.toString(16)}x${n}`).join(',');
}

const RUN = /^([0-9a-f]{1,6})x([1-9]\d{0,5})$/;

/** Null if the text isn't a well-made list of runs. */
export function decodeInputs(text: string): [number, number][] | null {
  if (text === '') return [];
  const runs: [number, number][] = [];
  let total = 0;
  for (const part of text.split(',')) {
    const m = RUN.exec(part);
    if (!m) return null;
    const code = parseInt(m[1], 16);
    const n = Number(m[2]);
    if (!isValidCode(code)) return null;
    total += n;
    if (total > MAX_INPUT_STEPS) return null;
    runs.push([code, n]);
  }
  return runs;
}

export function totalSteps(runs: InputRuns): number {
  return runs.reduce((sum, [, n]) => sum + n, 0);
}

/** Plays a recorded list of runs back one step at a time. After the end it gives IDLE for ever. */
export function inputPlayer(runs: InputRuns): () => number {
  let i = 0;
  let used = 0;
  return () => {
    while (i < runs.length && used >= runs[i][1]) {
      i++;
      used = 0;
    }
    if (i >= runs.length) return IDLE;
    used++;
    return runs[i][0];
  };
}

/** How many steps of one input code a list of runs holds (e.g. how many PENALTY inputs). */
export function countCode(runs: InputRuns, code: number): number {
  return runs.reduce((sum, [c, n]) => (c === code ? sum + n : sum), 0);
}

/** The numbers (door or pad numbers) of every GRANT in a list of runs, in order, once per use. */
export function grantsIn(runs: InputRuns): number[] {
  const out: number[] = [];
  for (const [c, n] of runs) if (c >= GRANT && c <= MAX_CODE) for (let k = 0; k < n; k++) out.push(c - GRANT);
  return out;
}
