/**
 * Skills that are not timed (James, 23 Nov 2026): a right answer marks the fact off however long it took. These are questions
 * a student works out rather than recalls (rounding, order of operations, a percentage of an amount), and the hands-on junior
 * games where the answer is dragged or built (number lines, bundles, arrays). Facts to recall (number facts, doubles, skip
 * counting, times tables, bonds) stay timed: quick recall is the point of them.
 *
 * To time a skill again, take its id out of the list.
 */
import { LONGEST_ANSWER_MS, UNTIMED_PACK_IDS } from './config';
import { LADDER } from './ladder';

export const UNTIMED_SKILLS: readonly string[] = [
  // Worked out, not recalled.
  'round-10-100',
  'round-1000',
  'round-big',
  'factor-pairs',
  'fraction-of',
  'percent-of',
  'whole-from-fraction',
  'bedmas',
  // Hands-on junior games: the answer is dragged, built or counted out.
  'number-line-100',
  'number-line-1000',
  'balance-10',
  'balance-20',
  'true-false',
  'bundles-50',
  'place-value-100',
  'regroup-100',
  'ten-more-less-100',
  'place-value-1000',
  'equal-rows',
  'arrays-turn',
  'sharing-rows',
  'cut-arrays',
  'count-out-10',
  'count-out-20',
];

/**
 * Whole packs that are not timed: the topic packs of Maths Monsters and Dragon Maths (word problems with money, patterns,
 * place value, fractions and decimals) and Clans' quests. Their questions take reading.
 */
export const UNTIMED_PACKS = UNTIMED_PACK_IDS;

/** The quick time that makes any kept answer quick: every answer time is kept as at most this. */
export const UNTIMED_MS = LONGEST_ANSWER_MS;

const untimedKeys = new Set(LADDER.filter((s) => UNTIMED_SKILLS.includes(s.id)).flatMap((s) => s.keys));

/** True when a right answer to this key marks it off however long it took. */
export const isUntimed = (key: string, pack?: string | null) => (!!pack && UNTIMED_PACKS.includes(pack)) || untimedKeys.has(key);
