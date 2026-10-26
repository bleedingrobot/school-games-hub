import { describe, expect, it } from 'vitest';
import { SUBITISING_CONFIG } from '../subitising/config';
import { TRAINING_CONFIG } from './config';
import { clockTime, trainingGate } from './gate';

const HOUR = 3_600_000;
const now = Date.UTC(2026, 9, 22, 1, 0); // 2pm in New Zealand

describe('trainingGate', () => {
  it('never locks when the switch is off (or for a teacher)', () => {
    expect(trainingGate({ on: false, lastFinishedAt: null, localFinishedAt: null, now })).toEqual({ locked: false, openUntil: null });
  });

  it('locks a student who has never trained', () => {
    expect(trainingGate({ on: true, lastFinishedAt: null, localFinishedAt: null, now }).locked).toBe(true);
  });

  it('stays open for 2 hours after a session, then locks', () => {
    const at = (ago: number) => trainingGate({ on: true, lastFinishedAt: now - ago, localFinishedAt: null, now });
    expect(at(HOUR + 59 * 60_000)).toEqual({ locked: false, openUntil: now + 60_000 });
    expect(at(2 * HOUR).locked).toBe(true);
    expect(at(2 * HOUR + 60_000).locked).toBe(true);
  });

  it('uses the newer of the server and device times', () => {
    const g = trainingGate({ on: true, lastFinishedAt: now - 7 * HOUR, localFinishedAt: now - HOUR, now });
    expect(g).toEqual({ locked: false, openUntil: now + HOUR });
    expect(trainingGate({ on: true, lastFinishedAt: now - HOUR, localFinishedAt: now - 7 * HOUR, now }).openUntil).toBe(now + HOUR);
  });

  it("doesn't let a clock set ahead buy extra time", () => {
    expect(trainingGate({ on: true, lastFinishedAt: null, localFinishedAt: now + 10 * HOUR, now }).openUntil).toBe(now + 2 * HOUR);
  });

  it('a whole Quick looks round is what the server asks for', () => {
    expect(TRAINING_CONFIG.gate.minAnswers.quick).toBe(SUBITISING_CONFIG.sessionTrials);
  });
});

describe('clockTime', () => {
  it('shows New Zealand time', () => {
    expect(clockTime(now)).toBe('2:00 pm');
  });
});
