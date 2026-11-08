/**
 * Everything to tune for the teacher's Foundational view in one place (R7 plan, section 3). The games are days old, so these are
 * first guesses that catch the clearly stuck: look at them again in 3 or 4 weeks of real data. The rules themselves are
 * shared/kit/teacherGrid.ts and take these as numbers.
 */
import type { FlagRules } from '../../../shared/kit/teacherGrid';
import type { FoundationalGameId } from '../../data/foundational';

export const FLAG_RULES: FlagRules = {
  sameLevelDays: 5,
  manyWrongTaps: 10,
  guessInWindow: 2,
  guessWindow: 5,
  lowAccuracyAttempts: 8,
  lowAccuracyShare: 0.6,
  recentAnswers: 20,
  recentShare: 0.6,
  quietChallenges: 3,
  quietSchoolDays: 10,
};

/** "Hardest right now": a fact needs this many answers across the class to count, and this many are shown for each game. */
export const HARDEST_MIN_ATTEMPTS = 6;
export const HARDEST_COUNT = 3;

/** Alerts on Today: at most this many pupils' names in a line (made-up names only). */
export const ALERT_NAMES = 3;

/** Quick looks: stages finished (0 to 7) that make Learning (1 or more), Secure and Fluent. */
export const QUICK_SECURE_STAGES = 5;
export const QUICK_FLUENT_STAGES = 7;

export interface GameWords {
  name: string;
  /** What a game's levels are called when a line says "on the same ___ for 5 or more days". */
  levelWord: string;
  /** Names for the levels a game saves (`reached`, `step`), and the highest. */
  levels: Record<number, string>;
  top: number | null;
}

/** Words for each game. */
export const GAMES: Record<FoundationalGameId, GameWords> = {
  beanstalk: { name: 'Beanstalk', levelWord: 'beanstalk', levels: {}, top: null },
  hop: { name: 'Hop', levelWord: 'step', levels: { 10: 'Counting in tens', 5: 'Counting in fives', 2: 'Counting in twos', 3: 'Counting in threes', 4: 'Counting in fours', 200: 'Counting in tens past 100' }, top: 200 },
  korora: { name: 'Penguin Pairs', levelWord: 'level', levels: { 1: 'Doubles to 5', 2: 'Halves to 10', 3: 'Doubles to 10', 4: 'Halves to 20', 5: 'Near doubles' }, top: 5 },
  pipi: { name: 'Pipi', levelWord: 'level', levels: { 1: 'Parts of 3 to 5', 2: 'Parts of 6 and 7', 3: 'Parts of 8 to 10' }, top: 3 },
  tui: { name: 'Tūī', levelWord: 'step', levels: { 1: 'How many?', 2: 'Turn it round', 3: 'How many more?', 4: 'Take the ten away', 5: 'All mixed' }, top: 5 },
  weka: { name: 'Weka', levelWord: 'level', levels: { 1: 'Starting on 9', 2: 'Starting on 8', 3: 'Starting on 7 and 6', 4: 'All mixed' }, top: 4 },
  pigeon: { name: 'Pigeon', levelWord: 'step', levels: { 1: 'Tens on the branch', 2: 'Read the arrow', 3: 'Place any number', 4: 'Ten more, ten less', 5: 'Which ten is closer?', 6: 'Zoom in', 7: 'The long branch' }, top: 7 },
  parrot: { name: 'Parrot', levelWord: 'step', levels: { 1: 'Fill the gap', 2: 'Turn it round', 3: 'Swap places', 4: 'Both sides', 5: 'Level or not?', 6: 'Take away' }, top: 6 },
  lizard: { name: 'Lizard', levelWord: 'step', levels: { 1: 'Bundles of ten', 2: 'Tens and ones to 50', 3: 'To 100, and zero', 4: 'Tie and untie', 5: 'Ten more, ten less', 6: 'Hundreds', 7: 'All mixed' }, top: 7 },
  swamphen: { name: 'Swamp Hen', levelWord: 'step', levels: { 1: 'Equal rows', 2: 'Turn the garden', 3: 'Under the mat', 4: 'Share them out', 5: 'Cut the garden', 6: 'One row short' }, top: 6 },
  robin: { name: 'Robin', levelWord: 'step', levels: { 1: 'Give 1 to 5', 2: 'How many? 1 to 5', 3: 'Give 6 to 10', 4: 'How many? 6 to 10', 5: 'One more', 6: 'Count to 20' }, top: 6 },
};

export const QUICK_LOOKS_ID = 'quick-looks';
export const QUICK_LOOKS_NAME = 'Quick looks';
