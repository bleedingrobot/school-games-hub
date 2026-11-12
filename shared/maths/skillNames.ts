/**
 * Short skill names (20 characters at most) for tight places such as the teacher's Skill map headers. The full name stays in
 * `LadderSkill.label` and is shown in tooltips, screen-reader text and the detail panel. A new ladder skill whose
 * `skillShortLabel` is longer than 20 characters needs a line here (ladder.test.ts checks every built skill).
 */
import { skillShortLabel } from './focus';

export const TINY_LABEL_MAX = 20;

const TINY: Record<string, string> = {
  'parts-5': 'Parts of 5',
  'parts-10': 'Parts of 10',
  'dbl-half-10': 'Doubles, halves 10',
  'ten-and': '10 and a number',
  'dbl-half-20': 'Doubles, halves 20',
  'odd-even': 'Odd and even to 20',
  'skip-10-past-100': 'Count 10s past 100',
  'skip-from': 'Count on from 3, 13…',
  'ten-more-less-teens': '10 more, less teens',
  'number-line-100': 'Number line to 100',
  'ten-more-less': '10 more, less to 100',
  'number-line-1000': 'Number line to 1000',
  'balance-10': '= missing number',
  'balance-20': '= both sides',
  'true-false': '= true or false',
  'bundles-50': 'Tens and ones to 50',
  'place-value-100': 'Tens and ones to 100',
  'regroup-100': 'Tying bundles',
  'ten-more-less-100': '10 more, less bundle',
  'place-value-1000': 'Hundreds, tens, ones',
  'equal-rows': 'Equal rows',
  'arrays-turn': 'Turning an array',
  'sharing-rows': 'Sharing into rows',
  'cut-arrays': 'Cutting arrays',
  'count-out-10': 'Counting sets to 10',
  'count-out-20': 'Counting sets to 20',
  'count-on': 'One more',
  'round-10-100': 'Round to 10 and 100',
  'bonds-1000': 'Hundreds to 1000',
  'unit-fraction-of': 'Unit fraction of',
  'fraction-bonds': 'Fractions to make 1',
  'times-tens': '× tens (30 × 4)',
  tenths: 'Tenths',
  'add-tenths': 'Adding tenths',
  'round-1000': 'Round to 1000',
  'round-big': 'Round big numbers',
  'decimal-equivalents': 'Fraction to decimal',
  'decimal-bonds': 'Decimals to make 1',
  'fraction-of': 'Fractions of amounts',
  'times-decimals': '×10 ×100 decimals',
  'equivalent-fractions': 'Equivalent fractions',
  'squares-cubes': 'Squares and cubes',
  'round-million': 'Round to a million',
  'fdp-equivalents': 'Fraction, decimal, %',
  'percent-of': 'Percent of',
  'whole-from-fraction': 'Whole from fraction',
};

/** "Facts to 10", "×6 ×9": the shortest name for a skill. */
export function skillTinyLabel(id: string): string {
  return TINY[id] ?? skillShortLabel(id).replace(/^Number facts/, 'Facts').replace(/^Counting in /, 'Count in ');
}
