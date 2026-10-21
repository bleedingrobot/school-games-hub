/**
 * Where a student is, worked out from their answers (oldest first). Nothing about a student's
 * stage is stored separately: replay the answers and you get the same result every time.
 *
 * Finishing a stage stays finished. Answers after that can make the next pictures easier for a
 * while (stepping back) but never take a finished stage away.
 */
import { STAGES, SUBITISING_CONFIG, stageOf, type PictureType, type StageNumber, type SubitisingConfig } from './config';
import { parseKey } from './keys';

/** One saved answer, as far as Quick looks cares. Guided answers (picture stayed on screen with help) aren't counted. */
export interface SubAnswer {
  key: string;
  correct: boolean;
  /** Milliseconds since 1970. */
  at: number;
  /** True when the picture was shown with help (after a struggle), so it says nothing about the stage. */
  helped?: boolean;
}

export interface StageProgress {
  id: StageNumber;
  finished: boolean;
  /** Counted answers in this stage, newest last. */
  answers: boolean[];
  /** Answers per picture type among the last `typeLookback` counted answers. */
  seen: Partial<Record<PictureType, number>>;
}

export interface Progress {
  stages: StageProgress[];
  /** The stage the next pictures come from: the first one not finished (the last stage when all are). */
  current: StageNumber;
  /** True when recent answers say the next pictures should be easier. */
  stepBack: boolean;
  /** The last answers in the current stage, newest last (right or wrong). */
  recent: boolean[];
}

export const share = (answers: readonly boolean[]) => (answers.length ? answers.filter(Boolean).length / answers.length : 0);

/** Does this run of answers finish a stage? */
export function stageDone(
  stage: StageNumber,
  answers: readonly { correct: boolean; type: PictureType }[],
  config: SubitisingConfig = SUBITISING_CONFIG,
): boolean {
  if (answers.length < config.window) return false;
  const lastWindow = answers.slice(-config.window).map((a) => a.correct);
  if (share(lastWindow) < config.masteryAccuracy) return false;
  const lookback = answers.slice(-config.typeLookback);
  return stageOf(stage).types.every((t) => lookback.filter((a) => a.type === t).length >= config.minPerType);
}

/**
 * Starting stage: stages below it are counted as finished (the starting check put the student
 * higher up), though they still come back as review.
 */
export function progressFrom(answers: readonly SubAnswer[], startStage: StageNumber = 1, config: SubitisingConfig = SUBITISING_CONFIG): Progress {
  const finished = new Set<StageNumber>(STAGES.filter((s) => s.id < startStage).map((s) => s.id));
  const byStage = new Map<StageNumber, { correct: boolean; type: PictureType }[]>(STAGES.map((s) => [s.id, []]));

  for (const a of answers) {
    if (a.helped) continue;
    const key = parseKey(a.key);
    if (!key) continue;
    const list = byStage.get(key.stage)!;
    list.push({ correct: a.correct, type: key.type });
    if (!finished.has(key.stage) && stageDone(key.stage, list, config)) finished.add(key.stage);
  }

  const stages: StageProgress[] = STAGES.map((s) => {
    const list = byStage.get(s.id)!;
    const seen: Partial<Record<PictureType, number>> = {};
    for (const a of list.slice(-config.typeLookback)) seen[a.type] = (seen[a.type] ?? 0) + 1;
    return { id: s.id, finished: finished.has(s.id), answers: list.map((a) => a.correct), seen };
  });

  const open = stages.find((s) => !s.finished);
  const current = (open ? open.id : STAGES[STAGES.length - 1].id) as StageNumber;
  const recent = stages[current - 1].answers.slice(-config.stepBackWindow);
  const stepBack = recent.length >= config.stepBackWindow && share(recent) < config.stepBackBelow;
  return { stages, current, stepBack, recent };
}

/** Is this student struggling right now? Two wrong in a row, or the last answer took too long to think about. */
export function isStruggling(recentCorrect: readonly boolean[], lastThinkingMs: number | null, config: SubitisingConfig = SUBITISING_CONFIG): boolean {
  const n = config.struggleWrongInARow;
  if (recentCorrect.length >= n && recentCorrect.slice(-n).every((c) => !c)) return true;
  return lastThinkingMs !== null && lastThinkingMs > config.struggleThinkingMs;
}

/** How long a picture shows at this stage: the starting time at first, shorter once the stage is going well. */
export function flashMs(stage: StageNumber, stageAnswers: readonly boolean[], config: SubitisingConfig = SUBITISING_CONFIG): number {
  const s = stageOf(stage);
  const recent = stageAnswers.slice(-config.window);
  if (recent.length < config.window || share(recent) < config.masteryAccuracy) return s.flashStartMs;
  return s.flashGoodMs;
}

/** How much each stage has grown, 0 (a seed) to 4 (in flower), for the garden. */
export function growth(stage: StageProgress): 0 | 1 | 2 | 3 | 4 {
  if (stage.finished) return 4;
  const right = stage.answers.filter(Boolean).length;
  return Math.min(3, Math.floor(right / 4)) as 0 | 1 | 2 | 3;
}
