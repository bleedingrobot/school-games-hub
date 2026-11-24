/**
 * The Year 7 and 8 skills, gathered from each card's file (docs/plans/ladder-7-8/PLAN.md, BUILD-SPEC.md). The ladder takes
 * the rows in `Y78_LADDER`: every Year 7 skill first (card by card), then every Year 8 one. A new card adds its file here.
 */
import type { Family } from "../banded";
import {
  DATA_FAMILIES,
  DATA_LADDER,
  DATA_SKILL_KEYS,
  DATA_SLOW_KEYS,
} from "./dataSkills";
import {
  POWER_FAMILIES,
  POWER_LADDER,
  POWER_SKILL_KEYS,
  POWER_SLOW_KEYS,
} from "./powerSkills";
import {
  ALGEBRA_FAMILIES,
  ALGEBRA_LADDER,
  ALGEBRA_SKILL_KEYS,
  ALGEBRA_SLOW_KEYS,
} from "./algebraSkills";
import {
  NUMFACT_FAMILIES,
  NUMFACT_LADDER,
  NUMFACT_SKILL_KEYS,
  NUMFACT_SLOW_KEYS,
} from "./numberFactSkills";
import {
  MEASURE_FAMILIES,
  MEASURE_LADDER,
  MEASURE_SKILL_KEYS,
  MEASURE_SLOW_KEYS,
} from "./measureSkills";
import {
  INTEGER_FAMILIES,
  INTEGER_LADDER,
  INTEGER_SKILL_KEYS,
  INTEGER_SLOW_KEYS,
} from "./integerSkills";

export type Y78Stage =
  | "integers"
  | "place-value"
  | "fractions-decimals-percentages"
  | "algebra"
  | "measurement-geometry"
  | "data-chance";

export interface Y78Row {
  id: string;
  label: string;
  /** 20 characters or fewer, for tight spaces (skillNames.ts). */
  tiny: string;
  stage: Y78Stage;
  year: 7 | 8;
  tags: readonly string[];
}

const CARDS: {
  families: Record<string, Family>;
  keys: Record<string, readonly string[]>;
  slow: readonly string[];
  ladder: readonly Y78Row[];
}[] = [
  {
    families: INTEGER_FAMILIES,
    keys: INTEGER_SKILL_KEYS,
    slow: INTEGER_SLOW_KEYS,
    ladder: INTEGER_LADDER,
  },
  {
    families: POWER_FAMILIES,
    keys: POWER_SKILL_KEYS,
    slow: POWER_SLOW_KEYS,
    ladder: POWER_LADDER,
  },
  {
    families: NUMFACT_FAMILIES,
    keys: NUMFACT_SKILL_KEYS,
    slow: NUMFACT_SLOW_KEYS,
    ladder: NUMFACT_LADDER,
  },
  {
    families: ALGEBRA_FAMILIES,
    keys: ALGEBRA_SKILL_KEYS,
    slow: ALGEBRA_SLOW_KEYS,
    ladder: ALGEBRA_LADDER,
  },
  {
    families: MEASURE_FAMILIES,
    keys: MEASURE_SKILL_KEYS,
    slow: MEASURE_SLOW_KEYS,
    ladder: MEASURE_LADDER,
  },
  {
    families: DATA_FAMILIES,
    keys: DATA_SKILL_KEYS,
    slow: DATA_SLOW_KEYS,
    ladder: DATA_LADDER,
  },
];

export const Y78_FAMILIES: Record<string, Family> = Object.assign(
  {},
  ...CARDS.map((c) => c.families),
);
export const Y78_SKILL_KEYS: Record<string, readonly string[]> = Object.assign(
  {},
  ...CARDS.map((c) => c.keys),
);
export const Y78_SLOW_KEYS: readonly string[] = CARDS.flatMap((c) => c.slow);
const rows = CARDS.flatMap((c) => c.ladder);
export const Y78_LADDER: readonly Y78Row[] = [
  ...rows.filter((r) => r.year === 7),
  ...rows.filter((r) => r.year === 8),
];
export const Y78_TINY: Record<string, string> = Object.fromEntries(
  rows.map((r) => [r.id, r.tiny]),
);
