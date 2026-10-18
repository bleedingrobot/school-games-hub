/**
 * Fractions, decimals and percentages that mean the same thing (ladder skill `fdp-equivalents`): fifths, tenths, twentieths and
 * hundredths as percentages and decimals.
 *
 * A number answer (3/5 = ?%) is typed on the pad; picking the fraction or the percentage is always four choices to tap. Wrong
 * choices are the answer a named mistake gives, never a random number. Fractions stay under one.
 *
 * Types: fdp:frac-to-pct  fdp:pct-to-frac  fdp:dec-to-pct  fdp:pct-to-dec  fdp:match
 */
import { isInt, pickOne, show, type Family } from '../banded';
import { oneKey, withMistakes } from './generatedKit';
import { frac, goodPick, pick, rollPick, talk } from './pickKit';

const TAGS = ['MS.Y6.NUM.RN.P3', 'MS.Y6.NUM.RN.P4'];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const reversed = (n: number) => Number(String(n).split('').reverse().join(''));

/** Fractions with an easy percentage: [top, bottom]. */
const FRACTIONS: [number, number][] = [[1, 5], [2, 5], [3, 5], [4, 5], [1, 20], [3, 10], [7, 10], [9, 10]];
const percentOf = (n: number, d: number) => (n * 100) / d;

/** The fraction for each percentage in `pct:pct-to-frac`, and what a student gets by following a named mistake. */
const FRACTION_FOR: Record<number, { right: string; named: Record<string, string> }> = {
  20: { right: '1/5', named: { 'put 1 over the percent': '1/20', 'mixed up with 50%': '1/2', 'mixed up with 25%': '1/4', 'mixed up with 10%': '1/10' } },
  40: { right: '2/5', named: { 'put 1 over the percent': '1/40', 'doubled the right fraction': '4/5', 'put 1 over the tens digit': '1/4', 'mixed up with 50%': '1/2' } },
  60: { right: '3/5', named: { 'put 1 over the percent': '1/60', 'put 1 over the tens digit': '1/6', 'mixed up with 40%': '2/5', 'mixed up with 75%': '3/4' } },
  80: { right: '4/5', named: { 'put 1 over the percent': '1/80', 'put 1 over the tens digit': '1/8', 'mixed up with 75%': '3/4', 'mixed up with 40%': '2/5' } },
  5: { right: '1/20', named: { 'put 1 over the digit': '1/5', 'put 1 over the number with a zero': '1/50', 'mixed up with 50%': '1/2', 'mixed up with 10%': '1/10' } },
  30: { right: '3/10', named: { 'put 1 over the percent': '1/30', 'put 1 over the tens digit': '1/3', 'put it over 100': '3/100', 'counted from the other end': '7/10' } },
  70: { right: '7/10', named: { 'put 1 over the percent': '1/70', 'put 1 over the tens digit': '1/7', 'put it over 100': '7/100', 'counted from the other end': '3/10' } },
  90: { right: '9/10', named: { 'put 1 over the percent': '1/90', 'put 1 over the tens digit': '1/9', 'put it over 100': '9/100', 'counted from the other end': '1/10' } },
};
const FRACTION_PERCENTS = Object.keys(FRACTION_FOR).map(Number);

/** Percentages for the typed percentage-to-decimal and the match question: not the ones other skills already ask. */
const OTHERS = range(1, 99).filter((p) => ![10, 25, 50, 75].includes(p));
const MATCH = range(1, 99).filter((h) => h % 10 !== 0 && h !== 25 && h !== 75);

const families: Family[] = [
  oneKey(
    'fdp:frac-to-pct',
    'A fraction as a percentage (3/5 = 60%)',
    TAGS,
    2,
    (_k, r) => pickOne(r, FRACTIONS),
    (_k, [n, d]) => {
      if (!FRACTIONS.some(([a, b]) => a === n && b === d)) return null;
      const p = percentOf(n, d);
      const parts = [frac(n, d), '=', '?', '%'];
      return withMistakes(
        { parts, spoken: talk(parts), answer: p },
        {
          'used the bottom number': d,
          'used the top number': n,
          'gave the part that is left': 100 - p,
          'ten times too big': p * 10,
          'ten times too small': p / 10,
          'multiplied the top number by 10': n * 10,
        },
      );
    },
  ),
  oneKey(
    'fdp:pct-to-frac',
    'A percentage as a fraction (60% = 3/5)',
    TAGS,
    3,
    (_k, r) => [pickOne(r, FRACTION_PERCENTS), ...rollPick(r)],
    (_k, [p, slot, salt]) => {
      const f = FRACTION_FOR[p];
      if (!f || !goodPick(slot, salt)) return null;
      const parts = [`${p}%`, '=', '?'];
      return pick({ parts, spoken: talk(parts), fact: `${p}% = ${f.right}` }, f.right, f.named, { slot, salt });
    },
  ),
  oneKey(
    'fdp:dec-to-pct',
    'A decimal as a percentage (0.35 = 35%)',
    TAGS,
    1,
    (_k, r) => [pickOne(r, range(1, 99))],
    (_k, [h]) => {
      if (!isInt(h, 1, 99)) return null;
      const parts = [show(h / 100), '=', '?', '%'];
      return withMistakes(
        { parts, spoken: talk(parts), answer: h, input: 'decimal' },
        {
          'moved the point one place only': h / 10,
          'did not move the point': h / 100,
          'moved the point three places': h * 10,
          ...(h >= 10 && h % 11 !== 0 && h % 10 !== 0 ? { 'swapped the digits': reversed(h) } : {}),
        },
      );
    },
  ),
  oneKey(
    'fdp:pct-to-dec',
    'A percentage as a decimal (35% = 0.35)',
    TAGS,
    1,
    (_k, r) => [pickOne(r, OTHERS)],
    (_k, [p]) => {
      if (!OTHERS.includes(p)) return null;
      const parts = [`${p}%`, '=', '?'];
      return withMistakes(
        { parts, spoken: talk(parts), answer: p / 100, input: 'decimal' },
        {
          'moved the point one place only': p / 10,
          'did not move the point': p,
          'moved the point three places': p / 1000,
          ...(p >= 10 && p % 11 !== 0 && p % 10 !== 0 ? { 'swapped the digits': Number(`0.${reversed(p)}`) } : {}),
        },
      );
    },
  ),
  oneKey(
    'fdp:match',
    'Which percentage is the same as the decimal? (0.35 = 35%)',
    TAGS,
    3,
    (_k, r) => [pickOne(r, MATCH), ...rollPick(r)],
    (_k, [h, slot, salt]) => {
      if (!MATCH.includes(h) || !goodPick(slot, salt)) return null;
      const right = `${h}%`;
      const parts = [show(h / 100), '=', '?'];
      return pick(
        { parts, spoken: talk(parts), fact: `${show(h / 100)} = ${right}` },
        right,
        {
          'did not move the point': `${show(h / 100)}%`,
          'moved the point one place only': `${show(h / 10)}%`,
          'moved the point three places': `${h * 10}%`,
          ...(h >= 10 && h % 11 !== 0 ? { 'swapped the digits': `${reversed(h)}%` } : {}),
        },
        { slot, salt },
      );
    },
  ),
];

export const FDP_FAMILIES: Record<string, Family> = Object.fromEntries(families.map((f) => [f.keys[0], f]));

export const FDP_SKILL_KEYS = {
  'fdp-equivalents': ['fdp:frac-to-pct', 'fdp:pct-to-frac', 'fdp:dec-to-pct', 'fdp:pct-to-dec', 'fdp:match'],
};
