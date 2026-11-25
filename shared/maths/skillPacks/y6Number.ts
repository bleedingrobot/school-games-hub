/**
 * Year 6 ladder skills: Number (docs/plans/ladder-y6/PLAN.md). Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 * James, 25 Nov 2026: fluency, not working out. Easier copies of Year 7 topics, friendly numbers, one number or one tap.
 *
 * Types:
 *   round-huge     huge:tenk  huge:hundredk
 *   remainders     rem:left  rem:times
 *   thousandths    thou:times  thou:divide  thou:frac
 *   decimal-order  dorder:biggest  dorder:smallest
 */
import { int, isInt, show, type Family } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { goodPick, pick, rollPick, talk } from './pickKit';
import type { Y6Row } from './y6Row';

const roundTo = (n: number, unit: number) => Math.floor((n + unit / 2) / unit) * unit;

/** A decimal answer is only a real slip if it still reads exactly (nothing smaller than a thousandth). */
const exact = (named: Named): Named => Object.fromEntries(Object.entries(named).filter(([, v]) => v >= 0.001 && Math.abs(Math.round(v * 1000) / 1000 - v) < 1e-9));

// ---------------------------------------------------------------- round-huge: the nearest 10 000 and 100 000

const HUGE_TAGS = ['MS.Y6.NUM.NS.P3'];
const unitText = (unit: number) => `to the nearest ${unit === 10000 ? 'ten thousand' : 'hundred thousand'}`;

function hugeFamily(key: string, label: string, unit: number, lo: number, hi: number): Family {
  const ok = (n: number) => isInt(n, lo, hi) && n % unit !== 0 && n % unit !== unit / 2;
  return oneKey(
    key,
    label,
    HUGE_TAGS,
    1,
    (_k, r) => {
      for (;;) {
        const n = int(r, lo, hi);
        if (ok(n)) return [n];
      }
    },
    (_k, [n]) => {
      if (!ok(n)) return null;
      const down = n - (n % unit);
      const answer = n % unit > unit / 2 ? down + unit : down;
      const named: Named = {
        'rounded the wrong way': answer === down ? down + unit : down,
        'rounded to a smaller place': roundTo(n, unit / 10),
        ...(unit < 100000 ? { 'rounded to a bigger place': roundTo(n, unit * 10) } : {}),
        'rounded to the thousands': roundTo(n, 1000),
        'kept the digits': n,
      };
      return withMistakes(
        { parts: ['Round', show(n), unitText(unit), '=', '?'], spoken: `Round ${n} ${unitText(unit)}. What is it?`, answer, fact: `${show(n)} rounded ${unitText(unit)} is ${show(answer)}` },
        named,
      );
    },
  );
}

const hugeFamilies = [
  hugeFamily('huge:tenk', 'Rounding to the nearest 10 000', 10000, 10001, 999999),
  hugeFamily('huge:hundredk', 'Rounding to the nearest 100 000', 100000, 100001, 999999),
];

// ---------------------------------------------------------------- remainders: 38 ÷ 5 = 7 r 3

const REM_TAGS = ['MS.Y6.NUM.OP.P5', 'MS.Y6.NUM.OP.P6'];
const rollRem = (_k: string, r: () => number) => {
  const d = int(r, 2, 9);
  return [d, int(r, 2, 10), int(r, 1, d - 1)];
};
const goodRem = (d: number, q: number, rem: number) => isInt(d, 2, 9) && isInt(q, 2, 10) && isInt(rem, 1, d - 1);

const remFamilies = [
  oneKey('rem:left', 'The remainder (38 ÷ 5 = 7 r ?)', REM_TAGS, 3, rollRem, (_k, [d, q, rem]) => {
    if (!goodRem(d, q, rem)) return null;
    const n = d * q + rem;
    // 'r' rides with the number so it shows small, like the 'r' after the blank in rem:times.
    const parts = [String(n), '÷', String(d), '=', `${q} r`, '?'];
    return withMistakes(
      { parts, spoken: `${n} divided by ${d} equals ${q} remainder what?`, answer: rem, fact: `${n} ÷ ${d} = ${q} r ${rem}` },
      { 'counted the gap to the next multiple': d - rem, 'gave the answer to the division': q, 'one too many': rem + 1, 'one too few': rem - 1, 'gave the number divided by': d },
    );
  }),
  oneKey('rem:times', 'How many whole groups (38 ÷ 5 = ? r 3)', REM_TAGS, 3, rollRem, (_k, [d, q, rem]) => {
    if (!goodRem(d, q, rem)) return null;
    const n = d * q + rem;
    const parts = [String(n), '÷', String(d), '=', '?', 'r', String(rem)];
    return withMistakes(
      { parts, spoken: `${n} divided by ${d} equals what remainder ${rem}?`, answer: q, fact: `${n} ÷ ${d} = ${q} r ${rem}` },
      { 'rounded up': q + 1, 'one too few': q - 1, 'gave the remainder': rem, 'two too many': q + 2, 'gave the number divided by': d },
    );
  }),
];

// ---------------------------------------------------------------- thousandths: x1000, ÷1000, ?/1000

const THOU_TAGS = ['MS.Y6.NUM.RN.P1', 'MS.Y6.NUM.RN.P5'];
/** A decimal as k over 10^dp, with a last digit that is not zero (4.7, 0.25, 0.006). */
const decOk = (dp: number, k: number, kLo: number, kHi: number) => isInt(dp, 1, 3) && isInt(k, kLo, kHi) && k % 10 !== 0;
const dpText = (dp: number, k: number) => show(k / 10 ** dp);
const rollDec = (kLo: (dp: number) => number, kHi: (dp: number) => number = () => 99) => (_k: string, r: () => number) => {
  for (;;) {
    const dp = int(r, 1, 3);
    const k = int(r, kLo(dp), kHi(dp));
    if (k % 10 !== 0) return [dp, k];
  }
};

const thouFamilies = [
  oneKey('thou:times', 'Times 1000 (4.7 × 1000)', THOU_TAGS, 2, rollDec((dp) => (dp === 3 ? 2 : 11)), (_k, [dp, k]) => {
    if (!decOk(dp, k, dp === 3 ? 2 : 11, 99)) return null;
    const value = k / 10 ** dp;
    const answer = k * 10 ** (3 - dp);
    const parts = [dpText(dp, k), '×', '1000', '=', '?'];
    return withMistakes(
      { parts, spoken: talk(parts), answer, input: 'decimal', fact: `${dpText(dp, k)} × 1000 = ${show(answer)}` },
      exact({ 'moved the point the wrong way': value / 1000, 'moved it only 2 places': value * 100, 'moved it only 1 place': value * 10, 'moved it 4 places': value * 10000, 'did not move the point': value }),
    );
  }),
  oneKey('thou:divide', 'Divide by 1000 (3500 ÷ 1000)', THOU_TAGS, 2, rollDec((dp) => (dp === 2 ? 11 : 2)), (_k, [dp, k]) => {
    if (!decOk(dp, k, dp === 2 ? 11 : 2, 99)) return null;
    // dp is how many places the answer has: 1 → n = k × 100, 2 → n = k × 10, 3 → n = k.
    const n = k * 10 ** (3 - dp);
    const value = n / 1000;
    const parts = [show(n), '÷', '1000', '=', '?'];
    return withMistakes(
      { parts, spoken: talk(parts), answer: value, input: 'decimal', fact: `${show(n)} ÷ 1000 = ${show(value)}` },
      exact({ 'moved the point the wrong way': n * 1000, 'moved it only 2 places': n / 100, 'moved it only 1 place': n / 10, 'moved it 4 places': n / 10000, 'did not move the point': n }),
    );
  }),
  oneKey('thou:frac', 'A decimal as thousandths (0.035 = ?/1000)', THOU_TAGS, 2, rollDec((dp) => (dp === 1 ? 1 : 11), (dp) => (dp === 1 ? 9 : 99)), (_k, [dp, k]) => {
    if (!isInt(dp, 1, 3) || !isInt(k, dp === 1 ? 1 : 11, dp === 1 ? 9 : 99) || (dp > 1 && k % 10 === 0)) return null;
    const answer = k * 10 ** (3 - dp);
    const parts = [dpText(dp, k), '=', '?/1000'];
    return withMistakes(
      { parts, spoken: talk(parts), answer, fact: `${dpText(dp, k)} = ${answer}/1000` },
      { 'one zero too few': answer / 10, 'one zero too many': answer * 10, 'two zeros too many': answer * 100, 'wrote the digits only': k, 'two zeros too few': answer / 100 },
    );
  }),
];

// ---------------------------------------------------------------- decimal-order: biggest and smallest of four

const DORDER_TAGS = ['MS.Y6.NUM.RN.P2'];

/** Sets of four decimals between 0 and 1 where "longer means bigger" or "shorter means smaller" is a trap. */
const SETS: number[][] = [
  [0.45, 0.405, 0.5, 0.054],
  [0.3, 0.28, 0.275, 0.09],
  [0.6, 0.65, 0.065, 0.605],
  [0.7, 0.07, 0.077, 0.707],
  [0.2, 0.25, 0.205, 0.052],
  [0.8, 0.08, 0.88, 0.808],
  [0.4, 0.34, 0.043, 0.304],
  [0.9, 0.19, 0.099, 0.91],
  [0.5, 0.15, 0.055, 0.51],
  [0.1, 0.12, 0.102, 0.021],
  [0.35, 0.3, 0.053, 0.305],
  [0.75, 0.7, 0.075, 0.705],
];

const places = (v: number) => (String(v).split('.')[1] ?? '').length;
const lastDigit = (v: number) => Number(String(v).slice(-1));
const asWhole = (v: number) => Number((String(v).split('.')[1] ?? '0'));
const only = (set: number[], score: (v: number) => number, best: 'max' | 'min') => {
  const top = (best === 'max' ? Math.max : Math.min)(...set.map(score));
  const hits = set.filter((v) => score(v) === top);
  return hits.length === 1 ? hits[0] : null;
};

/** The slip each wrong choice stands for, or null when a wrong choice has no real slip behind it. */
function slips(set: number[], biggest: boolean): Record<string, number> | null {
  const right = biggest ? Math.max(...set) : Math.min(...set);
  const candidates: [string, number | null][] = biggest
    ? [
        ['thought the longest number is the biggest', only(set, places, 'max')],
        ['read the digits as whole numbers', only(set, asWhole, 'max')],
        ['went by the biggest last digit', only(set, lastDigit, 'max')],
        ['thought a number with fewer digits is bigger', only(set, places, 'min')],
        ['picked the smallest', Math.min(...set)],
      ]
    : [
        ['thought the shortest number is the smallest', only(set, places, 'min')],
        ['read the digits as whole numbers', only(set, asWhole, 'min')],
        ['went by the smallest last digit', only(set, lastDigit, 'min')],
        ['thought a number with more digits is smaller', only(set, places, 'max')],
        ['picked the biggest', Math.max(...set)],
      ];
  const named: Record<string, number> = {};
  const used = new Set<number>([right]);
  for (const [name, v] of candidates) {
    if (v === null || used.has(v)) continue;
    used.add(v);
    named[name] = v;
  }
  return Object.keys(named).length >= 3 ? named : null;
}

const goodSets = (biggest: boolean) => SETS.map((_, i) => i).filter((i) => slips(SETS[i], biggest));

function dorderFamily(key: string, biggest: boolean): Family {
  const word = biggest ? 'biggest' : 'smallest';
  const valid = goodSets(biggest);
  return oneKey(key, `The ${word} of four decimals (0.45, 0.405, 0.5, 0.054)`, DORDER_TAGS, 3, (_k, r) => [valid[int(r, 0, valid.length - 1)], ...rollPick(r)], (_k, [i, slot, salt]) => {
    if (!valid.includes(i) || !goodPick(slot, salt)) return null;
    const set = SETS[i];
    const named = slips(set, biggest)!;
    const right = biggest ? Math.max(...set) : Math.min(...set);
    const made = pick(
      { parts: [biggest ? 'Biggest' : 'Smallest', '=', '?'], spoken: `Which of these decimals is the ${word}?`, fact: `${show(right)} is the ${word}` },
      show(right),
      Object.fromEntries(Object.entries(named).map(([name, v]) => [name, show(v)])),
      { slot, salt },
    );
    return made ? { ...made, prompt: `Which is the ${word}?` } : null;
  });
}

const dorderFamilies = [dorderFamily('dorder:biggest', true), dorderFamily('dorder:smallest', false)];

// ---------------------------------------------------------------- the lot

export const NUMBER_FAMILIES: Record<string, Family> = Object.fromEntries([...hugeFamilies, ...remFamilies, ...thouFamilies, ...dorderFamilies].map((f) => [f.keys[0], f]));

export const NUMBER_SKILL_KEYS: Record<string, readonly string[]> = {
  'round-huge': ['huge:tenk', 'huge:hundredk'],
  remainders: ['rem:left', 'rem:times'],
  thousandths: ['thou:times', 'thou:divide', 'thou:frac'],
  'decimal-order': ['dorder:biggest', 'dorder:smallest'],
};

export const NUMBER_SLOW_KEYS: string[] = [];

export const NUMBER_LADDER: readonly Y6Row[] = [
  { id: 'round-huge', label: 'Rounding to the nearest 10 000 and 100 000', tiny: 'Round 10 000s', stage: 'rounding', after: 'round-1000', tags: HUGE_TAGS },
  { id: 'remainders', label: 'Division with a remainder (38 ÷ 5)', tiny: 'Remainders', stage: 'place-value', after: 'factor-pairs', tags: REM_TAGS },
  { id: 'thousandths', label: 'Times and divide by 1000, and thousandths', tiny: '×1000 ÷1000', stage: 'fractions-decimals-percentages', after: 'times-decimals', tags: THOU_TAGS },
  { id: 'decimal-order', label: 'Ordering decimals to 3 places', tiny: 'Order decimals', stage: 'fractions-decimals-percentages', after: 'thousandths', tags: DORDER_TAGS },
];
