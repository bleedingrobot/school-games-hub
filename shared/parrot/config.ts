/**
 * The numbers and words behind Parrot's See-saw (docs/PARROT-PLAN.md), in one place so the game, the server and the tests
 * agree. Help rules come from the game kit (shared/kit/help.ts); nothing here is a maths rule.
 */
import { ROUND_OF_TEN, type StepRules } from '../kit/help';

export const GOES_PER_ROUND = 10;
/** From step 2 on, this many goes are the earlier layouts or keys (the rest are the new ones). */
export const REVIEW_GOES = 3;
export const TOP_LEVEL = 5;
export const TOP_STEP = 6;
/** The kit's rules for this game: two good challenges pass a step, a new step brings help back by two. */
export const STEP_RULES: StepRules = { ...ROUND_OF_TEN, topLevel: TOP_LEVEL, goodToPass: 2, topStep: TOP_STEP, newStepHelp: 2, newStepLevel: 0 };
/** Box 2 or more on this many of the "make 10" pairs when they first play (with some adding done): start at `KNOWN_START`. */
export const KNOWN_BONDS = 5;
export const KNOWN_START = { step: 3, level: 3 } as const;
/** Ten shiny things on the bell rope, three changes each: thirty finished days to a Golden Bell. */
export const THINGS = 10;
/** Whose see-saw it is, in order: Parrot first, then a friend's see-saw after each Golden Bell (all English names). */
export const FRIENDS = ['parrot', 'robin', 'kiwi', 'duck', 'owl'] as const;
export type Friend = (typeof FRIENDS)[number];
export const FRIEND_NAMES: Record<Friend, string> = { parrot: 'Parrot', robin: 'Robin', kiwi: 'Kiwi', duck: 'Duck', owl: 'Owl' };

export const STEPS = [
  { step: 1, name: 'Fill the gap' },
  { step: 2, name: 'Turn it round' },
  { step: 3, name: 'Swap places' },
  { step: 4, name: 'Both sides' },
  { step: 5, name: 'Level or not?' },
  { step: 6, name: 'Take away' },
] as const;
export type Step = 1 | 2 | 3 | 4 | 5 | 6;
/** 5 stones, live tilt; 4 stones, tilt on Check; 3 numbered weights; 2 equation and a small see-saw; 1 equation and Peek; 0 equation only. */
export type HelpLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const stepName = (step: Step) => STEPS[step - 1].name;
