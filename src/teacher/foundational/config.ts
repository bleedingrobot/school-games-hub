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
  /** The saved values from the lowest step to the highest (Hop saves 10, 5, 2, 3, 4, 200). */
  order: number[];
}

/** Words for each game. */
export const GAMES: Record<FoundationalGameId, GameWords> = {
  beanstalk: { name: 'Beanstalk', levelWord: 'step', levels: { 0: 'Bonds to 10', 1: 'Bonds to 20', 2: 'Bonds to 100', 3: 'Bonds to 1000' }, top: 3, order: [0, 1, 2, 3] },
  hop: { name: 'Hop', levelWord: 'step', levels: { 10: 'Counting in tens', 5: 'Counting in fives', 2: 'Counting in twos', 3: 'Counting in threes', 4: 'Counting in fours', 200: 'Counting in tens past 100' }, top: 200, order: [10, 5, 2, 3, 4, 200] },
  korora: { name: 'Penguin Pairs', levelWord: 'step', levels: { 1: 'Doubles to 5', 2: 'Halves to 10', 3: 'Doubles to 10', 4: 'Halves to 20', 5: 'Near doubles' }, top: 5, order: [1, 2, 3, 4, 5] },
  pipi: { name: 'Pipi', levelWord: 'step', levels: { 1: 'Parts of 3 to 5', 2: 'Parts of 6 and 7', 3: 'Parts of 8 to 10' }, top: 3, order: [1, 2, 3] },
  tui: { name: 'Tūī', levelWord: 'step', levels: { 1: 'How many?', 2: 'Turn it round', 3: 'How many more?', 4: 'Take the ten away', 5: 'All mixed' }, top: 5, order: [1, 2, 3, 4, 5] },
  weka: { name: 'Weka', levelWord: 'step', levels: { 1: 'Starting on 9', 2: 'Starting on 8', 3: 'Starting on 7 and 6', 4: 'All mixed' }, top: 4, order: [1, 2, 3, 4] },
  pigeon: { name: 'Pigeon', levelWord: 'step', levels: { 1: 'Tens on the branch', 2: 'Read the arrow', 3: 'Place any number', 4: 'Ten more, ten less', 5: 'Which ten is closer?', 6: 'Zoom in', 7: 'The long branch' }, top: 7, order: [1, 2, 3, 4, 5, 6, 7] },
  parrot: { name: 'Parrot', levelWord: 'step', levels: { 1: 'Fill the gap', 2: 'Turn it round', 3: 'Swap places', 4: 'Both sides', 5: 'Level or not?', 6: 'Take away' }, top: 6, order: [1, 2, 3, 4, 5, 6] },
  lizard: { name: 'Lizard', levelWord: 'step', levels: { 1: 'Bundles of ten', 2: 'Tens and ones to 50', 3: 'To 100, and zero', 4: 'Tie and untie', 5: 'Ten more, ten less', 6: 'Hundreds', 7: 'All mixed' }, top: 7, order: [1, 2, 3, 4, 5, 6, 7] },
  swamphen: { name: 'Swamp Hen', levelWord: 'step', levels: { 1: 'Equal rows', 2: 'Turn the garden', 3: 'Under the mat', 4: 'Share them out', 5: 'Cut the garden', 6: 'One row short' }, top: 6, order: [1, 2, 3, 4, 5, 6] },
  robin: { name: 'Robin', levelWord: 'step', levels: { 1: 'Give 1 to 5', 2: 'How many? 1 to 5', 3: 'Give 6 to 10', 4: 'How many? 6 to 10', 5: 'One more', 6: 'Count to 20' }, top: 6, order: [1, 2, 3, 4, 5, 6] },
};

export const QUICK_LOOKS_ID = 'quick-looks';
export const QUICK_LOOKS_NAME = 'Quick looks';

/** Where a saved value sits among a game's steps: "Step 3 of 6: Give 6 to 10" is `{ n: 3, of: 6, name: 'Give 6 to 10' }`. */
export function stepOf(game: FoundationalGameId, saved: number | null): { n: number; of: number; name: string } | null {
  if (saved === null) return null;
  const words = GAMES[game];
  const i = words.order.indexOf(saved);
  if (i < 0) return null;
  return { n: i + 1, of: words.order.length, name: words.levels[saved] ?? '' };
}

/** "Step 3 of 6: Give 6 to 10", or an empty string for a value the game does not save. */
export function stepWords(game: FoundationalGameId, saved: number | null): string {
  const s = stepOf(game, saved);
  return s ? `Step ${s.n} of ${s.of}${s.name ? `: ${s.name}` : ''}` : '';
}

/** Picture help counts down from 5 (the most help) to 0 (none). */
export function pictureHelp(level: number, top = 5): string {
  return level <= 0 ? 'no picture help' : `picture help ${level} of ${top}`;
}
