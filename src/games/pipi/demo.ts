/**
 * "Show me first": the first time an altogether go or a two tides go comes up, Pipi shows one made-up go before the child's own
 * (plan: docs/plans/maths-review-2/S31-show-me-first-older-games.md, Part 3, and the pattern of S12). The example is a split
 * chosen to be none of the splits in today's round, so a demo can never be the answer to a go the child is about to get.
 * The lines have no numbers in them, so they are the same clips for every child.
 */
import type { DemoStep } from '../../kit/useKindDemo';
import { LEVELS, parseKey, showGo, type Go, type Kind, type Round } from '../../../shared/pipi/round';
import { WORDS } from './words';

export type DemoKind = Extract<Kind, 'altogether' | 'twoTides'>;
export const DEMO_KINDS: readonly string[] = ['altogether', 'twoTides'];

/** `target` 'shell': the hand points at the right shell. */
export const DEMO_STEPS: Record<DemoKind, DemoStep[]> = {
  altogether: [
    { line: 'Watch. Some pipi are here, and some popped up.' },
    { line: 'Count all of them together.' },
    { line: 'That is how many altogether. Tap its shell.', target: 'shell' },
    { line: WORDS.nowTry, holdMs: 300, target: 'shell' },
  ],
  twoTides: [
    { line: 'Watch. Some pipi are showing. Then the tide comes in.' },
    { line: 'Splash! The ones that popped up now show, and the others dig in.' },
    { line: 'Now count the pipi that are hiding. Tap their shell.', target: 'shell' },
    { line: WORDS.nowTry, holdMs: 300, target: 'shell' },
  ],
};

/** Every line a demo says, for the voice clips. */
export const demoLines = (): string[] => Object.values(DEMO_STEPS).flatMap((steps) => steps.map((s) => s.line));

/** The key of a made-up example: a split of the child's level that is not one of this round's goes. */
export function demoKey(round: Pick<Round, 'level' | 'goes'>): string {
  const { from, to } = LEVELS.find((l) => l.level === round.level) ?? LEVELS[0];
  const used = new Set(round.goes.map((g) => g.key));
  for (let w = from; w <= to; w++) {
    for (let s = 1; s < w; s++) if (!used.has(`part${w}:${s}`)) return `part${w}:${s}`;
  }
  // Every split of the level is in the round (not possible with ten goes): a split of another level.
  return round.level === 1 ? 'part6:2' : 'part4:2';
}

/** The made-up go itself, with the full help a first look gets. */
export function demoGo(kind: DemoKind, round: Pick<Round, 'level' | 'goes'>): Go {
  const key = demoKey(round);
  const go = showGo({ seed: 1 }, 0, { key, kind, h: 'full' });
  if (!go || !parseKey(key)) throw new Error(`No demo for ${key}`);
  return go;
}
