/**
 * "Show me first": the first time hopping back or starting on the bigger number comes up, Weka shows one made-up go
 * before the child's own. The examples add or take away within the teens (14 − 3, 2 + 14): the real goes never use those
 * numbers (their bigger number is 9 at most), so a demo can never give away the answer to a real go. Plan:
 * docs/plans/maths-review-2/S31-show-me-first-older-games.md.
 */
import type { DemoStep } from '../../kit/useKindDemo';
import type { Kind } from '../../../shared/weka/round';
import { WORDS } from './words';

export type DemoKind = Extract<Kind, 'back' | 'turn'>;
export const DEMO_KINDS: readonly string[] = ['back', 'turn'];

export interface Demo {
  /** The sum on the screen, as shown for a real go. */
  sum: string;
  /** Hops Weka makes, and the stone Weka starts and ends on. */
  small: number;
  from: number;
  to: number;
  /** `target`: 'start' Weka waits on the first stone, 'land' Weka has hopped and the stones passed are marked. */
  steps: DemoStep[];
}

export const DEMOS: Record<DemoKind, Demo> = {
  back: {
    sum: '14 − 3',
    small: 3,
    from: 14,
    to: 11,
    steps: [
      { line: 'Watch. 14 take away 3. Weka starts on 14 and hops back 3.', target: 'start' },
      { line: 'Hop back 3. Weka lands on 11.', target: 'land' },
      { line: WORDS.nowTry, holdMs: 300, target: 'land' },
    ],
  },
  turn: {
    sum: '2 + 14',
    small: 2,
    from: 14,
    to: 16,
    steps: [
      { line: 'Watch. 2 plus 14. Weka starts on the bigger number, 14.', target: 'start' },
      { line: 'Hop on 2. Weka lands on 16.', target: 'land' },
      { line: WORDS.nowTry, holdMs: 300, target: 'land' },
    ],
  },
};

/** Every line a demo says, for the voice clips. */
export const demoLines = (): string[] => Object.values(DEMOS).flatMap((d) => d.steps.map((s) => s.line));
