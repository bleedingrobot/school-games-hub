import { describe, expect, it } from 'vitest';
import { trainingGate } from './gate';

const HOUR = 3_600_000;
const now = Date.UTC(2026, 9, 22, 1, 0); // 2pm in New Zealand

describe('trainingGate', () => {
  it('locks a student who has not trained in the last 6 hours, and a clock set ahead buys no extra time', () => {
    expect(trainingGate({ on: false, lastFinishedAt: null, localFinishedAt: null, now })).toEqual({ locked: false, openUntil: null });
    expect(trainingGate({ on: true, lastFinishedAt: null, localFinishedAt: null, now }).locked).toBe(true);
    const at = (ago: number) => trainingGate({ on: true, lastFinishedAt: now - ago, localFinishedAt: null, now });
    expect(at(5 * HOUR + 59 * 60_000)).toEqual({ locked: false, openUntil: now + 60_000 });
    expect(at(6 * HOUR).locked).toBe(true);
    expect(trainingGate({ on: true, lastFinishedAt: null, localFinishedAt: now + 10 * HOUR, now }).openUntil).toBe(now + 6 * HOUR);
  });
});
