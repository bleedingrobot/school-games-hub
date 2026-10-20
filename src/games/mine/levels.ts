/** The levels on the picker: six New Zealand mines, each with a hard mode that has its own board. */
import { RECIPES, hardRecipe, type Recipe } from '../../../shared/mine/level';

export interface LevelInfo {
  id: string;
  name: string;
  /** 0 for the practice mine, then 1 to 6. */
  difficulty: number;
  blurb: string;
  recipe: Recipe;
  practice: boolean;
  /** Question doors and pads need maths questions (a server in the real game, trial questions in the preview). */
  needsQuestions: boolean;
  /** True for the hard-mode version of a mine (its id ends in ":hard"). */
  hard: boolean;
}

/**
 * The practice mine: small, two slow robots and no questions, to learn the controls. Nothing is saved.
 * (An addition for the screen: the six real levels are `RECIPES` in shared/mine/level.ts.)
 */
export const PRACTICE_RECIPE: Recipe = {
  id: 'practice', seed: 7, dims: [2, 2, 2], doors: ['blue'], robots: 2, guards: 0, mix: [1, 0, 0],
  pickups: { shield: 2, energy: 2, missiles: 3 }, pads: [], loops: 1, escapeFactor: 5,
};

/**
 * Made-up mines in the style of real New Zealand mining country. No real mine is named (some real places carry
 * sad history), so these are about the kind of place, not a place.
 */
const NAMES = [
  'Greenstone Hollow',
  'Otago Diggings',
  'Coromandel Gold Tunnel',
  'West Coast Coal Seam',
  'Glow-worm Caverns',
  'Volcanic Deep',
];
const BLURBS = [
  'A cave of glowing greenstone. A blue key, a question door and a few slow drones. A good first dive.',
  'Old gold-rush tunnels. A blue key, a question door and your first number gate.',
  'A twisty gold mine. Two keys, two question doors and more robots.',
  'Deep coal tunnels. Three question doors, and hunters, turrets and heavy diggers join in.',
  'Caverns under glowing ceilings. Three keys and three question doors.',
  'The deepest mine, deep under a volcano. Lots of robots and lots of doors.',
];

const needsQuestions = (r: Recipe) => r.doors.includes('question') || r.pads.length > 0;

export const LEVELS: readonly LevelInfo[] = RECIPES.map((recipe, i) => ({
  id: recipe.id,
  name: NAMES[i],
  difficulty: i + 1,
  blurb: BLURBS[i],
  recipe,
  practice: false,
  needsQuestions: needsQuestions(recipe),
  hard: false,
}));

/** The hard version of a mine: same tunnels, more and tougher robots, a shorter escape. Its times are kept apart. */
export function hardOf(level: LevelInfo): LevelInfo {
  if (level.practice || level.hard) return level;
  return { ...level, id: `${level.id}:hard`, name: `${level.name} (hard)`, recipe: hardRecipe(level.recipe), hard: true };
}

/** The normal version of a mine, whichever version is given. */
export function baseOf(level: LevelInfo): LevelInfo {
  return level.hard ? (LEVELS.find((l) => `${l.id}:hard` === level.id) ?? level) : level;
}

export const PRACTICE: LevelInfo = {
  id: 'practice', name: 'Practice mine', difficulty: 0, blurb: 'Learn the controls. Small, slow robots, nothing is saved.',
  recipe: PRACTICE_RECIPE, practice: true, needsQuestions: false, hard: false,
};

export function levelById(id: string): LevelInfo | undefined {
  if (id === PRACTICE.id) return PRACTICE;
  if (id.endsWith(':hard')) {
    const base = LEVELS.find((l) => l.id === id.slice(0, -5));
    return base && hardOf(base);
  }
  return LEVELS.find((l) => l.id === id);
}

/** "1:05.3" for a count of steps (30 a second). */
export function formatClock(steps: number): string {
  const tenths = Math.floor((steps * 10) / 30);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${tenths % 10}`;
}
