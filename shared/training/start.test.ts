import { describe, expect, it } from 'vitest';
import { NO_LADDER, type LadderInfo } from '../maths/place';
import { TRAINING_CONFIG } from './config';
import { needsPlacement, trainingPassedSteps } from './start';

const on = (more: Partial<LadderInfo>): LadderInfo => ({ ...NO_LADDER, on: true, ...more });

describe('where Training starts', () => {
  it('starts at the first step with no starting place, or one below the times tables', () => {
    expect(trainingPassedSteps(NO_LADDER)).toBe(0);
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'facts-20' }))).toBe(0);
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'tables-2-5-10' }))).toBe(0);
    expect(trainingPassedSteps(on({ placed: 'skipped' }))).toBe(0);
  });

  it('puts behind every times-table step below the starting place', () => {
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'bonds-100' }))).toBe(1);
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'tables-3-4-8' }))).toBe(1);
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'tables-6-9' }))).toBe(2);
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'bedmas' }))).toBe(TRAINING_CONFIG.tableFamilies.length);
  });

  it('uses the furthest place the games reached when that is further', () => {
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'facts-10', furthest: 'tables-7' }))).toBe(3);
    expect(trainingPassedSteps(on({ placed: 'done', placement: 'tables-7', furthest: 'facts-20' }))).toBe(3);
  });

  it('asks for the warm-up only when the class uses the ladder and it is not done, and never of a teacher', () => {
    expect(needsPlacement(on({}), 'student')).toBe(true);
    expect(needsPlacement(on({}), 'teacher')).toBe(false);
    expect(needsPlacement(on({ placed: 'skipped' }), 'student')).toBe(false);
    expect(needsPlacement(on({ placed: 'done', placement: 'facts-20' }), 'student')).toBe(false);
    expect(needsPlacement(NO_LADDER, 'student')).toBe(false);
  });
});
