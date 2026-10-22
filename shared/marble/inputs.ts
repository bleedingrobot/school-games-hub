/**
 * What the player did, step by step, stored as "same input for N steps".
 *
 * Codes: 0 none, 1–8 a direction on the grid (N, NE, E, SE, S, SW, W, NW; north is up the grid,
 * towards smaller y), 9 `HOLD` (the clock and the marble stand still: a question is showing, or
 * the student is reading a sign), 10 `REFUND` (a right rescue answer: the last fall's time
 * penalty is taken back), 11 `BONUS` (a right pit-stop answer: a few seconds come off the clock). HOLD, REFUND and
 * BONUS are how maths is added without touching the physics: the server only allows as many REFUND and BONUS
 * inputs as it has marked right answers for.
 */
export const NONE = 0;
export const HOLD = 9;
export const REFUND = 10;
export const BONUS = 11;
export const MAX_CODE = 11;

/** A run of inputs: [code, how many steps]. */
export type InputRuns = ReadonlyArray<readonly [number, number]>;

/** The most steps a replay will accept, so a server can't be made to work for ever. */
export const MAX_INPUT_STEPS = 60 * 60 * 6;

/** Adds one step to a list of runs, joining it to the last run when the input is the same. */
export function pushInput(runs: [number, number][], code: number): void {
  const last = runs[runs.length - 1];
  if (last && last[0] === code && code !== REFUND && code !== BONUS) last[1]++;
  else runs.push([code, 1]);
}

/** "2x1e,0xa" – short and safe to send (the code in hex, then the count in decimal). */
export function encodeInputs(runs: InputRuns): string {
  return runs.map(([code, n]) => `${code.toString(16)}x${n}`).join(',');
}

const RUN = /^([0-9ab])x([1-9]\d{0,5})$/;

/** Null if the text isn't a well-made list of runs. */
export function decodeInputs(text: string): [number, number][] | null {
  if (text === '') return [];
  const runs: [number, number][] = [];
  let total = 0;
  for (const part of text.split(',')) {
    const m = RUN.exec(part);
    if (!m) return null;
    const n = Number(m[2]);
    total += n;
    if (total > MAX_INPUT_STEPS) return null;
    runs.push([parseInt(m[1], 16), n]);
  }
  return runs;
}

export function totalSteps(runs: InputRuns): number {
  return runs.reduce((sum, [, n]) => sum + n, 0);
}

/** Plays a recorded list of runs back one step at a time (for a ghost). After the end it gives NONE for ever. */
export function inputPlayer(runs: InputRuns): () => number {
  let i = 0;
  let used = 0;
  return () => {
    while (i < runs.length && used >= runs[i][1]) {
      i++;
      used = 0;
    }
    if (i >= runs.length) return NONE;
    used++;
    return runs[i][0];
  };
}

/** How many steps of one input code a list of runs holds (e.g. how many REFUND inputs). */
export function countCode(runs: InputRuns, code: number): number {
  return runs.reduce((sum, [c, n]) => (c === code ? sum + n : sum), 0);
}
