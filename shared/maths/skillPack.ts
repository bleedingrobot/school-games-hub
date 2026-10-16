/**
 * A skill pack supplies questions of one kind (times tables now; addition facts, doubling,
 * place value and so on later). Games only talk to this interface, so a new pack can be
 * dropped in without touching game code.
 */
import type { FactStats } from './leitner';
import type { Band, QuestionContext } from './selector';

export type { QuestionContext };

export interface Question {
  /** Unique within the session. */
  id: number;
  skill: string;
  /** The mastery record it counts towards, e.g. "mul:7x8". */
  factKey: string;
  kind: string;
  /** What's on screen, left to right, with '?' for the blank: ['7', '×', '8', '=', '?']. */
  parts: string[];
  /** For screen readers: "7 times 8 equals what?" */
  spoken: string;
  answer: number;
  /** Multiple-choice mode only: the choices, in the order to show them. */
  choices?: number[];
  band: Band;
}

export interface AnswerResult {
  correct: boolean;
  /** The whole fact with its answer, shown when the answer was wrong: "7 × 8 = 56". */
  fact: string;
  /** Mastery box before and after. */
  boxBefore: number;
  boxAfter: number;
}

export interface SkillPack {
  id: string;
  label: string;
  /** NZ Curriculum codes, filled in from James's curriculum alignment tool. */
  curriculumTags: string[];
  /** Null only when nothing can be asked (every table switched off). */
  nextQuestion(ctx: QuestionContext): Question | null;
  recordAnswer(q: Question, answer: number, ms: number): AnswerResult;
  /** Every fact's record, for saving. */
  stats(): FactStats[];
}
