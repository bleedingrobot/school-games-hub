/**
 * The generated skills of the ladder as one pack: bonds to 100 and 1000, rounding, times with tens and hundreds, factor
 * pairs, squares and cubes, and order of operations. They make endless questions, so a mastery record is a question TYPE
 * (see generatedKit.ts for the key format), kept in the same table as the facts under the pack name "generated".
 *
 * The pack's families sit outside every band: only the auto ladder and a focus ask for them, so Maths Monsters and the
 * other games that ask by band are unchanged.
 *
 * `solveGenerated` is what the server uses to mark an answer it did not see being asked: it reads the question's parts
 * back into a type and numbers, builds the question again from them, and only accepts it if it comes out exactly as shown.
 */
import { BandedPack, tidy, type Family, type PackDefinition } from '../banded';
import { quickMsForPack } from '../config';
import type { FactStats } from '../leitner';
import { BEDMAS_FAMILIES, BEDMAS_KEYS, parseBedmas } from './bedmas';
import { RECORD_KEY, sameParts, type Parser } from './generatedKit';
import { PLACE_FAMILIES, PLACE_SKILL_KEYS, parsePlace } from './placeSkills';
import { ROUNDING_FAMILIES, ROUNDING_SKILL_KEYS, parseRounding } from './rounding';

const families: Record<string, Family> = { ...PLACE_FAMILIES, ...ROUNDING_FAMILIES, ...BEDMAS_FAMILIES };

for (const key of Object.keys(families)) if (!RECORD_KEY.test(key)) throw new Error(`generated skill key "${key}" is not a valid record key`);

export const GENERATED: PackDefinition = {
  id: 'generated',
  label: 'Place value, rounding and order of operations',
  families,
  bands: [],
  ladderOnly: Object.keys(families),
  quickMs: quickMsForPack('generated'),
};

export const generatedPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(GENERATED, saved, random, now);

/** The question types of each ladder skill built here, in the order the skills are asked. */
export const GENERATED_SKILL_KEYS = {
  ...PLACE_SKILL_KEYS,
  ...ROUNDING_SKILL_KEYS,
  bedmas: BEDMAS_KEYS,
} as const;

/** Every question type this pack owns. */
export const GENERATED_KEYS: ReadonlySet<string> = new Set(Object.keys(families));

export const isGeneratedKey = (key: string) => GENERATED_KEYS.has(key);

const PARSERS: Parser[] = [parseRounding, parsePlace, parseBedmas];

/**
 * A question as it was shown (its parts) worked out again: its right answer and the record it counts towards.
 * Null if no generated skill asks that question.
 */
export function solveGenerated(parts: readonly string[]): { answer: number; key: string } | null {
  for (const parse of PARSERS) {
    const found = parse(parts);
    if (!found) continue;
    const made = families[found.key]?.make(found.key, found.params);
    if (made && sameParts(made.parts, parts)) return { answer: tidy(made.answer), key: found.key };
  }
  return null;
}
