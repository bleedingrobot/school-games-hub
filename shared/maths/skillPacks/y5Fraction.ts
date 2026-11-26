/**
 * Year 5 ladder skills: Fraction card (docs/plans/ladder-y5/PLAN.md). Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 * James, 26 Nov 2026: fluency, not working out. Easy, tidy numbers, one number or one tap.
 *
 * Types:
 *   mixed-improper    mix5:top  mix5:whole  mix5:tap
 *   add-hundredths    hund5:add  hund5:take  hund5:cross
 *   money-y5          cash5:total  cash5:change  cash5:near
 *   pattern-decimal   pat5:next  pat5:gap  pat5:step
 *
 * Decimals are built from whole numbers of hundredths (or tenths) so no float dust gets in, and shown with `show`.
 */
import { dollars, int, isInt, pickOne, show, speak, tidy, type Family } from '../banded';
import { oneKey, say, withMistakes, type Named } from './generatedKit';
import { frac, gcd, goodPick, pick, rollPick, talk } from './pickKit';
import type { Y6Row } from './y6Row';

// ---------------------------------------------------------------- mixed-improper: 2 1/3 = ?/3, 11/4 = ?

const MIX_TAGS = ['MS.Y5.NUM.FR.P1'];
const BOTTOMS = [2, 3, 4, 5, 6, 8, 10];
const mixOk = (w: number, d: number, n: number) => isInt(w, 1, 4) && BOTTOMS.includes(d) && isInt(n, 1, d - 1);
const rollMix = (_k: string, r: () => number) => {
  const d = pickOne(r, BOTTOMS);
  return [int(r, 1, 4), d, int(r, 1, d - 1)];
};

const mixTop = oneKey('mix5:top', 'Mixed number to improper fraction (2 1/3 = ?/3)', MIX_TAGS, 3, rollMix, (_k, [w, d, n]) => {
  if (!mixOk(w, d, n)) return null;
  const top = w * d + n;
  const parts = [`${w} ${frac(n, d)}`, '=', `?/${d}`];
  return withMistakes(
    { parts, spoken: speak(parts), answer: top, fact: `${w} ${frac(n, d)} = ${frac(top, d)}` },
    { 'only did the whole times the bottom': w * d, 'added all three numbers': w + n + d, 'copied the top only': n, 'times the whole by the top': w * n, 'added the whole to the top': w + n, 'one too many': top + 1, 'one too few': top - 1 },
  );
});

const mixWhole = oneKey('mix5:whole', 'Wholes in an improper fraction (11/4 = ? 3/4)', MIX_TAGS, 3, rollMix, (_k, [w, d, n]) => {
  if (!mixOk(w, d, n)) return null;
  const top = w * d + n;
  const parts = [frac(top, d), '=', `? ${frac(n, d)}`];
  return withMistakes(
    { parts, spoken: speak(parts), answer: w, fact: `${frac(top, d)} = ${w} ${frac(n, d)}` },
    { 'rounded up': w + 1, 'gave the leftover top': n, 'gave the bottom': d, 'gave the top take the leftover': top - n, 'one too few': w - 1 },
  );
});

const mixTap = oneKey('mix5:tap', 'Improper fraction to mixed number (tap 11/4)', MIX_TAGS, 5, (_k, r) => {
  for (;;) {
    const [w, d, n] = rollMix(_k, r);
    if (gcd(n, d) === 1) return [w, d, n, ...rollPick(r)];
  }
}, (_k, [w, d, n, slot, salt]) => {
  if (!mixOk(w, d, n) || gcd(n, d) !== 1 || !goodPick(slot, salt)) return null;
  const top = w * d + n;
  const label = (a: number, b: number, c: number) => `${a} ${b}/${c}`;
  const named: Record<string, string> = {
    'rounded the whole up': label(w + 1, n, d),
    'flipped the leftover': label(w, d - n, d),
    'put the top over the old bottom': label(w, d, top),
    'kept the top as the bottom': label(w, n, top),
    ...(w < d ? { 'swapped the whole and the leftover': label(n, w, d) } : {}),
  };
  const parts = [frac(top, d), '=', '?'];
  const made = pick({ parts, spoken: `${speak(parts)} Which mixed number?`, fact: `${frac(top, d)} = ${label(w, n, d)}` }, label(w, n, d), named, { slot, salt });
  return made ? { ...made, prompt: 'Which mixed number is it?' } : null;
});

// ---------------------------------------------------------------- add-hundredths: 1.31 + 0.22, 3.75 − 0.5, 4.8 + 0.3

const HUND_TAGS = ['MS.Y5.NUM.RN.P1'];
const d2 = (h: number) => show(tidy(h / 100));
/** The second number of a tidy sum: tenths (0.3, 0.5) or hundredths (0.22), as whole hundredths. */
const rollSecond = (r: () => number) => (r() < 0.5 ? int(r, 1, 9) * 10 : int(r, 11, 99));
const secondOk = (b: number) => isInt(b, 10, 99) && (b % 10 === 0 || b > 10);
const rollFirst = (r: () => number) => int(r, 11, 489);
const firstOk = (a: number) => isInt(a, 11, 489) && a % 10 !== 0 && a % 100 >= 11;
const tens = (h: number) => Math.floor(h / 10) % 10;

const addOk = (a: number, b: number) => firstOk(a) && secondOk(b) && (a % 10) + (b % 10) <= 9 && tens(a) + tens(b) <= 9;
const takeOk = (a: number, b: number) => firstOk(a) && secondOk(b) && (a % 10) >= (b % 10) && tens(a) >= tens(b) && b < a % 100;

/** Named slips as hundredths, made into decimals. */
const hundredths = (named: Record<string, number>): Named => Object.fromEntries(Object.entries(named).map(([k, v]) => [k, tidy(v / 100)]));

const hundAdd = oneKey(
  'hund5:add',
  'Adding hundredths, no carrying (1.31 + 0.22)',
  HUND_TAGS,
  2,
  (_k, r) => {
    for (;;) {
      const a = rollFirst(r);
      const b = rollSecond(r);
      if (addOk(a, b)) return [a, b];
    }
  },
  (_k, [a, b]) => {
    if (!addOk(a, b)) return null;
    const parts = [d2(a), '+', d2(b), '=', '?'];
    const sum = a + b;
    return withMistakes(
      { parts, spoken: talk(parts), answer: tidy(sum / 100), input: 'decimal', fact: `${d2(a)} + ${d2(b)} = ${d2(sum)}` },
      hundredths({
        ...(b % 10 === 0 ? { 'lined the tenths up as hundredths': a + b / 10 } : {}),
        'dropped the whole number': (a % 100) + b,
        'left out the second number': a,
        'took away instead': a - b,
        'a tenth too many': sum + 10,
        'a tenth too few': sum - 10,
        'a hundredth too many': sum + 1,
        'a hundredth too few': sum - 1,
      }),
    );
  },
);

const hundTake = oneKey(
  'hund5:take',
  'Taking away hundredths, no borrowing (3.75 − 0.5)',
  HUND_TAGS,
  2,
  (_k, r) => {
    for (;;) {
      const a = rollFirst(r);
      const b = rollSecond(r);
      if (takeOk(a, b)) return [a, b];
    }
  },
  (_k, [a, b]) => {
    if (!takeOk(a, b)) return null;
    const parts = [d2(a), '−', d2(b), '=', '?'];
    const diff = a - b;
    return withMistakes(
      { parts, spoken: talk(parts), answer: tidy(diff / 100), input: 'decimal', fact: `${d2(a)} − ${d2(b)} = ${d2(diff)}` },
      hundredths({
        ...(b % 10 === 0 ? { 'lined the tenths up as hundredths': a - b / 10 } : {}),
        'added instead': a + b,
        'dropped the whole number': (a % 100) - b,
        'a tenth too many': diff + 10,
        'a tenth too few': diff - 10,
        'a hundredth too many': diff + 1,
        'a hundredth too few': diff - 1,
      }),
    );
  },
);

/** 4.8 + 0.3 or 5.2 − 0.4, in tenths: t is the first number, s the second, sub is 1 for taking away. */
const crossOk = (t: number, s: number, sub: number) => {
  if (!isInt(t, 11, 89) || t % 10 === 0 || !isInt(s, 1, 9) || !isInt(sub, 0, 1)) return false;
  return sub === 0 ? (t % 10) + s >= 10 : (t % 10) < s;
};
const hundCross = oneKey(
  'hund5:cross',
  'Crossing the whole (4.8 + 0.3, 5.2 − 0.4)',
  HUND_TAGS,
  3,
  (_k, r) => {
    for (;;) {
      const t = int(r, 11, 89);
      const s = int(r, 1, 9);
      const sub = int(r, 0, 1);
      if (crossOk(t, s, sub)) return [t, s, sub];
    }
  },
  (_k, [t, s, sub]) => {
    if (!crossOk(t, s, sub)) return null;
    const whole = Math.floor(t / 10);
    const dig = t % 10;
    const tn = (x: number) => tidy(x / 10);
    const parts = [tn(t).toString(), sub ? '−' : '+', tn(s).toString(), '=', '?'].map((p, i) => (i === 0 || i === 2 ? show(Number(p)) : p));
    const answer = tn(sub ? t - s : t + s);
    const named: Named = sub
      ? {
          'took the smaller digit from the bigger': tn(whole * 10 + (s - dig)),
          'borrowed but kept the whole': tn(whole * 10 + dig + 10 - s),
          'added instead': tn(t + s),
          'took it off the whole number': tn((whole - s) * 10 + dig),
          'a tenth too many': tn(t - s + 1),
          'a tenth too few': tn(t - s - 1),
        }
      : {
          'forgot to carry the one': tn(whole * 10 + (dig + s - 10)),
          'joined the tenths digits': Number(`${whole}.${dig + s}`),
          'added to the whole number': tn(t + 10 * s),
          'a tenth too many': tn(t + s + 1),
          'a tenth too few': tn(t + s - 1),
        };
    return withMistakes({ parts, spoken: talk(parts), answer, input: 'decimal', fact: `${parts[0]} ${parts[1]} ${parts[2]} = ${show(answer)}` }, named);
  },
);

// ---------------------------------------------------------------- money-y5: totals, change, nearest dollar

const CASH_TAGS = ['MS.Y5.NUM.RN.P2'];
/** An amount in 10c units, mostly a multiple of 50c. */
const rollUnits = (r: () => number, lo: number, hi: number) => (r() < 0.7 ? 5 * int(r, Math.ceil(lo / 5), Math.floor(hi / 5)) : int(r, lo, hi));
const NOTES = [5, 10, 20];

const cashTotal = oneKey(
  'cash5:total',
  'Adding two round amounts ($2.50 + $1.50)',
  CASH_TAGS,
  2,
  (_k, r) => {
    for (;;) {
      const a = rollUnits(r, 10, 99);
      const b = rollUnits(r, 10, 99);
      if ((a % 10 !== 0 || b % 10 !== 0) && a + b <= 150) return [a, b];
    }
  },
  (_k, [a, b]) => {
    if (!isInt(a, 10, 99) || !isInt(b, 10, 99) || (a % 10 === 0 && b % 10 === 0) || a + b > 150) return null;
    const parts = [dollars(a * 10), '+', dollars(b * 10), '=', '$', '?'];
    const sum = a + b;
    const dollarsOnly = Math.floor(a / 10) + Math.floor(b / 10);
    const noCarry = dollarsOnly + (((a % 10) + (b % 10)) % 10) / 10;
    return withMistakes(
      {
        parts,
        spoken: `${say(a / 10)} dollars plus ${say(b / 10)} dollars equals how many dollars?`,
        answer: tidy(sum / 10),
        input: 'decimal',
        fact: `${parts[0]} + ${parts[2]} = ${dollars(sum * 10)}`,
      },
      { 'did not carry the cents into a dollar': noCarry, 'ignored the cents': dollarsOnly, 'one dollar too many': sum / 10 + 1, 'one dollar too few': sum / 10 - 1, 'ten cents too many': sum / 10 + 0.1, 'ten cents too few': sum / 10 - 0.1 },
    );
  },
);

const cashChange = oneKey(
  'cash5:change',
  'Change from a note ($10 for $7.50)',
  CASH_TAGS,
  2,
  (_k, r) => {
    const pay = pickOne(r, NOTES);
    for (;;) {
      const cost = rollUnits(r, 10, pay * 10 - 5);
      if (cost % 10 !== 0) return [pay, cost];
    }
  },
  (_k, [pay, cost]) => {
    if (!NOTES.includes(pay) || !isInt(cost, 10, pay * 10 - 5) || cost % 10 === 0) return null;
    const left = pay * 10 - cost;
    const whole = Math.floor(cost / 10);
    const parts = [`$${pay}`, '−', dollars(cost * 10), '=', '$', '?'];
    return withMistakes(
      {
        parts,
        prompt: 'What is the change?',
        spoken: `You pay ${pay} dollars for something that costs ${say(cost / 10)} dollars. What is the change in dollars?`,
        answer: tidy(left / 10),
        input: 'decimal',
        fact: `Change from $${pay} for ${parts[2]} is ${dollars(left * 10)}`,
      },
      {
        'ignored the cents': pay - whole,
        'took the cents the wrong way round': pay - whole + (cost % 10) / 10,
        'gave the cents only': (cost % 10) / 10,
        'one dollar too few': left / 10 - 1,
        'one dollar too many': left / 10 + 1,
        'ten cents too many': left / 10 + 0.1,
        'ten cents too few': left / 10 - 0.1,
      },
    );
  },
);

const NEAR_TENS = [1, 2, 3, 4, 6, 7, 8, 9];
const cashNear = oneKey(
  'cash5:near',
  'Nearest dollar ($4.80)',
  CASH_TAGS,
  2,
  (_k, r) => [int(r, 1, 19), pickOne(r, NEAR_TENS)],
  (_k, [d, t]) => {
    if (!isInt(d, 1, 19) || !NEAR_TENS.includes(t)) return null;
    const up = t > 5;
    const answer = up ? d + 1 : d;
    const parts = [dollars(d * 100 + t * 10), '≈', '$', '?'];
    return withMistakes(
      {
        parts,
        prompt: 'Round to the nearest dollar.',
        spoken: `${say(d + t / 10)} dollars, to the nearest dollar, is how many dollars?`,
        answer,
        input: 'decimal',
        fact: `${parts[0]} is about $${answer}`,
      },
      { 'rounded the wrong way': up ? d : d + 1, 'one dollar too many': answer + 1, 'one dollar too few': answer - 1, 'read the cents digit as dollars': t, 'rounded to the nearest 50c': up && t < 8 ? d + 0.5 : !up && t > 2 ? d + 0.5 : d },
    );
  },
);

// ---------------------------------------------------------------- pattern-decimal: 3, 4.5, 6, 7.5, ?

const PAT_TAGS = ['MS.Y5.ALG.PA.P1'];
/** Steps in hundredths: 0.5, 0.2, 0.25, 1.5, 0.1. */
const STEPS = [50, 20, 25, 150, 10];
const patOk = (step: number, j: number) => STEPS.includes(step) && isInt(j, 1, 8);
const rollPat = (_k: string, r: () => number) => [pickOne(r, STEPS), int(r, 1, 8)];
/** The terms j×step, (j+1)×step, ... as hundredths. */
const termsOf = (step: number, j: number, count: number) => Array.from({ length: count }, (_, i) => (j + i) * step);

const patNext = oneKey('pat5:next', 'The next number (3, 4.5, 6, 7.5)', PAT_TAGS, 2, rollPat, (_k, [step, j]) => {
  if (!patOk(step, j)) return null;
  const t = termsOf(step, j, 5);
  const shown = t.slice(0, 4).map(d2);
  const last = t[3];
  return withMistakes(
    { parts: [...shown.map((s) => `${s},`), '?'], prompt: 'What comes next?', spoken: `${shown.map((s) => say(Number(s))).join(', ')}, what comes next?`, answer: tidy(t[4] / 100), input: 'decimal', fact: `Next is ${d2(t[4])}` },
    hundredths({
      'repeated the last number': last,
      'jumped two steps': last + 2 * step,
      'added one': last + 100,
      'added the last two numbers': last + t[2],
      'a tenth too many': t[4] + 10,
      'a tenth too few': t[4] - 10,
      'went back a step': t[2],
    }),
  );
});

const patGap = oneKey('pat5:gap', 'The missing number (0.2, 0.4, ?, 0.8)', PAT_TAGS, 3, (_k, r) => [...rollPat(_k, r), int(r, 1, 2)], (_k, [step, j, gap]) => {
  if (!patOk(step, j) || !isInt(gap, 1, 2)) return null;
  const t = termsOf(step, j, 4);
  const parts = t.map((h, i) => (i === gap ? '?,' : i === 3 ? d2(h) : `${d2(h)},`));
  return withMistakes(
    {
      parts,
      prompt: 'What number is missing?',
      spoken: `${t.map((h, i) => (i === gap ? 'what' : say(h / 100))).join(', ')}. What number is missing?`,
      answer: tidy(t[gap] / 100),
      input: 'decimal',
      fact: `The missing number is ${d2(t[gap])}`,
    },
    hundredths({
      'repeated the number before': t[gap - 1],
      'gave the number after': t[gap + 1],
      'gave the step': step,
      'added the two neighbours': t[gap - 1] + t[gap + 1],
      'a tenth too many': t[gap] + 10,
      'a tenth too few': t[gap] - 10,
    }),
  );
});

const patStep = oneKey('pat5:step', 'How much it goes up by (3, 4.5, 6, 7.5)', PAT_TAGS, 2, rollPat, (_k, [step, j]) => {
  if (!patOk(step, j)) return null;
  const t = termsOf(step, j, 4);
  return withMistakes(
    { parts: [t.map(d2).join(', '), 'goes up by', '?'], prompt: 'How much does it go up by?', spoken: `${t.map((h) => say(h / 100)).join(', ')}. How much does it go up by each time?`, answer: tidy(step / 100), input: 'decimal', fact: `It goes up by ${d2(step)}` },
    hundredths({ 'gave the first number': t[0], 'gave the last number': t[3], 'gave the total change': 3 * step, 'a tenth too many': step + 10, 'a tenth too few': step - 10, 'counted the numbers': 400, 'added the first two': t[0] + t[1] }),
  );
});

// ---------------------------------------------------------------- the lot

export const Y5_FRACTION_FAMILIES: Record<string, Family> = Object.fromEntries(
  [mixTop, mixWhole, mixTap, hundAdd, hundTake, hundCross, cashTotal, cashChange, cashNear, patNext, patGap, patStep].map((f) => [f.keys[0], f]),
);

export const Y5_FRACTION_SKILL_KEYS: Record<string, readonly string[]> = {
  'mixed-improper': ['mix5:top', 'mix5:whole', 'mix5:tap'],
  'add-hundredths': ['hund5:add', 'hund5:take', 'hund5:cross'],
  'money-y5': ['cash5:total', 'cash5:change', 'cash5:near'],
  'pattern-decimal': ['pat5:next', 'pat5:gap', 'pat5:step'],
};

/** Two-step types (12 s): multiply or divide and then add, or carry across a whole. */
export const Y5_FRACTION_SLOW_KEYS: string[] = ['mix5:top', 'mix5:whole', 'mix5:tap', 'hund5:cross'];

export const Y5_FRACTION_LADDER: readonly Y6Row[] = [
  { id: 'mixed-improper', label: 'Mixed numbers and improper fractions', tiny: 'Mixed numbers', stage: 'fractions-decimals-percentages', after: 'fraction-add-y6', tags: MIX_TAGS, year: 5 },
  { id: 'add-hundredths', label: 'Adding and taking away hundredths', tiny: 'Add hundredths', stage: 'fractions-decimals-percentages', after: 'decimal-bonds', tags: HUND_TAGS, year: 5 },
  { id: 'money-y5', label: 'Money: totals, change and the nearest dollar', tiny: 'Money totals', stage: 'fractions-decimals-percentages', after: 'add-hundredths', tags: CASH_TAGS, year: 5 },
  { id: 'pattern-decimal', label: 'Patterns that go up in halves and decimals', tiny: 'Decimal patterns', stage: 'algebra', after: 'pattern-next', tags: PAT_TAGS, year: 5 },
];
