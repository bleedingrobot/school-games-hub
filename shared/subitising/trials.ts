/**
 * Builds one picture to practise. Same seed, same progress and same index always make the same
 * picture, so a test (or a teacher preview) can make it again.
 */
import { FRAME_CAPACITY, STAGES, SUBITISING_CONFIG, stageOf, type PictureType, type StageNumber, type SubitisingConfig } from './config';
import { flashMs, type Progress } from './engine';
import { gapKey, subKey, type Activity } from './keys';
import { makeGapPicture, makePicture, type Picture, type Random } from './patterns';
import { seeded } from '../seededRandom';

export interface Trial {
  activity: Activity;
  stage: StageNumber;
  type: PictureType;
  n: number;
  key: string;
  picture: Picture;
  /** The whole number the student should give. */
  answer: number;
  /** How long the picture shows (milliseconds). */
  flashMs: number;
  /** The answer buttons, in order, smallest first. */
  choices: number[];
  /** True when this picture comes from a finished stage (review). */
  review: boolean;
}

/** A random-number maker that isn't dull in its first few numbers. */
export function rngFor(seed: number): Random {
  const rng = seeded(Math.abs(Math.floor(seed)) % 2147483647 || 1);
  for (let i = 0; i < 5; i++) rng();
  return rng;
}

const pick = <T,>(rng: Random, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

/**
 * `count` buttons in a row of whole numbers, always holding the answer and kept within `lo` to `hi`
 * where it can. Where the run starts is picked at random among the valid starts, so the answer's
 * place in the row varies. A range narrower than `count` is widened on both sides (never below 1), so
 * stage 1 shows 1 to 5 and stage 2 (4 or 5) shows a row from 1-5 up to 3-7.
 */
export function choicesFor(answer: number, lo: number, hi: number, count: number, rng: Random): number[] {
  // A range narrower than the row is widened by the shortfall on both sides, so the answer can sit in different places.
  const extra = count - (hi - lo + 1);
  if (extra > 0) {
    lo = Math.max(1, lo - extra);
    hi += extra;
  }
  const top = Math.max(hi, lo + count - 1);
  const first = Math.max(lo, answer - count + 1);
  const last = Math.min(answer, top - count + 1);
  // An answer outside the range has no valid start: end the run on it.
  const start = last < first ? Math.max(1, answer - count + 1) : first + Math.floor(rng() * (last - first + 1));
  return Array.from({ length: count }, (_, i) => start + i);
}

/** Which stage and picture type to use, and whether it's review. */
function chooseSource(progress: Progress, index: number, last: { key: string } | null, rng: Random, config: SubitisingConfig): { stage: StageNumber; type: PictureType; review: boolean } {
  const finished = progress.stages.filter((s) => s.finished && s.id !== progress.current).map((s) => s.id);
  const review = finished.length > 0 && index > 0 && rng() < config.reviewShare;
  const stage = review ? pick(rng, finished) : progress.current;
  const types = stageOf(stage).types;
  if (progress.stepBack && !review) return { stage, type: types[0], review };
  // Practise the types least seen lately, so none is left out.
  const seen = progress.stages[stage - 1].seen;
  const fewest = Math.min(...types.map((t) => seen[t] ?? 0));
  const pool = types.filter((t) => (seen[t] ?? 0) === fewest);
  const lastType = last ? last.key.split(':')[1]?.split('-')[0] : null;
  const fresh = pool.filter((t) => t !== lastType);
  return { stage, type: pick(rng, fresh.length ? fresh : pool), review };
}

/** Builds picture number `index` of a session. `last` is the previous trial, so a picture doesn't come twice in a row. */
export function buildTrial(progress: Progress, seed: number, index: number, last: { key: string } | null = null, config: SubitisingConfig = SUBITISING_CONFIG): Trial {
  const rng = rngFor(seed * 31 + index * 7919);
  for (let attempt = 0; attempt < 6; attempt++) {
    const { stage, type, review } = chooseSource(progress, index + attempt, last, rng, config);
    const def = stageOf(stage);
    const frameType = FRAME_CAPACITY[type] !== undefined;
    const gap = def.gaps && frameType && rng() < 1 / config.gapEvery;
    // Stepping back makes the numbers smaller, never bigger than the stage's lower half.
    const hi = progress.stepBack && !review ? Math.max(def.min, Math.ceil((def.min + def.max) / 2)) : def.max;
    const n = typeRange(type, def.min, hi, gap, rng);
    const key = gap ? gapKey(type, n) : subKey(type, n);
    if (last && last.key === key && attempt < 5) continue;
    const picture = gap ? makeGapPicture(type, n, rng) : makePicture(type, n, rng);
    const capacity = FRAME_CAPACITY[type] ?? def.max;
    const answer = gap ? capacity - n : n;
    const low = gap ? 1 : Math.max(1, def.min - 1);
    const high = gap ? capacity - 1 : def.max;
    return {
      activity: gap ? 'gap' : 'flash',
      stage,
      type,
      n,
      key,
      picture,
      answer,
      flashMs: flashMs(stage, progress.stages[stage - 1].answers, config),
      choices: choicesFor(answer, low, high, config.choiceCount, rng),
      review,
    };
  }
  throw new Error('unreachable');
}

/** The numbers a picture type can show: a five-frame holds 5, dice stop at 6, and so on. */
function typeRange(type: PictureType, min: number, max: number, gap: boolean, rng: Random): number {
  let lo = min;
  let hi = max;
  const capacity = FRAME_CAPACITY[type];
  if (gap && capacity) {
    lo = capacity === 5 ? 1 : 3;
    hi = Math.max(lo, Math.min(capacity - 1, max));
  } else if (type === 'five') {
    hi = Math.min(hi, 5);
  } else if (type === 'fiveplus') {
    lo = 6;
    hi = Math.min(Math.max(hi, 6), 7);
  } else if (type === 'pair' || type === 'dots') {
    lo = Math.max(lo, 2);
  }
  if (hi < lo) hi = lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export { STAGES };
