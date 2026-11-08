/**
 * "Show me first": the first time a kind of go comes up (halves, near doubles, fair or not), Penguin Pairs shows one made-up go
 * before the child's own. The examples use numbers the real keys never ask (half of 22: halves stop at 20; 4 + 5: near doubles
 * start at 5 + 6; 5 fish: fair or not starts at 6), so a demo can never give away the answer to a real go. Halves use the shared
 * pile, dealt out; fair or not shows the fish pairing off before any sorting. Plan: docs/plans/maths-review-2/S31-show-me-first-older-games.md.
 */
import type { DemoStep } from '../../kit/useKindDemo';
import { mistakeChoices, spokenFor, type Go, type Kind } from '../../../shared/korora/round';
import { WORDS } from './words';

export type DemoKind = Extract<Kind, 'half' | 'near' | 'fair'>;
export const DEMO_KINDS: readonly string[] = ['half', 'near', 'fair'];

interface Demo {
  /** The key the example stands for (never one of the real keys at any level). */
  key: string;
  go: Go;
  /** `target` 'card': the hand points at the right card; 'pile': the picture does its part (counting, sharing or pairing off). */
  steps: DemoStep[];
}

const base = { v: 0 as const, h: 'full' as const };
const random = () => 0.5;

export const DEMOS: Record<DemoKind, Demo> = {
  half: {
    key: 'half:22',
    go: { ...base, key: 'half:22', kind: 'half', n: 22, answer: 11, parts: ['Half', 'of', '22', '=', '?'], spoken: spokenFor('half', 22), ...mistakeChoices('half', 22, random) },
    steps: [
      { line: 'Watch. Half of 22. Share 22 fish fairly between the two chicks.' },
      { line: 'One for you, and one for me, again and again.', holdMs: 3600, target: 'pile' },
      { line: 'Now count one chick’s share: 11. Half of 22 is 11.', target: 'card' },
      { line: WORDS.nowTry, holdMs: 300, target: 'card' },
    ],
  },
  near: {
    key: 'add:4+5',
    go: { ...base, key: 'add:4+5', kind: 'near', n: 4, answer: 9, parts: ['4', '+', '5', '=', '?'], spoken: spokenFor('near', 4), ...mistakeChoices('near', 4, random) },
    steps: [
      { line: 'Watch. 4 and 5. 4 fish on the rock, and 5 in the water.' },
      { line: '4 and 4 is 8 fish. That is the double.', target: 'pile' },
      { line: 'Then one more fish. 8 and 1 more is 9.', target: 'card' },
      { line: WORDS.nowTry, holdMs: 300, target: 'card' },
    ],
  },
  fair: {
    key: 'oddeven:5',
    go: { ...base, key: 'oddeven:5', kind: 'fair', n: 5, answer: 0, parts: ['5', 'fish'], spoken: spokenFor('fair', 5), choices: [1, 0], wrongs: [] },
    steps: [
      { line: 'Watch. 5 fish. Can we share them fairly?', holdMs: 1800 },
      { line: 'The fish go in pairs, one for each chick.', holdMs: 2600, target: 'pile' },
      { line: 'One fish has no partner. So it is not fair. One is left over.', target: 'card' },
      { line: WORDS.nowTry, holdMs: 300, target: 'card' },
    ],
  },
};

/** Every line a demo says, for the voice clips. */
export const demoLines = (): string[] => Object.values(DEMOS).flatMap((d) => d.steps.map((s) => s.line));
