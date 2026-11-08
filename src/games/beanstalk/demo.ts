/**
 * "Show me first": the first time a missing-leaf go ("7 + ? = 10") comes up, Kiwi shows one made-up go before the child's own.
 * The made-up leaf is 3 (or 4 when the real go is 3) in the beanstalk's own units, so the demo never gives away the go that follows.
 * Plan: docs/plans/maths-review-2/S31-show-me-first-older-games.md.
 */
import type { DemoStep } from '../../kit/useKindDemo';
import { TARGETS, unitOf, type Target } from '../../../shared/beanstalk/round';
import { WORDS } from './words';

/** The kind of go this is, for the kit's seen list. */
export const MISSING_KIND = 'missing';

export const demoLeaf = (realLeaf: number, target: Target): number => (realLeaf === 3 * unitOf(target) ? 4 : 3) * unitOf(target);

/** The go, then its answer worked out, then "now you try". `target` 'ask' shows the sum with a gap, 'done' the leaf filled. */
export function demoSteps(a: number, target: Target): DemoStep[] {
  return [
    { line: `Watch. ${a} and what make ${target}? One leaf is missing.`, target: 'ask' },
    { line: `${WORDS.right(a, target - a)} ${WORDS.takeAway(a, target)}`, target: 'done' },
    { line: WORDS.nowTryDemo, holdMs: 300, target: 'done' },
  ];
}

/** Every line a demo says, for the voice clips. */
export const demoLines = (): string[] => TARGETS.flatMap((t) => [3, 4].flatMap((n) => demoSteps(n * unitOf(t), t).map((s) => s.line)));
