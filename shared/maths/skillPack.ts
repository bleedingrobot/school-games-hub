/**
 * A skill pack supplies questions of one kind (times tables now; addition facts, doubling,
 * place value and so on later). Games only talk to this interface, so a new pack can be
 * dropped in without touching game code.
 */
import type { FactAnswer, FactStats } from './leitner';
import type { Band, QuestionContext } from './selector';

export type { QuestionContext };

export interface Question {
  /** Unique within the session. */
  id: number;
  skill: string;
  /** The mastery record it counts towards, e.g. "mul:7x8". */
  factKey: string;
  kind: string;
  /**
   * What's on screen, left to right, with '?' for the blank: ['7', '×', '8', '=', '?'].
   * A part like '3/4' or '?/8' is drawn as a fraction (the '?' is the blank). Other parts can
   * be words ('Round', 'to the nearest 10').
   */
  parts: string[];
  /** For screen readers: "7 times 8 equals what?" */
  spoken: string;
  answer: number;
  /**
   * Multiple-choice mode: the choices, in the order to show them. Always set when
   * `choiceLabels` is (a question that can only be answered by picking).
   */
  choices?: number[];
  /** What each choice shows, when it isn't the number itself (e.g. '2/3' for the choice 0). */
  choiceLabels?: string[];
  /** 'decimal' adds a point key to the number pad (0.8, 4.15). Default whole numbers. */
  input?: 'whole' | 'decimal';
  /** Longest answer that can be typed, in characters. Default 3. */
  maxLength?: number;
  /** The numbers the question was made from, so the server can make it again and check it. */
  params?: number[];
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
  /** Every fact's record. */
  stats(): FactStats[];
  /** Hears every answer as it's recorded (for saving). Returns a function that stops listening. */
  onAnswer(listener: (answer: FactAnswer) => void): () => void;
}
