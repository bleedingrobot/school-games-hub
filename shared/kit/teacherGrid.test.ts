import { describe, expect, it } from 'vitest';
import type { FactStats } from '../maths/leitner';
import { ideaLevel, stuckFlags, type FlagInput, type FlagRules } from './teacherGrid';

const fact = (key: string, box: number, attempts = 1, correct = 1): FactStats => ({ key, attempts, correct, avgMs: 1000, box, lastSeen: 0, quickDays: [] });
const keys = Array.from({ length: 10 }, (_, i) => `k${i}`);

describe('teacher grid kit', () => {
  it('names an idea by the skill map rule: 70% of facts past box 1 is Secure, 70% in the top box is Fluent', () => {
    expect(ideaLevel([], []).level).toBe('off');
    expect(ideaLevel(keys, []).level).toBe('not-started');
    const at = (n: number, box: number) => keys.slice(0, n).map((k) => fact(k, box));
    expect(ideaLevel(keys, at(6, 2)).level).toBe('learning');
    expect(ideaLevel(keys, at(7, 2)).level).toBe('secure');
    expect(ideaLevel(keys, at(7, 4)).level).toBe('fluent');
  });

  it('raises each flag at its threshold and not below, and quiet is grey', () => {
    const rules: FlagRules = { sameLevelDays: 3, manyWrongTaps: 5, guessInWindow: 2, guessWindow: 4, lowAccuracyAttempts: 8, lowAccuracyShare: 0.6, recentAnswers: 20, recentShare: 0.6, quietChallenges: 3, quietSchoolDays: 10 };
    const days = ['2026-11-02', '2026-11-03', '2026-11-04'];
    const pupil = (n: number, wrong: number, correct: number): FlagInput => ({
      tracks: [{ id: 'g', label: 'Game', level: 2, levelLabel: 'Two', top: false, daysDone: 3, lastDay: '2026-11-04', challenges: days.slice(0, n).map((day) => ({ day, wrong, level: 2 })) }],
      ideas: [{ id: 'i', label: 'Idea', track: 'g', score: { level: 'learning', attempts: 10, correct } }],
      recents: [],
      today: '2026-11-05',
    });
    expect(stuckFlags(pupil(2, 0, 9), rules)).toEqual([]);
    expect(stuckFlags(pupil(3, 0, 9), rules).map((f) => f.kind)).toEqual(['same-level']);
    expect(stuckFlags(pupil(3, 5, 5), rules).map((f) => f.kind)).toEqual(['same-level', 'guessing', 'low-accuracy']);
    const gone = stuckFlags({ ...pupil(1, 0, 9), today: '2026-11-18' }, rules).find((f) => f.kind === 'quiet');
    expect(gone?.quiet).toBe(true);
    expect(gone?.reason).toBe('Not played for 10 school days');
  });
});
