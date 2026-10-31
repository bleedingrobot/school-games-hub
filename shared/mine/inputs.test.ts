import { describe, expect, it } from 'vitest';
import { TURN_MAX } from './config';
import {
  GRANT, HOLD, IDLE, MAX_CODE, MAX_PACKED, NO_INPUT, PENALTY, countCode, decodeInputs, encodeInputs, grantsIn, inputPlayer, isValidCode,
  packInput, pushInput, totalSteps, unpackInput, type PilotInput,
} from './inputs';

describe('packing a step', () => {
  it('round-trips every kind of input', () => {
    for (let tx = -1; tx <= 1; tx++)
      for (let tz = -1; tz <= 1; tz++)
        for (let yaw = -TURN_MAX; yaw <= TURN_MAX; yaw++)
          for (let pitch = -TURN_MAX; pitch <= TURN_MAX; pitch += 3)
            for (const roll of [-1, 0, 1])
              for (const fire of [false, true]) {
                const i: PilotInput = { tx, ty: (((yaw % 3) + 3) % 3) - 1, tz, yaw, pitch, roll, fire, missile: !fire };
                expect(unpackInput(packInput(i))).toEqual(i);
              }
  });

  it('keeps every packed number inside the allowed range, and trims anything out of range', () => {
    const big = packInput({ tx: 9, ty: -9, tz: 9, yaw: 99, pitch: -99, roll: 5, fire: true, missile: true });
    expect(big).toBeLessThanOrEqual(MAX_PACKED);
    expect(unpackInput(big)).toEqual({ tx: 1, ty: -1, tz: 1, yaw: TURN_MAX, pitch: -TURN_MAX, roll: 1, fire: true, missile: true });
    expect(IDLE).toBe(packInput(NO_INPUT));
    expect(unpackInput(IDLE)).toEqual(NO_INPUT);
  });

  it('knows which numbers are real steps', () => {
    expect(isValidCode(0)).toBe(true);
    expect(isValidCode(MAX_PACKED)).toBe(true);
    expect(isValidCode(MAX_PACKED + 1)).toBe(false);
    expect(isValidCode(HOLD)).toBe(true);
    expect(isValidCode(MAX_CODE)).toBe(true);
    expect(isValidCode(MAX_CODE + 1)).toBe(false);
    expect(isValidCode(-1)).toBe(false);
    expect(isValidCode(1.5)).toBe(false);
  });
});

describe('recorded runs', () => {
  it('join equal steps, but never join PENALTY or GRANT', () => {
    const runs: [number, number][] = [];
    for (const c of [IDLE, IDLE, IDLE, PENALTY, PENALTY, GRANT + 2, GRANT + 2, IDLE]) pushInput(runs, c);
    expect(runs).toEqual([[IDLE, 3], [PENALTY, 1], [PENALTY, 1], [GRANT + 2, 1], [GRANT + 2, 1], [IDLE, 1]]);
    expect(totalSteps(runs)).toBe(8);
    expect(countCode(runs, PENALTY)).toBe(2);
    expect(grantsIn(runs)).toEqual([2, 2]);
  });

  it('encode and decode', () => {
    const runs: [number, number][] = [[IDLE, 40], [packInput({ ...NO_INPUT, tz: 1, yaw: 3 }), 12], [PENALTY, 1], [GRANT + 5, 1]];
    const text = encodeInputs(runs);
    expect(decodeInputs(text)).toEqual(runs);
    expect(decodeInputs('')).toEqual([]);
  });

  it('refuses text that is not well made', () => {
    for (const bad of ['x', '1x0', '1x', 'zx1', '1x1,', `${(MAX_CODE + 1).toString(16)}x1`, '1x1000000', 'ffffffx1', '-1x1']) expect(decodeInputs(bad), bad).toBeNull();
    expect(decodeInputs('1x540000')).toBeNull(); // more steps than a replay accepts
  });

  it('plays back step by step, then idles for ever', () => {
    const next = inputPlayer([[5, 2], [7, 1]]);
    expect([next(), next(), next(), next(), next()]).toEqual([5, 5, 7, IDLE, IDLE]);
  });
});
