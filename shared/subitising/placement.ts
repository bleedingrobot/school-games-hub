/**
 * The starting check: a few pictures, the first from the middle stages. Each right answer moves up
 * a stage and each wrong one moves down, and where it ends is where practice starts. The answers
 * are not kept as practice (they don't count towards finishing a stage).
 */
import { STAGES, SUBITISING_CONFIG, type StageNumber, type SubitisingConfig } from './config';
import { progressFrom } from './engine';
import { buildTrial, type Trial } from './trials';

export const PLACEMENT_FIRST_STAGE: StageNumber = 3;

const clamp = (n: number): StageNumber => Math.max(1, Math.min(STAGES.length, n)) as StageNumber;

/** The stage the check is at after these answers (right or wrong, oldest first). */
export function placementLevel(answers: readonly boolean[]): StageNumber {
  let level: number = PLACEMENT_FIRST_STAGE;
  for (const right of answers) level = clamp(level + (right ? 1 : -1));
  return level as StageNumber;
}

/** The next picture of the check: no review, no stepping back, just the stage it is at. */
export function placementTrial(answers: readonly boolean[], seed: number, config: SubitisingConfig = SUBITISING_CONFIG): Trial {
  const level = placementLevel(answers);
  const progress = progressFrom([], level, config);
  return buildTrial(progress, seed, answers.length, null, { ...config, reviewShare: 0 });
}

/** Where practice starts after a finished check. */
export const startStageFrom = (answers: readonly boolean[]): StageNumber => placementLevel(answers);
