/**
 * The Year 6 skills (docs/plans/ladder-y6/PLAN.md) and Year 5 skills (docs/plans/ladder-y5/PLAN.md), card by card, gathered for generated.ts, ladder.ts, slow.ts and
 * skillNames.ts the way y78.ts gathers the Year 7-8 ones. Each card is one file; its rows say where on the ladder they go.
 */
import type { Family } from '../banded';
import { CHANCE_FAMILIES, CHANCE_LADDER, CHANCE_SKILL_KEYS, CHANCE_SLOW_KEYS } from './y6Chance';
import { MEASURE_FAMILIES, MEASURE_LADDER, MEASURE_SKILL_KEYS, MEASURE_SLOW_KEYS } from './y6Measure';
import { NUMBER_FAMILIES, NUMBER_LADDER, NUMBER_SKILL_KEYS, NUMBER_SLOW_KEYS } from './y6Number';
import { SHAPE_FAMILIES, SHAPE_LADDER, SHAPE_SKILL_KEYS, SHAPE_SLOW_KEYS } from './y6Shape';
import { TIME_FAMILIES, TIME_LADDER, TIME_SKILL_KEYS, TIME_SLOW_KEYS } from './y6Time';
import type { Y6Row } from './y6Row';
import { Y5_FRACTION_FAMILIES, Y5_FRACTION_LADDER, Y5_FRACTION_SKILL_KEYS, Y5_FRACTION_SLOW_KEYS } from './y5Fraction';
import { Y5_MEASURE_FAMILIES, Y5_MEASURE_LADDER, Y5_MEASURE_SKILL_KEYS, Y5_MEASURE_SLOW_KEYS } from './y5Measure';
import { Y5_NUMBER_FAMILIES, Y5_NUMBER_LADDER, Y5_NUMBER_SKILL_KEYS, Y5_NUMBER_SLOW_KEYS } from './y5Number';

export type { Y6Row } from './y6Row';

const CARDS: { families: Record<string, Family>; keys: Record<string, readonly string[]>; slow: readonly string[]; ladder: readonly Y6Row[] }[] = [
  { families: NUMBER_FAMILIES, keys: NUMBER_SKILL_KEYS, slow: NUMBER_SLOW_KEYS, ladder: NUMBER_LADDER },
  { families: TIME_FAMILIES, keys: TIME_SKILL_KEYS, slow: TIME_SLOW_KEYS, ladder: TIME_LADDER },
  { families: MEASURE_FAMILIES, keys: MEASURE_SKILL_KEYS, slow: MEASURE_SLOW_KEYS, ladder: MEASURE_LADDER },
  { families: SHAPE_FAMILIES, keys: SHAPE_SKILL_KEYS, slow: SHAPE_SLOW_KEYS, ladder: SHAPE_LADDER },
  { families: CHANCE_FAMILIES, keys: CHANCE_SKILL_KEYS, slow: CHANCE_SLOW_KEYS, ladder: CHANCE_LADDER },
  // Year 5 cards (docs/plans/ladder-y5/PLAN.md, James's picks 26 Nov 2026): rows carry `year: 5`.
  { families: Y5_NUMBER_FAMILIES, keys: Y5_NUMBER_SKILL_KEYS, slow: Y5_NUMBER_SLOW_KEYS, ladder: Y5_NUMBER_LADDER },
  { families: Y5_FRACTION_FAMILIES, keys: Y5_FRACTION_SKILL_KEYS, slow: Y5_FRACTION_SLOW_KEYS, ladder: Y5_FRACTION_LADDER },
  { families: Y5_MEASURE_FAMILIES, keys: Y5_MEASURE_SKILL_KEYS, slow: Y5_MEASURE_SLOW_KEYS, ladder: Y5_MEASURE_LADDER },
];

export const Y6_FAMILIES: Record<string, Family> = Object.assign({}, ...CARDS.map((c) => c.families));
export const Y6_SKILL_KEYS: Record<string, readonly string[]> = Object.assign({}, ...CARDS.map((c) => c.keys));
export const Y6_SLOW_KEYS: readonly string[] = CARDS.flatMap((c) => c.slow);
export const Y6_LADDER: readonly Y6Row[] = CARDS.flatMap((c) => c.ladder);
export const Y6_TINY: Record<string, string> = Object.fromEntries(Y6_LADDER.map((r) => [r.id, r.tiny]));
