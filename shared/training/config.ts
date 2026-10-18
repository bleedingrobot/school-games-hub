/**
 * Everything you might want to change about Basic Facts Training lives here: the speed bands,
 * session sizes, review timing and the order tables are taught in. Change a number here and
 * nothing else needs touching.
 */

export type BandId = 'bright' | 'light' | 'yellow' | 'orange' | 'blue' | 'grey';

export interface SpeedBand {
  id: BandId;
  label: string;
  /** Thinking time must be BELOW this (milliseconds) to land in the band. The last band has no limit. */
  upToMs: number;
  /** Background and text colours. No red anywhere (James, 18 Oct 2026). */
  bg: string;
  fg: string;
}

/** Fastest first. A thinking time of exactly 1500 ms is "Quick thinking", not "Just know it!". */
export const BANDS: readonly SpeedBand[] = [
  { id: 'bright', label: 'Just know it!', upToMs: 1500, bg: '#2fd35a', fg: '#053b16' },
  { id: 'light', label: 'Quick thinking', upToMs: 3500, bg: '#a8e6a1', fg: '#11411a' },
  { id: 'yellow', label: 'Getting there', upToMs: 5000, bg: '#ffe066', fg: '#4a3b00' },
  { id: 'orange', label: 'Working it out', upToMs: 8000, bg: '#ffc58a', fg: '#5a2f00' },
  { id: 'blue', label: 'Still learning', upToMs: 10000, bg: '#9ec9f5', fg: '#0f3057' },
  { id: 'grey', label: 'New to me', upToMs: Infinity, bg: '#b4bfcf', fg: '#26303f' },
];

/** Shown for a fact the student hasn't answered yet. Not a speed band. */
export const UNTRIED = { label: 'Not tried yet', bg: '#f2f4f7', fg: '#5b6472' } as const;

export const TRAINING_CONFIG = {
  /** How many of the latest answers decide its colour (the middle of these). */
  colourFromLastAnswers: 3,
  /** How many answers we remember per fact. */
  historyLength: 10,
  /** "Known" = bright green on this many different days. */
  knownGreenDays: 2,
  /** A fact at this band or faster is secure enough to move on to the next set of facts. */
  secureBand: 'light' as BandId,

  /** A session: about 3 minutes or this many questions, whichever comes first. */
  session: {
    questions: 24,
    minQuestions: 20,
    maxQuestions: 30,
    maxMs: 3 * 60 * 1000,
    /** Share of the questions in each group. Learning gets whatever is left over. */
    reviewShare: 0.25,
    knownShare: 0.15,
    /** How many facts are being learned at once (the rest wait their turn). */
    learningFacts: 6,
    /** How many different known facts are used for the easy wins and the last question. */
    knownFacts: 6,
    /** Struggling students: 2 new facts among about 4 known ones. */
    struggling: { learningFacts: 2, knownFacts: 4, reviewShare: 0.2, knownShare: 0.4 },
    /** Nobody sees the same fact twice in a row, and no fact is asked more than this often in one session. */
    maxAsksPerFact: 5,
  },

  /** Struggling = fewer than this share right over the last `window` answers (needs at least `minAnswers`). */
  struggling: { window: 12, minAnswers: 8, belowCorrect: 0.6 },

  /**
   * Saving answers (stage T.2). The newest `answersPerFact` answers of each fact are kept in the
   * database (enough to rebuild its colour, green days and review date), and a student can save
   * `answersPerDay` answers a day. The browser stops timing an answer at `longestAnswerMs`
   * (anything slower is "New to me" anyway), and the server turns away times over `rejectAnswerMs`.
   */
  storage: { answersPerFact: 30, answersPerDay: 600, longestAnswerMs: 120_000, rejectAnswerMs: 600_000, longestTypingMs: 10_000 },

  /** Days before a fact is due for review again, by how many green days it has. */
  reviewDays: [1, 2, 4, 7, 14],

  /** Typing check: how many recent checks we keep per answer length, and what we assume before any. */
  typing: {
    keep: 5,
    defaultMs: { 1: 700, 2: 1100, 3: 1500 } as Record<number, number>,
  },

  /** The ladder: the NZC order times tables are taught in (plan section 8). The order inside a step is the order facts are introduced. */
  tableFamilies: [
    { step: 1, tables: [2, 5, 10, 1] },
    { step: 2, tables: [3, 4, 8] },
    { step: 3, tables: [6, 9] },
    { step: 4, tables: [7] },
    { step: 5, tables: [11, 12] },
  ] as const,
  maxFactor: 12,
};

export type TrainingConfig = typeof TRAINING_CONFIG;
