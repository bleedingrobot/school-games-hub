/**
 * Data and chance, Year 7 (docs/plans/ladder-7-8/PLAN.md, card Y8).
 *
 * `averages`: mean, median, mode and range of up to 5 small numbers (1 to 20) shown in the prompt, "The numbers 3, 7, 7, 9, 4".
 * Every answer is a whole number, typed. `probability`: a bag of counters, a dice (tap a fraction), the chance something
 * doesn't happen (typed decimal) and a chance as a percent (typed). Fractions stay at or under one and in simplest form.
 *
 * Types:
 *   averages     avg:mode  avg:range  avg:median (slow)  avg:mean (slow)
 *   probability  prob:bag  prob:dice  prob:not  prob:percent
 */
import { int, isInt, pickOne, shuffle, show, type Family } from '../banded';
import { oneKey, say, withMistakes, type Named } from './generatedKit';
import { frac, gcd, goodPick, pick, rollPick } from './pickKit';

const AVG = ['MS.Y7.STAT.DA.P1', 'MS.Y7.STAT.DA.P2'];
const PROB = ['MS.Y7.STAT.PR.P1', 'MS.Y7.STAT.PR.P2'];

const sum = (nums: readonly number[]) => nums.reduce((a, b) => a + b, 0);
const sorted = (nums: readonly number[]) => [...nums].sort((a, b) => a - b);
const inRange = (nums: readonly number[]) => nums.every((n) => isInt(n, 1, 20));

/** `count` different numbers from 1 to 20. */
function distinct(r: () => number, count: number): number[] {
  const set = new Set<number>();
  while (set.size < count) set.add(int(r, 1, 20));
  return [...set];
}

/** The numbers as a prompt: "The numbers 3, 7, 7, 9, 4". */
const listPrompt = (nums: readonly number[]) => `The numbers ${nums.join(', ')}`;

/** A typed question about a list of numbers: "Median = ?" under "The numbers 3, 7, 7, 9, 4". */
function about(word: string, nums: readonly number[], answer: number, named: Named) {
  const parts = [word, '=', '?'];
  const spoken = `${listPrompt(nums)}. What is the ${word.toLowerCase()}?`;
  return withMistakes({ parts, spoken, answer, prompt: listPrompt(nums) }, named);
}

// ---------------------------------------------------------------- averages

/** The number that comes up most often, from five numbers. */
const mode = oneKey(
  'avg:mode',
  'The mode of five numbers',
  AVG,
  5,
  (_k, r) => {
    const m = int(r, 1, 20);
    const copies = int(r, 2, 3);
    const others: number[] = [];
    while (others.length < 5 - copies) {
      const n = int(r, 1, 20);
      if (n !== m && !others.includes(n)) others.push(n);
    }
    return shuffle([...Array<number>(copies).fill(m), ...others], r);
  },
  (_k, nums) => {
    if (!inRange(nums)) return null;
    const counts = new Map<number, number>();
    for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
    const top = Math.max(...counts.values());
    const winners = [...counts].filter(([, c]) => c === top);
    if (top < 2 || top > 3 || winners.length !== 1) return null;
    return about('Mode', nums, winners[0][0], {
      'picked the biggest number': Math.max(...nums),
      'picked the smallest number': Math.min(...nums),
      'gave how many times it comes up': top,
      'picked the middle of the list': nums[2],
      'gave the range': Math.max(...nums) - Math.min(...nums),
    });
  },
);

/** Biggest take smallest, from four or five numbers. */
const range = oneKey(
  'avg:range',
  'The range of four or five numbers',
  AVG,
  null,
  (_k, r) => distinct(r, int(r, 4, 5)),
  (_k, nums) => {
    if (!isInt(nums.length, 4, 5) || !inRange(nums) || new Set(nums).size !== nums.length) return null;
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

/** The middle number once they are in order: three or five numbers (slow: it needs sorting). */
const median = oneKey(
  'avg:median',
  'The median of three or five numbers',
  AVG,
  null,
  (_k, r) => distinct(r, pickOne(r, [3, 5, 5])),
  (_k, nums) => {
    if (!(nums.length === 3 || nums.length === 5) || !inRange(nums) || new Set(nums).size !== nums.length) return null;
    const mid = (nums.length - 1) / 2;
    const answer = sorted(nums)[mid];
    // The list is out of order and its middle is not the median, so "middle of the unsorted list" is a real slip.
    if (nums[mid] === answer) return null;
    return about('Median', nums, answer, {
      'picked the middle of the unsorted list': nums[mid],
      'gave the biggest number': Math.max(...nums),
      'gave the smallest number': Math.min(...nums),
      'gave the first number': nums[0],
      'gave the mean': sum(nums) / nums.length,
      'gave the range': Math.max(...nums) - Math.min(...nums),
    });
  },
);

/** The mean of three or four numbers that share out evenly (slow: add, then divide). */
const mean = oneKey(
  'avg:mean',
  'The mean of three or four numbers (a whole number)',
  AVG,
  null,
  (_k, r) => {
    const n = int(r, 3, 4);
    for (;;) {
      const nums = Array.from({ length: n }, () => int(r, 1, 20));
      if (sum(nums) % n === 0) return nums;
    }
  },
  (_k, nums) => {
    if (!isInt(nums.length, 3, 4) || !inRange(nums) || sum(nums) % nums.length !== 0 || new Set(nums).size === 1) return null;
    const total = sum(nums);
    const n = nums.length;
    return about('Mean', nums, total / n, {
      'gave the total, not divided': total,
      'divided by one too many': total / (n + 1),
      'divided by one too few': total / (n - 1),
      'gave the middle number': sorted(nums)[Math.floor(n / 2)],
      'gave the biggest number': Math.max(...nums),
      'gave the range': Math.max(...nums) - Math.min(...nums),
    });
  },
);

// ---------------------------------------------------------------- probability

/** n/d in simplest form. */
const simple = (n: number, d: number) => {
  const g = gcd(n, d);
  return frac(n / g, d / g);
};

/** Fraction labels worth showing as a wrong choice: more than none and less than all. Anything else is left out. */
const fractions = (named: Record<string, [number, number]>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [name, [n, d]] of Object.entries(named)) if (n > 0 && d > 0 && n < d) out[name] = simple(n, d);
  return out;
};

const COLOURS: [string, string][] = [['red', 'blue'], ['green', 'yellow'], ['black', 'white'], ['pink', 'orange']];

/** "A bag has 3 red and 5 blue counters. Chance of red = ?" (tap 3/8). */
const bag = oneKey(
  'prob:bag',
  'Chance of a colour from a bag (3 red, 5 blue: chance of red)',
  PROB,
  6,
  (_k, r) => [int(r, 1, 7), int(r, 1, 7), int(r, 0, COLOURS.length - 1), int(r, 0, 1), ...rollPick(r)],
  (_k, [a, b, pair, which, slot, salt]) => {
    if (!isInt(a, 1, 7) || !isInt(b, 1, 7) || !isInt(pair, 0, COLOURS.length - 1) || !isInt(which, 0, 1) || !goodPick(slot, salt)) return null;
    const total = a + b;
    if (a === b || total > 10) return null;
    const [first, second] = COLOURS[pair];
    const want = which === 0 ? a : b;
    const other = which === 0 ? b : a;
    if (gcd(want, total) !== 1) return null;
    const colour = which === 0 ? first : second;
    const right = frac(want, total);
    const made = pick(
      { parts: [`Chance of ${colour}`, '=', '?'], spoken: `A bag has ${a} ${first} and ${b} ${second} counters. You take one without looking. What is the chance of ${colour}?`, fact: `The chance of ${colour} is ${right}` },
      right,
      fractions({
        'put it over the other colour': [want, other],
        'gave the other colour': [other, total],
        'one over the counters': [1, total],
        'one over the colour': [1, want],
        'the other colour over this one': [other, want],
      }),
      { slot, salt },
    );
    return made ? { ...made, prompt: `A bag has ${a} ${first} and ${b} ${second} counters. Take one without looking.` } : null;
  },
);

const DICE_KINDS = ['not', 'more than', 'less than'] as const;

/** "A fair dice is rolled. Chance of not a 6 = ?" (tap 5/6). */
const dice = oneKey(
  'prob:dice',
  'Chance on a dice (not a 6, more than 3)',
  PROB,
  4,
  (_k, r) => {
    const kind = int(r, 0, 2);
    return [kind, kind === 0 ? int(r, 1, 6) : kind === 1 ? int(r, 2, 4) : int(r, 3, 5), ...rollPick(r)];
  },
  (_k, [kind, n, slot, salt]) => {
    if (!isInt(kind, 0, 2) || !goodPick(slot, salt)) return null;
    if (!(kind === 0 ? isInt(n, 1, 6) : kind === 1 ? isInt(n, 2, 4) : isInt(n, 3, 5))) return null;
    // k = how many of the six faces count.
    const k = kind === 0 ? 5 : kind === 1 ? 6 - n : n - 1;
    const word = DICE_KINDS[kind];
    const phrase = kind === 0 ? `not rolling a ${n}` : `rolling ${word} ${n}`;
    const right = simple(k, 6);
    const named: Record<string, [number, number]> =
      kind === 0
        ? { 'gave the chance of the number': [1, 6], 'put it over the five others': [1, 5], 'gave the number over six': [n, 6], 'took away two faces': [4, 6] }
        : { 'counted the other side': [6 - k, 6], 'counted the number itself': [k + 1, 6], 'left one face out': [k - 1, 6], 'put it over five': [k, 5], 'gave one face': [1, 6] };
    const made = pick(
      { parts: [`Chance of ${kind === 0 ? `not a ${n}` : `${word} ${n}`}`, '=', '?'], spoken: `A fair dice is rolled. What is the chance of ${phrase}?`, fact: `The chance of ${phrase} is ${right}` },
      right,
      fractions(named),
      { slot, salt },
    );
    return made ? { ...made, prompt: 'A fair dice is rolled.' } : null;
  },
);

const EVENTS: [string, string][] = [['rain', 'no rain'], ['a win', 'no win'], ['being late', 'not being late'], ['a goal', 'no goal']];

/** "The chance of rain is 0.3. Chance of no rain = ?" (type 0.7). */
const not = oneKey(
  'prob:not',
  'Chance it does not happen (chance of rain 0.3, chance of no rain)',
  PROB,
  2,
  (_k, r) => [int(r, 1, 9), int(r, 0, EVENTS.length - 1)],
  (_k, [tenths, event]) => {
    if (!isInt(tenths, 1, 9) || tenths === 5 || !isInt(event, 0, EVENTS.length - 1)) return null;
    const [yes, no] = EVENTS[event];
    const p = tenths / 10;
    const answer = (10 - tenths) / 10;
    return withMistakes(
      { parts: [`Chance of ${no}`, '=', '?'], spoken: `The chance of ${yes} is ${say(p)}. What is the chance of ${no}?`, answer, input: 'decimal', prompt: `The chance of ${yes} is ${show(p)}` },
      { 'gave the same chance': p, 'added it to one': 1 + p, 'took the tenths from ten': 10 - tenths, 'one tenth too many': answer + 0.1, 'one tenth too few': answer - 0.1 },
    );
  },
);

/** [top, bottom] pairs whose "top in bottom" is a whole percent, kept easy. */
const IN: [number, number][] = [[1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10]];

/** "1 in 4 = ?%" (type 25). */
const percent = oneKey(
  'prob:percent',
  'A chance as a percent (1 in 4 is what percent)',
  PROB,
  2,
  (_k, r) => pickOne(r, IN),
  (_k, [a, d]) => {
    if (!IN.some(([x, y]) => x === a && y === d)) return null;
    const answer = (a * 100) / d;
    return withMistakes(
      { parts: [`${a} in ${d}`, '=', '?', '%'], spoken: `${a} in ${d} is what percent?`, answer },
      { 'gave the bottom number': d, 'gave the top number': a, 'divided 100 by the top': 100 / a, 'multiplied the two': a * d, 'doubled it': answer * 2, 'halved it': answer / 2 },
    );
  },
);

// ---------------------------------------------------------------- the lot

export const DATA_FAMILIES: Record<string, Family> = Object.fromEntries([mode, range, median, mean, bag, dice, not, percent].map((f) => [f.keys[0], f]));

export const DATA_SKILL_KEYS = {
  averages: ['avg:mode', 'avg:range', 'avg:median', 'avg:mean'],
  probability: ['prob:bag', 'prob:dice', 'prob:not', 'prob:percent'],
};

/** The two-step types: sort first, or add then divide. They get 12 s to count as quick. */
export const DATA_SLOW_KEYS: string[] = ['avg:median', 'avg:mean'];

/** One row per skill, in ladder order (`tiny` is the 20-character name for tight places). */
export const DATA_LADDER = [
  { id: 'averages', label: 'Mean, median, mode and range', tiny: 'Averages', stage: 'data-chance', year: 7, tags: AVG },
  { id: 'probability', label: 'Chance as a fraction, decimal or percent', tiny: 'Chance', stage: 'data-chance', year: 7, tags: PROB },
] as const;
