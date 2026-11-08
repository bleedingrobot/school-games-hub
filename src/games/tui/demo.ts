/**
 * "Show me first": the first time turning round, "how many more?" or taking the ten away comes up, Tūī shows one made-up
 * go before the child's own, with the berries and the arrow cards. The made-up go uses 5 (or 6 when the real go is 5), so
 * the demo never gives away the go that follows. Plan: docs/plans/maths-review-2/S31-show-me-first-older-games.md.
 */
import type { DemoStep } from '../../kit/useKindDemo';
import type { Way } from '../../../shared/tui/round';
import { WORDS } from './words';

/** The kinds of go that get a demo, by the way they are asked (the first way, "ten and", has the guided hand). */
export const DEMO_WAYS: readonly Way[] = [1, 2, 3];
export const demoNumber = (realN: number): number => (realN === 5 ? 6 : 5);

/** The two things said: the go, then its answer worked out. `target` 'start' is the go as asked, 'done' the answer shown. */
export function demoSteps(v: Way, n: number): DemoStep[] {
  const teen = 10 + n;
  const ask =
    v === 1 ? `Watch. ${n} plus ten. The ${n} berries come first.`
    : v === 2 ? `Watch. Ten plus how many makes ${teen}? Look for the empty spaces.`
    : `Watch. ${teen} take away ten. The kete of ten flies away.`;
  const answer = v === 2 ? `${n} more berries. Ten and ${n} make ${teen}.` : v === 3 ? `${n} berries are left.` : `${n} and ten make ${teen}.`;
  return [
    { line: ask, target: 'start' },
    { line: answer, target: 'done' },
    { line: WORDS.nowTry, holdMs: 300, target: 'done' },
  ];
}

/** Every line a demo says, for the voice clips (the made-up number is 5, or 6 for a real 5). */
export const demoLines = (): string[] => DEMO_WAYS.flatMap((v) => [5, 6].flatMap((n) => demoSteps(v, n).map((s) => s.line)));
