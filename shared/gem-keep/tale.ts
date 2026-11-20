/**
 * The Keeper's Tale (docs/plans/stories/PLAN.md, ST.4): an extra goal for each campaign level, with a story reason.
 * Checked from the finished level's own state, like the stars. Winning one shows that chapter's Tale page; the Tale star is
 * "this pupil has seen that page" (story_seen), so nothing new is saved and no coins or maths change.
 * Set against the computer player (autoplay 'sensible', 80% right): it misses most goals by a little, so they are a stretch.
 */
import type { GameState } from './engine';
import type { Colour } from './gems';

export type TaleGoal =
  | { kind: 'noLeaks' }
  | { kind: 'maxLeaks'; n: number }
  | { kind: 'maxTowers'; n: number }
  | { kind: 'noColour'; colour: Colour }
  | { kind: 'keepAtLeast'; n: number };

/** One a level, in campaign order. */
export const TALE_GOALS: TaleGoal[] = [
  { kind: 'noLeaks' },
  { kind: 'noColour', colour: 'red' },
  { kind: 'maxTowers', n: 8 },
  { kind: 'noColour', colour: 'blue' },
  { kind: 'maxLeaks', n: 2 },
  { kind: 'keepAtLeast', n: 80 },
  { kind: 'noColour', colour: 'green' },
  { kind: 'maxTowers', n: 11 },
  { kind: 'noColour', colour: 'yellow' },
  { kind: 'keepAtLeast', n: 50 },
];

/** The goal in a few words, for the level's title bar and the map. */
export function taleWords(goal: TaleGoal): string {
  switch (goal.kind) {
    case 'noLeaks': return "Don't let a single enemy reach the Keep";
    case 'maxLeaks': return `Let no more than ${goal.n} enemies reach the Keep`;
    case 'maxTowers': return `Build no more than ${goal.n} towers`;
    case 'noColour': return `Win with no ${goal.colour} gems in your towers`;
    case 'keepAtLeast': return `Finish with the Keep at ${goal.n} or more`;
  }
}

/** Did this won level meet the goal? */
export function taleMet(goal: TaleGoal, state: GameState): boolean {
  if (state.phase !== 'won') return false;
  switch (goal.kind) {
    case 'noLeaks': return state.stats.leaked === 0;
    case 'maxLeaks': return state.stats.leaked <= goal.n;
    case 'maxTowers': return state.towers.length <= goal.n;
    case 'noColour': return !state.towers.some((t) => t.gem?.colours.includes(goal.colour));
    case 'keepAtLeast': return state.keep >= goal.n;
  }
}
