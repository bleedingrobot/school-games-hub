/**
 * What the player pressed, recorded by distance along the road (an idea from OpenRoads' demo replays).
 *
 * Each step's input is one code: steer (-1 left, 0, 1 right), speed (-1 brake, 0, 1 accelerate) and jump.
 * A run is stored as the changes only: [slot, wait, code] means "when the racer is in distance slot `slot`
 * (SLOTS_PER_ROW slots a row) and has been there `wait` steps, start pressing `code`". The racer never goes
 * backwards, so (slot, wait) is different at every step and the server can replay the exact same run.
 * Pauses (a pit-stop question in Stage 3) don't move the racer, so they never need recording.
 */
import { MAX_INPUT_CHANGES } from './config';

export interface Input {
  turn: -1 | 0 | 1;
  accel: -1 | 0 | 1;
  jump: boolean;
}

/** One change of input: [slot, steps already spent in that slot, code]. */
export type InputChange = readonly [number, number, number];
export type InputLog = readonly InputChange[];

export const MAX_CODE = 17;

export function inputCode(i: Input): number {
  return i.turn + 1 + 3 * (i.accel + 1) + (i.jump ? 9 : 0);
}

export function decodeInput(code: number): Input {
  return { turn: ((code % 3) - 1) as Input['turn'], accel: ((Math.floor(code / 3) % 3) - 1) as Input['accel'], jump: code >= 9 };
}

/** Nothing pressed: every run starts with this. */
export const NEUTRAL = inputCode({ turn: 0, accel: 0, jump: false });

interface Where {
  slot: number;
  slotSteps: number;
}

/** Records a run: call `record` with the state just before each step and that step's input code. */
export function makeRecorder(): { record: (s: Where, code: number) => void; log: InputChange[] } {
  const log: InputChange[] = [];
  let current = NEUTRAL;
  return {
    log,
    record(s, code) {
      if (code === current) return;
      current = code;
      log.push([s.slot, s.slotSteps, code]);
    },
  };
}

/** Plays a log back: give it the state before each step, it gives that step's input code. */
export function inputPlayer(log: InputLog): (s: Where) => number {
  let i = 0;
  let current = NEUTRAL;
  return (s) => {
    while (i < log.length && (log[i][0] < s.slot || (log[i][0] === s.slot && log[i][1] <= s.slotSteps))) current = log[i++][2];
    return current;
  };
}

/** "12.0.5,40.3.13": short and safe to send. */
export function encodeLog(log: InputLog): string {
  return log.map(([slot, wait, code]) => `${slot}.${wait}.${code}`).join(',');
}

const CHANGE = /^(\d{1,6})\.(\d{1,5})\.(\d{1,2})$/;

/** Null if the text isn't a well-made log (in order, codes in range, not too long). */
export function decodeLog(text: string): InputChange[] | null {
  if (text === '') return [];
  const parts = text.split(',');
  if (parts.length > MAX_INPUT_CHANGES) return null;
  const log: InputChange[] = [];
  for (const part of parts) {
    const m = CHANGE.exec(part);
    if (!m) return null;
    const change = [Number(m[1]), Number(m[2]), Number(m[3])] as const;
    const last = log[log.length - 1];
    if (change[2] > MAX_CODE) return null;
    if (last && (change[0] < last[0] || (change[0] === last[0] && change[1] <= last[1]))) return null;
    log.push(change);
  }
  return log;
}
