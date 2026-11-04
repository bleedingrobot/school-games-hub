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
  | 'tenfive' // ten-frame with 1 to 5 counters along the top row
  | 'ten' // ten-frame filled along the rows
  | 'tenpair' // ten-frame filled in pairs down the columns
  | 'tenmix'; // ten-frame with the counters in scattered squares

export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** What a stage asks: count the dots (flash), count the empty squares (gap), or half each (mixed). */
export type StageActivity = 'flash' | 'gap' | 'mixed';

export interface SubStage {
  id: StageNumber;
  /** Shown to students: short and kind, never a year level. */
  name: string;
  /** The picture types in this stage. A stage is only finished when every type has been practised. */
  types: readonly PictureType[];
  /** The numbers the pictures show (dots), or for the gap stage the answers (empty squares). */
  min: number;
  max: number;
  /** How long the picture shows, in milliseconds: at first, then once the stage is going well. */
  flashStartMs: number;
  flashGoodMs: number;
  activity: StageActivity;
}

export const STAGES: readonly SubStage[] = [
  { id: 1, name: 'A few dots', types: ['line', 'clus', 'angl'], min: 1, max: 3, flashStartMs: 1200, flashGoodMs: 800, activity: 'flash' },
  { id: 2, name: 'Ten-frame to 5', types: ['tenfive'], min: 1, max: 5, flashStartMs: 1200, flashGoodMs: 800, activity: 'flash' },
  { id: 3, name: 'Dice and dots', types: ['dice', 'dicet', 'dots'], min: 4, max: 5, flashStartMs: 1000, flashGoodMs: 1000, activity: 'flash' },
  { id: 4, name: 'Five-frames', types: ['five', 'fiveplus', 'pair'], min: 3, max: 7, flashStartMs: 1000, flashGoodMs: 600, activity: 'flash' },
  { id: 5, name: 'Ten-frame to 10', types: ['ten', 'tenpair'], min: 5, max: 10, flashStartMs: 1000, flashGoodMs: 800, activity: 'flash' },
  { id: 6, name: 'Empty squares', types: ['five', 'ten', 'tenpair'], min: 1, max: 7, flashStartMs: 1000, flashGoodMs: 800, activity: 'gap' },
  { id: 7, name: 'Mix it up', types: ['tenmix'], min: 5, max: 10, flashStartMs: 1000, flashGoodMs: 800, activity: 'mixed' },
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
  placementTrials: 8,
  /** The answers kept in the browser, newest last. */
  keepAnswers: 400,
} as const;

/** The same numbers, so a test can pass its own. */
export type SubitisingConfig = { [K in keyof typeof SUBITISING_CONFIG]: number };

export const stageOf = (id: StageNumber): SubStage => STAGES[id - 1];

/** Which activity a picture is: counting dots (`sub:` keys) or counting empty squares (`gap:` keys). */
export type PictureActivity = 'flash' | 'gap';

const FLASH_STAGE_OF_TYPE: ReadonlyMap<PictureType, StageNumber> = new Map(
  STAGES.filter((s) => s.activity !== 'gap').flatMap((s) => s.types.map((t) => [t, s.id] as const)),
);

/** The stage a saved key belongs to: every gap is stage 6 except tenmix (7); dots go by picture type. Undefined if the type has none. */
export function stageOfKey(activity: PictureActivity, type: PictureType): StageNumber | undefined {
  if (activity === 'gap') return type === 'tenmix' ? 7 : 6;
  return FLASH_STAGE_OF_TYPE.get(type);
}

/** Does this stage give pictures of this activity? */
export const stageHas = (stage: SubStage, activity: PictureActivity): boolean => stage.activity === 'mixed' || stage.activity === activity;

/** A type practised in one activity. A stage is finished when each of its slots has been seen enough. */
export const slotOf = (activity: PictureActivity, type: PictureType): string => `${activity}:${type}`;

/** The slots of a stage: each type in each activity the stage gives. */
export function slotsOf(stage: SubStage): string[] {
  return (['flash', 'gap'] as const).filter((a) => stageHas(stage, a)).flatMap((a) => stage.types.map((t) => slotOf(a, t)));
}

/** How many counters a frame holds (only frame pictures can have empty squares; tenfive is never used for gaps). */
export const FRAME_CAPACITY: Readonly<Partial<Record<PictureType, number>>> = { five: 5, tenfive: 10, ten: 10, tenpair: 10, tenmix: 10 };

/** The counters showing in an empty-squares picture (so 5 - n or 10 - n squares are empty). */
export const GAP_FILLED: Readonly<Partial<Record<PictureType, readonly [number, number]>>> = { five: [1, 4], ten: [3, 9], tenpair: [3, 9], tenmix: [3, 9] };
