/**
 * Everything you might want to change about Quick looks (subitising) lives here: the stages,
 * flash times and the rules for moving on. Numbers come from James's research document
 * ("Subitising Practice Design Plan"); docs/SUBITISING-PLAN.md section 3 lists where the document
 * disagreed with itself and which number was picked.
 */

/** Every kind of picture. The id goes into the saved key (`sub:ten-8`), so it is lowercase letters only. */
export type PictureType =
  | 'line' // dots in a row
  | 'clus' // dots in a tight cluster
  | 'angl' // dots slanted, in pairs and triples
  | 'dice' // dice face, upright
  | 'dicet' // dice face turned 45 degrees
  | 'dots' // dice-like cluster of dots, not a dice
  | 'five' // five-frame
  | 'fiveplus' // a full five and a few more in a second colour
  | 'pair' // two colour groups side by side
  | 'ten' // ten-frame filled along the rows
  | 'tenpair' // ten-frame filled in pairs down the columns
  | 'tenmix'; // ten-frame with the counters in scattered squares

export type StageNumber = 1 | 2 | 3 | 4;

export interface SubStage {
  id: StageNumber;
  /** Shown to students: short and kind, never a year level. */
  name: string;
  /** The picture types in this stage. A stage is only finished when every type has been practised. */
  types: readonly PictureType[];
  min: number;
  max: number;
  /** How long the picture shows, in milliseconds: at first, then once the stage is going well. */
  flashStartMs: number;
  flashGoodMs: number;
  /** Does this stage also practise Missing Spots (frames only)? */
  gaps: boolean;
}

export const STAGES: readonly SubStage[] = [
  { id: 1, name: 'A few dots', types: ['line', 'clus', 'angl'], min: 1, max: 3, flashStartMs: 1200, flashGoodMs: 800, gaps: false },
  { id: 2, name: 'Dice and dots', types: ['dice', 'dicet', 'dots'], min: 4, max: 5, flashStartMs: 1000, flashGoodMs: 1000, gaps: false },
  { id: 3, name: 'Five-frames', types: ['five', 'fiveplus', 'pair'], min: 3, max: 7, flashStartMs: 1000, flashGoodMs: 600, gaps: true },
  { id: 4, name: 'Ten-frames', types: ['ten', 'tenpair', 'tenmix'], min: 5, max: 10, flashStartMs: 1000, flashGoodMs: 800, gaps: true },
];

export const SUBITISING_CONFIG = {
  /** A stage is finished when this share of the last `window` answers in it are right... */
  masteryAccuracy: 0.85,
  window: 8,
  /** ...and each of its picture types has been seen at least this many times in the last `typeLookback` answers. */
  minPerType: 2,
  typeLookback: 24,
  /** Below this share right over the last `stepBackWindow` answers, the next pictures are made easier. */
  stepBackBelow: 0.6,
  stepBackWindow: 5,
  /** When a stage has been finished, this share of practice comes from finished stages. */
  reviewShare: 0.2,
  /** Struggling = this many wrong in a row, or thinking longer than this (after the answer buttons unlock). */
  struggleWrongInARow: 2,
  struggleThinkingMs: 4000,
  /** The answer buttons stay locked this long after the picture goes, so a quick tap can't be a guess. */
  answerLockMs: 1000,
  /** "Get ready" pause before each picture. */
  readyMs: 700,
  /** "Peek again" shows the picture for this long, once per picture. */
  peekMs: 500,
  /** How many answer buttons are shown (at least). */
  choiceCount: 5,
  /** A session is this many pictures. */
  sessionTrials: 12,
  /** The starting check is this many pictures. */
  placementTrials: 6,
  /** In Missing Spots, how often (1 in N) a frame stage gives a gap picture. */
  gapEvery: 3,
  /** The answers kept in the browser, newest last. */
  keepAnswers: 400,
} as const;

/** The same numbers, so a test can pass its own. */
export type SubitisingConfig = { [K in keyof typeof SUBITISING_CONFIG]: number };

export const stageOf = (id: StageNumber): SubStage => STAGES[id - 1];

export const STAGE_OF_TYPE: ReadonlyMap<PictureType, StageNumber> = new Map(
  STAGES.flatMap((s) => s.types.map((t) => [t, s.id] as const)),
);

/** How many counters a frame holds (only frame pictures can have Missing Spots). */
export const FRAME_CAPACITY: Readonly<Partial<Record<PictureType, number>>> = { five: 5, ten: 10, tenpair: 10, tenmix: 10 };
