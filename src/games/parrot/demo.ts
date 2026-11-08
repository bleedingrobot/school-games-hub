/**
 * "Show me first": the first time a kind of go comes up (true or false, take away), Parrot shows one made-up go before the
 * child's own. The examples use numbers the real keys never ask (a 10 on the left of a true or false; 2 = 7 − ? is not a
 * take-away key), so a demo can never give away the answer to a real go. Plan: docs/plans/maths-review-2/S12-show-me-first-newer-five.md.
 */
import type { DemoStep } from '../../kit/useKindDemo';
import type { Go, Kind } from '../../../shared/parrot/round';
import { numWord, WORDS } from './words';

export type DemoKind = Extract<Kind, 'tf' | 'sub'>;
export const DEMO_KINDS: readonly string[] = ['tf', 'sub'];

interface Demo {
  /** The key the example stands for (never one of the real `KEYS`). */
  key: string;
  go: Go;
  /** `target` 'card': the hand points at the right card; 'tip': the see-saw shows its result. */
  steps: DemoStep[];
}

const base = { v: 0 as const, l: 5 as const, gs: 1 as const };

export const DEMOS: Record<DemoKind, Demo> = {
  tf: {
    key: 'eqtf:10+1=4+3',
    go: { ...base, key: 'eqtf:10+1=4+3', kind: 'tf', parts: ['10', '+', '1', '=', '4', '+', '3'], answer: 0, choices: [0, 1, 2], wrongs: [{ n: 1, kind: 'both' }, { n: 2, kind: 'side' }], lg: [10, 1], rg: [4, 3] },
    steps: [
      { line: 'Watch. Is it the same on both sides?' },
      { line: `${numWord(10)} plus ${numWord(1)}. ${numWord(4)} plus ${numWord(3)}. The left side is heavier.`, target: 'tip' },
      { line: 'So it tips left.', target: 'card' },
      { line: WORDS.nowTry, holdMs: 300, target: 'card' },
    ],
  },
  sub: {
    key: 'eqsub:2=7-?',
    go: { ...base, key: 'eqsub:2=7-?', kind: 'sub', parts: ['2', '=', '7', '−', '?'], answer: 5, choices: [3, 4, 5, 6], wrongs: [{ n: 3, kind: 'near' }, { n: 4, kind: 'off1' }, { n: 6, kind: 'off1' }], lg: [2], rg: [7], gs: -1 },
    steps: [
      { line: `Watch. ${numWord(2)} is ${numWord(7)} take away how many?` },
      { line: `${numWord(7)} take away ${numWord(5)} leaves ${numWord(2)}. So the missing number is ${numWord(5)}.`, target: 'card' },
      { line: WORDS.nowTry, holdMs: 300, target: 'card' },
    ],
  },
};

/** Every line a demo says, for the voice clips. */
export const demoLines = (): string[] => Object.values(DEMOS).flatMap((d) => d.steps.map((s) => s.line));
