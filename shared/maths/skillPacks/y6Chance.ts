/**
 * Year 6 ladder skills: Chance, data, patterns and fractions (docs/plans/ladder-y6/PLAN.md). Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 * James: fluency, not working out. Every question is one typed number or one tap of four, from facts a pupil just knows.
 *
 * Types:
 *   chance-words    chw:event  chw:number
 *   spinner         spin:part  spin:rest
 *   mean-range-y6   mr6:range  mr6:mean (slow)
 *   pattern-next    pat6:next  pat6:step  pat6:gap
 *   true-false-y6   tf6:fact  tf6:sides
 *   fraction-add-y6 fa6:same  fa6:double
 */
import { int, isInt, spokenLabel, type Family, type Made } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { frac, gcd, goodPick, pick, rollPick, talk } from './pickKit';
import type { Y6Row } from './y6Row';
import type { SpinnerColour } from '../figure';

const CHW_TAGS = ['MS.Y6.STAT.PR.P2'];
const SPIN_TAGS = ['MS.Y6.STAT.PR.P3', 'MS.Y6.STAT.PR.P4'];
const MR_TAGS = ['MS.Y6.STAT.DA.P2', 'MS.Y6.STAT.DA.P3'];
const PAT_TAGS = ['MS.Y6.ALG.ER.P2'];
const TF_TAGS = ['MS.Y6.ALG.ER.P1'];
const FA_TAGS = ['MS.Y6.NUM.RN.P9'];

const WORDS = ['impossible', 'unlikely', 'even chance', 'likely', 'certain'] as const;
const NUMBERS = ['0', '0.1', '0.5', '0.9', '1'] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- chance-words

/** Everyday events with a clear answer (an index into WORDS). */
const EVENTS: [string, number][] = [
  ['Rolling a 7 on a dice', 0],
  ['Rolling a 10 on a dice', 0],
  ['A coin landing heads', 2],
  ['A coin landing tails', 2],
  ['Rolling an even number on a dice', 2],
  ['Rolling a number less than 6 on a dice', 3],
  ['Rolling a number more than 1 on a dice', 3],
  ['Rolling a 6 on a dice', 1],
  ['Rolling a 1 on a dice', 1],
  ['Monday coming after Sunday', 4],
  ['Rolling a number less than 7 on a dice', 4],
  ['Winter coming after autumn', 4],
];

const WORD_SLIPS: Record<string, string[]> = {
  impossible: ['thought it was unlikely', 'thought it was an even chance', 'thought it was likely', 'thought it was certain'],
  unlikely: ['thought it was impossible', 'thought it was an even chance', 'thought it was likely', 'thought it was certain'],
  'even chance': ['thought it was impossible', 'thought it was unlikely', 'thought it was likely', 'thought it was certain'],
  likely: ['thought it was impossible', 'thought it was unlikely', 'thought it was an even chance', 'thought it was certain'],
  certain: ['thought it was impossible', 'thought it was unlikely', 'thought it was an even chance', 'thought it was likely'],
};
const wordNamed = (right: string): Record<string, string> => {
  const others = WORDS.filter((w) => w !== right);
  return Object.fromEntries(others.map((w, i) => [WORD_SLIPS[right][i], w]));
};

const chwEvent = oneKey(
  'chw:event',
  'Chance word for an everyday event (rolling a 7 on a dice)',
  CHW_TAGS,
  3,
  (_k, r) => [int(r, 0, EVENTS.length - 1), ...rollPick(r)],
  (_k, [i, slot, salt]) => {
    if (!isInt(i, 0, EVENTS.length - 1) || !goodPick(slot, salt)) return null;
    const [event, w] = EVENTS[i];
    const right = WORDS[w];
    const made = pick({ parts: [event, 'is', '?'], spoken: `${event}. How likely is it?`, fact: `${event} is ${right}` }, right, wordNamed(right), { slot, salt });
    return made ? { ...made, prompt: 'How likely is it?' } : null;
  },
);

const chwNumber = oneKey(
  'chw:number',
  'Chance word and its number on the 0 to 1 scale (a chance of 0.9 is likely)',
  CHW_TAGS,
  4,
  (_k, r) => [int(r, 0, 1), int(r, 0, 4), ...rollPick(r)],
  (_k, [dir, w, slot, salt]) => {
    if (!isInt(dir, 0, 1) || !isInt(w, 0, 4) || !goodPick(slot, salt)) return null;
    const word = WORDS[w];
    const num = NUMBERS[w];
    if (dir === 0) {
      const made = pick({ parts: [`A chance of ${num}`, 'means', '?'], spoken: `The chance is ${num}. Which chance word fits?`, fact: `A chance of ${num} means ${word}` }, word, wordNamed(word), { slot, salt });
      return made ? { ...made, prompt: 'Which chance word fits?' } : null;
    }
    const named: Record<string, string> = {};
    NUMBERS.forEach((n, i) => {
      if (i !== w) named[`gave the number for ${WORDS[i]}`] = n;
    });
    const made = pick({ parts: [cap(word), 'is a chance of', '?'], spoken: `${cap(word)}. What number is that chance?`, fact: `${cap(word)} is a chance of ${num}` }, num, named, { slot, salt });
    return made ? { ...made, prompt: 'Which number fits?' } : null;
  },
);

// ---------------------------------------------------------------- spinner

const COLOURS: SpinnerColour[] = ['red', 'blue', 'green', 'yellow'];
const simpleFrac = (n: number, d: number) => {
  const g = gcd(n, d);
  return frac(n / g, d / g);
};
/** A fraction label under one, or nothing (dropped) when it would be one or more, or zero. */
const labUnder = (n: number, d: number) => (Number.isInteger(n) && Number.isInteger(d) && n > 0 && d > n ? simpleFrac(n, d) : '');
const labels = (named: Record<string, string>) => Object.fromEntries(Object.entries(named).filter(([, v]) => v !== ''));

/** n equal parts, k shaded, with no shortening needed. */
const spinOk = (n: number, k: number, c: number) => isInt(n, 2, 10) && isInt(k, 1, 9) && k < n && gcd(k, n) === 1 && isInt(c, 0, COLOURS.length - 1);

const spinPart = oneKey(
  'spin:part',
  'Chance of a colour on a spinner (3 of 8 parts red: chance of red)',
  SPIN_TAGS,
  5,
  (_k, r) => [int(r, 2, 10), int(r, 1, 9), int(r, 0, COLOURS.length - 1), ...rollPick(r)],
  (_k, [n, k, c, slot, salt]) => {
    if (!spinOk(n, k, c) || !goodPick(slot, salt)) return null;
    const colour = COLOURS[c];
    const right = frac(k, n);
    const text = `A spinner has ${n} equal parts. ${k} ${k === 1 ? 'is' : 'are'} ${colour}.`;
    const made = pick(
      { parts: [`Chance of ${colour}`, '=', '?'], spoken: `${text} What is the chance of ${colour}?`, fact: `The chance of ${colour} is ${right}` },
      right,
      labels({
        ['gave the chance of not ' + colour]: labUnder(n - k, n),
        'put it over the other parts': labUnder(k, n - k),
        'one over the number shaded': labUnder(1, k),
        'one over the number of parts': labUnder(1, n),
        'other parts over the shaded': labUnder(n - k, k),
      }),
      { slot, salt },
    );
    return made ? { ...made, prompt: text, figure: { kind: 'spinner', parts: n, shaded: k, colour } } : null;
  },
);

const spinRest = oneKey(
  'spin:rest',
  'Chance of not (chance of red is 3/8, chance of not red)',
  SPIN_TAGS,
  5,
  (_k, r) => [int(r, 2, 10), int(r, 1, 9), int(r, 0, COLOURS.length - 1), ...rollPick(r)],
  (_k, [n, k, c, slot, salt]) => {
    if (!spinOk(n, k, c) || !goodPick(slot, salt)) return null;
    const colour = COLOURS[c];
    const given = frac(k, n);
    const right = frac(n - k, n);
    const made = pick(
      { parts: [`Chance of not ${colour}`, '=', '?'], spoken: `The chance of ${colour} is ${spokenLabel(given)}. What is the chance of not ${colour}?`, fact: `The chance of not ${colour} is ${right}` },
      right,
      labels({
        ['gave the chance of ' + colour]: labUnder(k, n),
        'one over the number of parts': labUnder(1, n),
        'one over the top': labUnder(1, k),
        'put the top over what is left': labUnder(k, n - k),
      }),
      { slot, salt },
    );
    return made ? { ...made, prompt: `The chance of ${colour} is ${given}`, figure: { kind: 'spinner', parts: n, shaded: k, colour } } : null;
  },
);

// ---------------------------------------------------------------- mean-range-y6

const listPrompt = (nums: readonly number[]) => `The numbers ${nums.join(', ')}`;
function about(word: string, nums: readonly number[], answer: number, named: Named): Made | null {
  return withMistakes({ parts: [word, '=', '?'], spoken: `${listPrompt(nums)}. What is the ${word.toLowerCase()}?`, answer, prompt: listPrompt(nums) }, named);
}

const mr6Range = oneKey(
  'mr6:range',
  'The range of four or five numbers up to 20',
  MR_TAGS,
  null,
  (_k, r) => {
    const set = new Set<number>();
    const count = int(r, 4, 5);
    while (set.size < count) set.add(int(r, 1, 20));
    return [...set];
  },
  (_k, nums) => {
    if (!isInt(nums.length, 4, 5) || !nums.every((n) => isInt(n, 1, 20)) || new Set(nums).size !== nums.length) return null;
    const hi = Math.max(...nums);
    const lo = Math.min(...nums);
    if (hi - lo < 3) return null;
    return about('Range', nums, hi - lo, {
      'gave the biggest number': hi,
      'gave the smallest number': lo,
      'added the biggest and smallest': hi + lo,
      'took the first from the last': Math.abs(nums[nums.length - 1] - nums[0]),
      'one too many': hi - lo + 1,
      'one too few': hi - lo - 1,
    });
  },
);

const mr6Mean = oneKey(
  'mr6:mean',
  'The mean of two or three small numbers (total 30 or less)',
  MR_TAGS,
  null,
  (_k, r) => {
    for (;;) {
      const count = int(r, 2, 3);
      const nums = Array.from({ length: count }, () => int(r, 1, 15));
      const total = nums.reduce((a, b) => a + b, 0);
      if (total <= 30 && total % count === 0 && total / count >= 2 && new Set(nums).size > 1) return nums;
    }
  },
  (_k, nums) => {
    const count = nums.length;
    if (!isInt(count, 2, 3) || !nums.every((n) => isInt(n, 1, 15))) return null;
    const total = nums.reduce((a, b) => a + b, 0);
    if (total > 30 || total % count !== 0 || total / count < 2 || new Set(nums).size < 2) return null;
    return about('Mean', nums, total / count, {
      'gave the total': total,
      'divided by one too many': total / (count + 1),
      'gave the biggest number': Math.max(...nums),
      'gave the range': Math.max(...nums) - Math.min(...nums),
      'one too many': total / count + 1,
      'one too few': total / count - 1,
      'gave the middle number': [...nums].sort((a, b) => a - b)[Math.floor(count / 2)],
    });
  },
);

// ---------------------------------------------------------------- pattern-next

const terms = (start: number, step: number) => [0, 1, 2, 3].map((i) => start + i * step);
const patOk = (start: number, step: number) => isInt(start, 1, 20) && isInt(step, 2, 10);

const pat6Next = oneKey(
  'pat6:next',
  'The next number in a growing pattern (4, 7, 10, 13)',
  PAT_TAGS,
  2,
  (_k, r) => [int(r, 1, 20), int(r, 2, 10)],
  (_k, [start, step]) => {
    if (!patOk(start, step)) return null;
    const shown = terms(start, step);
    const last = shown[3];
    return withMistakes(
      { parts: [...shown.map((n) => `${n},`), '?'], prompt: 'What comes next?', spoken: `${shown.join(', ')}, what comes next?`, answer: last + step },
      { 'repeated the last number': last, 'added the last two numbers': last + shown[2], 'one more': last + step + 1, 'one less': last + step - 1, 'jumped twice': last + 2 * step, 'went back a step': last - step, 'added one': last + 1 },
    );
  },
);

const pat6Step = oneKey(
  'pat6:step',
  'How much a growing pattern goes up by (4, 7, 10, 13)',
  PAT_TAGS,
  2,
  (_k, r) => [int(r, 1, 20), int(r, 2, 10)],
  (_k, [start, step]) => {
    if (!patOk(start, step)) return null;
    const shown = terms(start, step);
    return withMistakes(
      { parts: [shown.join(', '), 'goes up by', '?'], prompt: 'How much does it go up by?', spoken: `${shown.join(', ')}. How much does it go up by each time?`, answer: step },
      { 'gave the last number': shown[3], 'gave the first number': shown[0], 'gave the total change': 3 * step, 'one more': step + 1, 'one less': step - 1, 'counted the numbers': 4, 'added the first two': shown[0] + shown[1] },
    );
  },
);

const pat6Gap = oneKey(
  'pat6:gap',
  'The missing number in a growing pattern (4, 7, ?, 13)',
  PAT_TAGS,
  3,
  (_k, r) => [int(r, 1, 20), int(r, 2, 10), int(r, 1, 2)],
  (_k, [start, step, gap]) => {
    if (!patOk(start, step) || !isInt(gap, 1, 2)) return null;
    const shown = terms(start, step);
    const answer = shown[gap];
    const parts = shown.map((n, i) => (i === gap ? '?,' : i === 3 ? String(n) : `${n},`));
    return withMistakes(
      { parts, prompt: 'What number is missing?', spoken: `${shown.map((n, i) => (i === gap ? 'what' : String(n))).join(', ')}. What number is missing?`, answer },
      { 'repeated the number before': shown[gap - 1], 'gave the number after': shown[gap + 1], 'one more': answer + 1, 'one less': answer - 1, 'gave the step': step, 'added the two neighbours': shown[gap - 1] + shown[gap + 1] },
    );
  },
);

// ---------------------------------------------------------------- true-false-y6

const spokenSide = (s: string) => s.replace(/×/g, 'times').replace(/\+/g, 'plus');

/** Two sides and four signs to tap: the right one is < or ≤ (or > or ≥) the right way round; the sides are never equal. */
function sentence(left: string, lv: number, right: string, rv: number, lenient: number, swap: number, slot: number, salt: number): Made | null {
  if (lv === rv || !isInt(lenient, 0, 1) || !isInt(swap, 0, 1) || !goodPick(slot, salt)) return null;
  const [first, second, fv, sv] = swap ? [right, left, rv, lv] : [left, right, lv, rv];
  const less = fv < sv;
  const truth = less ? (lenient ? '≤' : '<') : lenient ? '≥' : '>';
  const wrongSigns = less ? ['>', '≥', '='] : ['<', '≤', '='];
  const names = ['turned the sign round', 'turned the sign round (or equal)', 'thought they were equal'];
  const named = Object.fromEntries(wrongSigns.map((s, i) => [names[i], s]));
  const spoken = `${spokenSide(first)}, which sign goes in the gap, then ${spokenSide(second)}?`;
  const made = pick({ parts: [first, '?', second], spoken, fact: `${first} ${truth} ${second} is true` }, truth, named, { slot, salt });
  return made ? { ...made, prompt: 'Which sign makes it true?' } : null;
}

const tf6Fact = oneKey(
  'tf6:fact',
  'True or false: a times-table fact against a round number (8 × 7 ≤ 60)',
  TF_TAGS,
  7,
  (_k, r) => [int(r, 2, 10), int(r, 2, 10), int(r, 2, 20), int(r, 0, 1), int(r, 0, 1), ...rollPick(r)],
  (_k, [a, b, c5, lenient, swap, slot, salt]) => {
    if (!isInt(a, 2, 10) || !isInt(b, 2, 10) || !isInt(c5, 2, 20)) return null;
    const lv = a * b;
    const c = c5 * 5;
    if (lv < 12 || Math.abs(lv - c) > 8) return null;
    return sentence(`${a} × ${b}`, lv, String(c), c, lenient, swap, slot, salt);
  },
);

const tf6Sides = oneKey(
  'tf6:sides',
  'True or false: two easy facts (6 × 4 ≥ 5 × 5, 30 + 12 > 6 × 7)',
  TF_TAGS,
  9,
  (_k, r) => [int(r, 2, 9), int(r, 2, 9), int(r, 0, 1), int(r, 2, 9), int(r, 2, 12), int(r, 0, 1), int(r, 0, 1), ...rollPick(r)],
  (_k, [a, b, kind, c, d, lenient, swap, slot, salt]) => {
    if (!isInt(a, 2, 9) || !isInt(b, 2, 9) || !isInt(kind, 0, 1) || !isInt(c, 2, 9) || !isInt(d, 2, 12)) return null;
    const lv = a * b;
    const [rightText, rv] = kind === 0 ? [`${c} × ${d}`, c * d] : [`${c * 5} + ${d}`, c * 5 + d];
    if (kind === 0 && d > 9) return null;
    if (lv < 12 || rv < 12 || Math.abs(lv - rv) > 8) return null;
    return sentence(`${a} × ${b}`, lv, rightText, rv, lenient, swap, slot, salt);
  },
);

// ---------------------------------------------------------------- fraction-add-y6

const fracBase = (parts: string[], right: string, named: Record<string, string>, slot: number, salt: number): Made | null => {
  const made = pick({ parts, spoken: talk(parts), fact: `${parts.slice(0, 3).join(' ')} = ${right}` }, right, labels(named), { slot, salt });
  return made ? { ...made, prompt: 'Give the answer as a fraction.' } : null;
};

interface Sum {
  /** 'add' or 'sub', or 'one' for 1 − a fraction. */
  op: 'add' | 'sub' | 'one';
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Same bottom: 2/5 + 1/5, 5/8 − 2/8. The answer is under one and needs no shortening. */
const SAME: Sum[] = [];
for (let b = 3; b <= 10; b++)
  for (let a = 1; a < b; a++)
    for (let c = 1; c < b; c++) {
      if (gcd(a, b) !== 1 || gcd(c, b) !== 1) continue;
      if (a + c < b && gcd(a + c, b) === 1) SAME.push({ op: 'add', a, b, c, d: b });
      if (a > c && gcd(a - c, b) === 1) SAME.push({ op: 'sub', a, b, c, d: b });
    }

/** One bottom twice the other: 1/2 + 1/4, 1/4 + 1/8, 1/5 + 1/10, 1/2 − 1/4, 1 − 1/4. */
const DOUBLE: Sum[] = [];
for (const [b, d] of [[2, 4], [4, 8], [5, 10]]) {
  for (let a = 1; a < b; a++)
    for (let c = 1; c < d; c++) {
      if (gcd(a, b) !== 1 || gcd(c, d) !== 1) continue;
      const big = a * (d / b);
      if (big + c < d && gcd(big + c, d) === 1) {
        DOUBLE.push({ op: 'add', a, b, c, d });
        DOUBLE.push({ op: 'add', a: c, b: d, c: a, d: b });
      }
      if (big > c && gcd(big - c, d) === 1) DOUBLE.push({ op: 'sub', a, b, c, d });
    }
}
for (const d of [2, 4, 5, 8, 10]) for (let c = 1; c < d; c++) if (gcd(c, d) === 1 && c * 2 <= d + 1) DOUBLE.push({ op: 'one', a: 1, b: 1, c, d });

function makeSum(list: Sum[], i: number, slot: number, salt: number): Made | null {
  if (!isInt(i, 0, list.length - 1) || !goodPick(slot, salt)) return null;
  const { op, a, b, c, d } = list[i];
  if (op === 'one') {
    const parts = ['1', '−', frac(c, d), '=', '?'];
    const right = frac(d - c, d);
    return fracBase(parts, right, {
      'gave the fraction taken away': labUnder(c, d),
      'one over what is left': labUnder(1, d - c),
      'one too many on the top': labUnder(d - c + 1, d),
      'one too few on the top': labUnder(d - c - 1, d),
    }, slot, salt);
  }
  const bottom = Math.max(b, d);
  const x = a * (bottom / b);
  const y = c * (bottom / d);
  const parts = [frac(a, b), op === 'add' ? '+' : '−', frac(c, d), '=', '?'];
  const topRight = op === 'add' ? x + y : x - y;
  const right = frac(topRight, bottom);
  const named: Record<string, string> =
    op === 'add'
      ? {
          'added the tops and the bottoms': labUnder(a + c, b + d),
          'added the tops, kept the bigger bottom': labUnder(a + c, bottom),
          'added the tops, kept the smaller bottom': labUnder(a + c, Math.min(b, d)),
          'took away instead': labUnder(Math.abs(x - y), bottom),
          'one too many on the top': labUnder(topRight + 1, bottom),
        }
      : {
          'subtracted the tops, kept the bigger bottom': labUnder(a - c, bottom),
          'subtracted the tops and the bottoms': labUnder(a - c, Math.abs(b - d) || 0),
          'added instead': labUnder(x + y, bottom),
          'gave the first fraction': labUnder(a, b),
          'one too many on the top': labUnder(topRight + 1, bottom),
          'one too few on the top': labUnder(topRight - 1, bottom),
        };
  // Keep the right label as asked ("2/6" is a choice that shows the slip, so it is not shortened).
  return fracBase(parts, right, Object.fromEntries(Object.entries(named).map(([k, v]) => [k, v])), slot, salt);
}

const fa6Same = oneKey(
  'fa6:same',
  'Adding or taking away fractions with the same bottom (2/5 + 1/5)',
  FA_TAGS,
  3,
  (_k, r) => [int(r, 0, SAME.length - 1), ...rollPick(r)],
  (_k, [i, slot, salt]) => makeSum(SAME, i, slot, salt),
);

const fa6Double = oneKey(
  'fa6:double',
  'Adding or taking away simple fractions (½ + ¼, 1 − ¼)',
  FA_TAGS,
  3,
  (_k, r) => [int(r, 0, DOUBLE.length - 1), ...rollPick(r)],
  (_k, [i, slot, salt]) => makeSum(DOUBLE, i, slot, salt),
);

// ---------------------------------------------------------------- the lot

export const CHANCE_FAMILIES: Record<string, Family> = Object.fromEntries([chwEvent, chwNumber, spinPart, spinRest, mr6Range, mr6Mean, pat6Next, pat6Step, pat6Gap, tf6Fact, tf6Sides, fa6Same, fa6Double].map((f) => [f.keys[0], f]));

export const CHANCE_SKILL_KEYS: Record<string, readonly string[]> = {
  'chance-words': ['chw:event', 'chw:number'],
  spinner: ['spin:part', 'spin:rest'],
  'mean-range-y6': ['mr6:range', 'mr6:mean'],
  'pattern-next': ['pat6:next', 'pat6:step', 'pat6:gap'],
  'true-false-y6': ['tf6:fact', 'tf6:sides'],
  'fraction-add-y6': ['fa6:same', 'fa6:double'],
};

export const CHANCE_SLOW_KEYS: string[] = ['mr6:mean'];

export const CHANCE_LADDER: readonly Y6Row[] = [
  { id: 'chance-words', label: 'Chance words and the 0 to 1 scale', tiny: 'Chance words', stage: 'data-chance', after: 'fdp-equivalents', tags: CHW_TAGS },
  { id: 'spinner', label: 'Chance on a spinner', tiny: 'Spinner chance', stage: 'data-chance', after: 'chance-words', tags: SPIN_TAGS },
  { id: 'mean-range-y6', label: 'Mean and range', tiny: 'Mean and range', stage: 'data-chance', after: 'percent-of', tags: MR_TAGS },
  { id: 'pattern-next', label: 'Growing patterns', tiny: 'Growing patterns', stage: 'algebra', after: 'whole-from-fraction', tags: PAT_TAGS },
  { id: 'true-false-y6', label: 'True or false with < > ≤ ≥', tiny: 'True or false ≤ ≥', stage: 'algebra', after: 'bedmas', tags: TF_TAGS },
  { id: 'fraction-add-y6', label: 'Adding simple fractions (½ + ¼)', tiny: 'Add simple fractions', stage: 'fractions-decimals-percentages', after: 'equivalent-fractions', tags: FA_TAGS },
];
