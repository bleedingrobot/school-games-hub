/**
 * The numbers and words behind Robin's Berry Basket (docs/ROBIN-PLAN.md), in one place so the game, the server and the tests
 * agree. Nothing here is a maths rule; the keys are in shared/maths/skillPacks/countingKeys.ts.
 */
import type { StepRules } from '../kit/help';

export const GOES_PER_ROUND = 10;
/** From step 3 on, this many goes are earlier kinds (the rest are the step's new thing). */
export const REVIEW_GOES = 3;
export const TOP_LEVEL = 5;
export const TOP_STEP = 6;

/**
 * Help and steps move on the kit's shape (shared/kit/help.ts), with two numbers the plan sets for children of four to six:
 * the help fades after two challenges of 7 or more right at the first tap (the kit's is 8), while a step is passed after two
 * challenges of 8 or more (Tūī's rule). The kit's `placeAfter` has one `good` for both, so shared/robin/progress.ts has its own.
 */
export const FADE_GOOD = 7;
export const PASS_GOOD = 8;
export const STEP_RULES: StepRules = { good: FADE_GOOD, hard: 4, goodToFade: 2, topLevel: TOP_LEVEL, goodToPass: 2, topStep: TOP_STEP, newStepHelp: 2, newStepLevel: 0 };

/** Ten berry baskets by the nest, three changes each: thirty finished days to the Golden Berry Feast. */
export const BASKETS = 10;
/** Whose basket it is, in order: Robin first, then a friend's basket after each Feast. */
export const FRIENDS = ['robin', 'kiwi', 'kea', 'weka', 'pukeko', 'tui'] as const;
export type Friend = (typeof FRIENDS)[number];
export const FRIEND_NAMES: Record<Friend, string> = { robin: 'Robin', kiwi: 'Kiwi', kea: 'Kea', weka: 'Weka', pukeko: 'Pūkeko', tui: 'Tūī' };

/** A "give me" pile holds the number asked for plus this many spare berries (the child must stop; the pile never ends it for them). */
export const PILE_EXTRA = [3, 5] as const;
/** The most berries in any pile (11 to 20 are asked from a pile of up to this many, so giving "everything" is never right). */
export const MAX_PILE = 24;

export const STEPS = [
  { step: 1, name: 'Give 1 to 5' },
  { step: 2, name: 'How many? 1 to 5' },
  { step: 3, name: 'Give 6 to 10' },
  { step: 4, name: 'How many? 6 to 10' },
  { step: 5, name: 'One more' },
  { step: 6, name: 'Count to 20' },
] as const;
export type Step = 1 | 2 | 3 | 4 | 5 | 6;
/** 5 numbered slots and Bella counts; 4 numbered slots; 3 plain basket, each berry says its number; 2 the number above the basket; 1 no marks and a Peek; 0 a free pile. */
export type HelpLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const stepName = (step: Step) => STEPS[step - 1].name;

/** What each help level shows (the screens read this, so the tests and the pictures agree). */
export interface HelpShows {
  /** Numbered slots in the basket (two rows of five). */
  slots: boolean;
  /** Bella says each number as a berry is tapped. */
  says: boolean;
  /** The number so far shows above the basket. */
  numberAbove: boolean;
  /** A tapped berry dims, so none is counted twice. */
  dims: boolean;
  /** A Peek button brings the slots back. */
  peek: boolean;
}
export const helpShows = (level: HelpLevel): HelpShows => ({
  slots: level >= 4,
  says: level === 5 || level === 3,
  numberAbove: level === 2,
  dims: level >= 2,
  peek: level === 1,
});
