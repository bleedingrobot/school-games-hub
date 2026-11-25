/**
 * The Year 6 skills (docs/plans/ladder-y6/PLAN.md), card by card, gathered for generated.ts, ladder.ts, slow.ts and
 * skillNames.ts the way y78.ts gathers the Year 7-8 ones. Each card is one file; its rows say where on the ladder they go.
 */
import type { Family } from '../banded';
import { CHANCE_FAMILIES, CHANCE_LADDER, CHANCE_SKILL_KEYS, CHANCE_SLOW_KEYS } from './y6Chance';
import { MEASURE_FAMILIES, MEASURE_LADDER, MEASURE_SKILL_KEYS, MEASURE_SLOW_KEYS } from './y6Measure';
import { NUMBER_FAMILIES, NUMBER_LADDER, NUMBER_SKILL_KEYS, NUMBER_SLOW_KEYS } from './y6Number';
import { SHAPE_FAMILIES, SHAPE_LADDER, SHAPE_SKILL_KEYS, SHAPE_SLOW_KEYS } from './y6Shape';
import { TIME_FAMILIES, TIME_LADDER, TIME_SKILL_KEYS, TIME_SLOW_KEYS } from './y6Time';
import type { Y6Row } from './y6Row';

export type { Y6Row } from './y6Row';

const CARDS: { families: Record<string, Family>; keys: Record<string, readonly string[]>; slow: readonly string[]; ladder: readonly Y6Row[] }[] = [
  { families: NUMBER_FAMILIES, keys: NUMBER_SKILL_KEYS, slow: NUMBER_SLOW_KEYS, ladder: NUMBER_LADDER },
  { families: TIME_FAMILIES, keys: TIME_SKILL_KEYS, slow: TIME_SLOW_KEYS, ladder: TIME_LADDER },
  { families: MEASURE_FAMILIES, keys: MEASURE_SKILL_KEYS, slow: MEASURE_SLOW_KEYS, ladder: MEASURE_LADDER },
  { families: SHAPE_FAMILIES, keys: SHAPE_SKILL_KEYS, slow: SHAPE_SLOW_KEYS, ladder: SHAPE_LADDER },
  { families: CHANCE_FAMILIES, keys: CHANCE_SKILL_KEYS, slow: CHANCE_SLOW_KEYS, ladder: CHANCE_LADDER },
];

export const Y6_FAMILIES: Record<string, Family> = Object.assign({}, ...CARDS.map((c) => c.families));
export const Y6_SKILL_KEYS: Record<string, readonly string[]> = Object.assign({}, ...CARDS.map((c) => c.keys));
export const Y6_SLOW_KEYS: readonly string[] = CARDS.flatMap((c) => c.slow);
export const Y6_LADDER: readonly Y6Row[] = CARDS.flatMap((c) => c.ladder);
export const Y6_TINY: Record<string, string> = Object.fromEntries(Y6_LADDER.map((r) => [r.id, r.tiny]));
