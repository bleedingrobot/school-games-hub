/** The levels on the picker. Names and places (New Zealand mines) come in Stage 3, so for now they are numbered. */
import { RECIPES, type Recipe } from '../../../shared/mine/level';

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
}

/**
 * The practice mine: small, two slow robots and no questions, to learn the controls. Nothing is saved.
 * (An addition for the screen: the six real levels are `RECIPES` in shared/mine/level.ts.)
 */
export const PRACTICE_RECIPE: Recipe = {
  id: 'practice', seed: 7, dims: [2, 2, 2], doors: ['blue'], robots: 2, guards: 0, mix: [1, 0, 0],
  pickups: { shield: 2, energy: 2, missiles: 3 }, pads: [], loops: 1, escapeFactor: 5,
};

const BLURBS = [
  'One blue key, a few robots. A good first dive.',
  'A blue key and a question door.',
  'Two keys, a question door and more robots.',
  'Hunters and turrets join in.',
  'Three keys and two question doors.',
  'The deepest mine. Lots of robots.',
];

const needsQuestions = (r: Recipe) => r.doors.includes('question') || r.pads.length > 0;

export const LEVELS: readonly LevelInfo[] = RECIPES.map((recipe, i) => ({
  id: recipe.id,
  name: `Mine ${i + 1}`,
  difficulty: i + 1,
  blurb: BLURBS[i],
  recipe,
  practice: false,
  needsQuestions: needsQuestions(recipe),
}));

export const PRACTICE: LevelInfo = {
  id: 'practice', name: 'Practice mine', difficulty: 0, blurb: 'Learn the controls. Small, slow robots, nothing is saved.',
  recipe: PRACTICE_RECIPE, practice: true, needsQuestions: false,
};

export function levelById(id: string): LevelInfo | undefined {
  return id === PRACTICE.id ? PRACTICE : LEVELS.find((l) => l.id === id);
}

/** "1:05.3" for a count of steps (30 a second). */
export function formatClock(steps: number): string {
  const tenths = Math.floor((steps * 10) / 30);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${tenths % 10}`;
}
