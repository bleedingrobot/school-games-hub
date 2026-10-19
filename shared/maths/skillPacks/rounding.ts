/**
 * Rounding, for the ladder skills round-10-100, round-1000, round-big and round-million.
 *
 * One mastery record per question TYPE (see generatedKit.ts). The type says how big the number is and whether it is the tricky
 * "exactly halfway" or "close to halfway" kind:
 *   whole numbers   round:<unit>:<n>digit   round:<unit>:halfway   round:<unit>:near-halfway     (unit 10 to 1 000 000)
 *   decimals        round:whole:tenths  round:whole:hundredths  round:whole:halfway             (to a whole number)
 *                   round:tenth:hundredths  round:tenth:halfway                                  (to a tenth, decimal answer)
 *                   round:hundredth:thousandths  round:hundredth:halfway                         (to a hundredth, decimal answer)
 * Halfway rounds up (65 → 70, 4.15 → 4.2). Wrong choices come from named mistakes: rounding the wrong way, rounding to a
 * smaller or bigger place, and being a whole step out.
 */
import { int, isInt, show, type Family } from '../banded';
import { decimalPlaces, oneKey, readNumber, say, sameParts, withMistakes, type Named, type Parser } from './generatedKit';

const TAG = {
  r10: ['MS.Y3.NUM.NS.P5'],
  r1000: ['MS.Y4.NUM.NS.K4'],
  big: ['MS.Y5.NUM.NS.P3', 'MS.Y5.NUM.NS.P4'],
  million: ['MS.Y6.NUM.NS.P3', 'MS.Y6.NUM.NS.P4'],
};

const roundTo = (n: number, unit: number) => Math.floor((n + unit / 2) / unit) * unit;

// ---------------------------------------------------------------- whole numbers

/** The question type of rounding n to the nearest unit, or null if n is already a multiple of it. */
function wholeKeyOf(unit: number, n: number): string | null {
  const mod = n % unit;
  if (mod === 0) return null;
  const half = unit / 2;
  if (mod === half) return `round:${unit}:halfway`;
  if (Math.abs(mod - half) <= unit / 10) return `round:${unit}:near-halfway`;
  return `round:${unit}:${String(n).length}digit`;
}

const unitText = (unit: number) => `to the nearest ${show(unit)}`;

function wholeFamily(unit: number, suffix: string, lo: number, hi: number, tags: string[], label: string): Family {
  const key = `round:${unit}:${suffix}`;
  const half = unit / 2;
  const zone = unit / 10;
  return oneKey(
    key,
    label,
    tags,
    1,
    (_k, r) => {
      for (;;) {
        let n = int(r, lo, hi);
        if (suffix === 'halfway') n = n - (n % unit) + half;
        else if (suffix === 'near-halfway') n = n - (n % unit) + half + int(r, 1, zone) * (r() < 0.5 ? -1 : 1);
        if (n >= lo && n <= hi && wholeKeyOf(unit, n) === key) return [n];
      }
    },
    (_k, [n]) => {
      if (!isInt(n, lo, hi) || wholeKeyOf(unit, n) !== key) return null;
      const down = n - (n % unit);
      const up = down + unit;
      const answer = n % unit >= half ? up : down;
      const named: Named = {
        'rounded the wrong way': answer === up ? down : up,
        'rounded to a smaller place': unit >= 100 ? roundTo(n, unit / 10) : n,
        'rounded to a bigger place': roundTo(n, unit * 10),
        'one step too far': answer + unit,
        'one step too few': answer - unit,
      };
      const parts = ['Round', show(n), unitText(unit), '=', '?'];
      return withMistakes(
        {
          parts,
          spoken: `Round ${n} ${unitText(unit)}. What is it?`,
          answer,
          fact: `${show(n)} rounded ${unitText(unit)} is ${show(answer)}`,
        },
        named,
      );
    },
  );
}

// ---------------------------------------------------------------- decimals

type DecimalUnit = 'whole' | 'tenth' | 'hundredth';
/** How many units of the answer fit in 1 (a tenth: 10). */
const UNIT_SCALE: Record<DecimalUnit, number> = { whole: 1, tenth: 10, hundredth: 100 };
const UNIT_WORDS: Record<DecimalUnit, string> = { whole: 'to the nearest whole number', tenth: 'to the nearest tenth', hundredth: 'to the nearest hundredth' };

/** The question type of a decimal (written with `dp` places, as m units of 1/10^dp), or null if it ends in 0. */
function decimalKeyOf(unit: DecimalUnit, dp: number, m: number): string | null {
  if (m % 10 === 0) return null;
  const half = m % 10 === 5;
  if (unit === 'whole') {
    if (dp === 1) return half ? 'round:whole:halfway' : 'round:whole:tenths';
    return dp === 2 ? 'round:whole:hundredths' : null;
  }
  if (unit === 'tenth') return dp === 2 ? (half ? 'round:tenth:halfway' : 'round:tenth:hundredths') : null;
  return dp === 3 ? (half ? 'round:hundredth:halfway' : 'round:hundredth:thousandths') : null;
}

interface DecimalSpec {
  key: string;
  unit: DecimalUnit;
  dp: number;
  lo: number;
  hi: number;
  label: string;
  tags: string[];
}

function decimalFamily({ key, unit, dp, lo, hi, label, tags }: DecimalSpec): Family {
  const scale = 10 ** dp;
  const step = scale / UNIT_SCALE[unit];
  const halfway = key.endsWith(':halfway');
  const unitScale = UNIT_SCALE[unit];
  return oneKey(
    key,
    label,
    tags,
    1,
    (_k, r) => {
      for (;;) {
        let m = int(r, lo, hi);
        if (halfway) m = m - (m % 10) + 5;
        if (m >= lo && m <= hi && decimalKeyOf(unit, dp, m) === key) return [m];
      }
    },
    (_k, [m]) => {
      if (!isInt(m, lo, hi) || decimalKeyOf(unit, dp, m) !== key) return null;
      const lower = Math.floor(m / step);
      const upper = lower + 1;
      const up = m % step >= step / 2;
      const answerUnits = up ? upper : lower;
      const answer = answerUnits / unitScale;
      const value = m / scale;
      const shown = show(value);
      const named: Named = { 'rounded the wrong way': (up ? lower : upper) / unitScale };
      if (unit === 'whole') {
        named['one too many'] = answer + 1;
        named['one too few'] = answer - 1;
        named['two too many'] = answer + 2;
      } else {
        // Rounded to the place before (a tenth, or a whole number) instead of this one.
        named[unit === 'tenth' ? 'rounded to a whole number' : 'rounded to a tenth'] = Math.floor((m + 50) / 100) / (unit === 'tenth' ? 1 : 10);
        named['did not round'] = value;
        named['one place too many'] = answer + 1 / unitScale;
        named['one place too few'] = answer - 1 / unitScale;
      }
      const parts = ['Round', shown, UNIT_WORDS[unit], '=', '?'];
      return withMistakes(
        {
          parts,
          spoken: `Round ${say(value)} ${UNIT_WORDS[unit]}. What is it?`,
          answer,
          input: unit === 'whole' ? 'whole' : 'decimal',
          fact: `${shown} rounded ${UNIT_WORDS[unit]} is ${show(answer)}`,
        },
        named,
      );
    },
  );
}

// ---------------------------------------------------------------- the types

const W = wholeFamily;
const D = decimalFamily;

/** Every rounding question type, by key. */
export const ROUNDING_FAMILIES: Record<string, Family> = Object.fromEntries(
  [
    // round-10-100
    W(10, '2digit', 11, 99, TAG.r10, 'Rounding 2-digit numbers to the nearest 10'),
    W(10, '3digit', 101, 999, TAG.r10, 'Rounding 3-digit numbers to the nearest 10'),
    W(10, 'halfway', 15, 995, TAG.r10, 'Rounding to the nearest 10 when the last digit is 5'),
    W(10, 'near-halfway', 14, 996, TAG.r10, 'Rounding to the nearest 10 when the last digit is 4 or 6'),
    W(100, '3digit', 101, 999, TAG.r10, 'Rounding 3-digit numbers to the nearest 100'),
    W(100, '4digit', 1001, 9999, TAG.r10, 'Rounding 4-digit numbers to the nearest 100'),
    W(100, 'halfway', 150, 9950, TAG.r10, 'Rounding to the nearest 100 when it is exactly halfway'),
    W(100, 'near-halfway', 140, 9960, TAG.r10, 'Rounding to the nearest 100 when it is close to halfway'),
    // round-1000
    W(1000, '4digit', 1001, 9999, TAG.r1000, 'Rounding 4-digit numbers to the nearest 1000'),
    W(1000, '5digit', 10001, 99999, TAG.r1000, 'Rounding 5-digit numbers to the nearest 1000'),
    W(1000, 'halfway', 1500, 99500, TAG.r1000, 'Rounding to the nearest 1000 when it is exactly halfway'),
    W(1000, 'near-halfway', 1400, 99600, TAG.r1000, 'Rounding to the nearest 1000 when it is close to halfway'),
    // round-big
    W(10000, '5digit', 10001, 99999, TAG.big, 'Rounding to the nearest 10 000'),
    W(10000, 'halfway', 15000, 95000, TAG.big, 'Rounding to the nearest 10 000 when it is exactly halfway'),
    W(100000, '6digit', 100001, 999999, TAG.big, 'Rounding to the nearest 100 000'),
    W(100000, 'halfway', 150000, 950000, TAG.big, 'Rounding to the nearest 100 000 when it is exactly halfway'),
    D({ key: 'round:whole:tenths', unit: 'whole', dp: 1, lo: 21, hi: 989, label: 'Rounding tenths to a whole number', tags: TAG.big }),
    D({ key: 'round:whole:hundredths', unit: 'whole', dp: 2, lo: 201, hi: 9899, label: 'Rounding hundredths to a whole number', tags: TAG.big }),
    D({ key: 'round:whole:halfway', unit: 'whole', dp: 1, lo: 25, hi: 985, label: 'Rounding to a whole number when the tenths digit is 5', tags: TAG.big }),
    D({ key: 'round:tenth:hundredths', unit: 'tenth', dp: 2, lo: 101, hi: 2999, label: 'Rounding hundredths to the nearest tenth', tags: TAG.big }),
    D({ key: 'round:tenth:halfway', unit: 'tenth', dp: 2, lo: 105, hi: 2995, label: 'Rounding to the nearest tenth when the hundredths digit is 5', tags: TAG.big }),
    // round-million
    W(1000000, '7digit', 1000001, 9999999, TAG.million, 'Rounding to the nearest million'),
    W(1000000, 'halfway', 1500000, 9500000, TAG.million, 'Rounding to the nearest million when it is exactly halfway'),
    W(1000000, 'near-halfway', 1400000, 9600000, TAG.million, 'Rounding to the nearest million when it is close to halfway'),
    W(100000, '7digit', 1000001, 9999999, TAG.million, 'Rounding a 7-digit number to the nearest 100 000'),
    D({ key: 'round:hundredth:thousandths', unit: 'hundredth', dp: 3, lo: 1001, hi: 19999, label: 'Rounding thousandths to the nearest hundredth', tags: TAG.million }),
    D({ key: 'round:hundredth:halfway', unit: 'hundredth', dp: 3, lo: 1005, hi: 19995, label: 'Rounding to the nearest hundredth when the thousandths digit is 5', tags: TAG.million }),
  ].map((f) => [f.keys[0], f]),
);

const WHOLE_UNITS = [10, 100, 1000, 10000, 100000, 1000000];
const DECIMAL_UNITS = Object.entries(UNIT_WORDS) as [DecimalUnit, string][];

/** Reads ['Round', '347', 'to the nearest 100', '=', '?'] back into its type and number. */
export const parseRounding: Parser = (parts) => {
  if (parts.length !== 5 || parts[0] !== 'Round' || parts[3] !== '=' || parts[4] !== '?') return null;
  const n = readNumber(parts[1]);
  if (n === null) return null;
  const check = (key: string | null, params: number[]) => {
    const made = key ? ROUNDING_FAMILIES[key]?.make(key, params) : null;
    return key && made && sameParts(made.parts, parts) ? { key, params } : null;
  };
  const whole = WHOLE_UNITS.find((u) => unitText(u) === parts[2]);
  if (whole !== undefined) return Number.isInteger(n) ? check(wholeKeyOf(whole, n), [n]) : null;
  const decimal = DECIMAL_UNITS.find(([, words]) => words === parts[2]);
  if (!decimal) return null;
  const dp = decimalPlaces(parts[1]);
  const m = Math.round(n * 10 ** dp);
  return check(decimalKeyOf(decimal[0], dp, m), [m]);
};

/** The keys of each ladder skill, in the order they are listed here. */
export const ROUNDING_SKILL_KEYS = {
  'round-10-100': Object.keys(ROUNDING_FAMILIES).filter((k) => /^round:(10|100):/.test(k)),
  'round-1000': Object.keys(ROUNDING_FAMILIES).filter((k) => k.startsWith('round:1000:')),
  'round-big': Object.keys(ROUNDING_FAMILIES).filter((k) => /^round:(10000|100000):(5digit|6digit|halfway)$|^round:whole:|^round:tenth:/.test(k)),
  'round-million': Object.keys(ROUNDING_FAMILIES).filter((k) => /^round:1000000:|^round:100000:7digit$|^round:hundredth:/.test(k)),
};
