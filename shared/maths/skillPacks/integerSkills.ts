/**
 * Negative numbers, Year 7 and 8 (docs/plans/ladder-7-8/PLAN.md, card Y3).
 *
 * James, 24 Nov 2026: a negative answer is always four choices to tap, never typed (no minus key). So a question whose answer
 * is below zero is a pick question (`signed` below); one whose answer is zero or more is typed as usual. Every question rolls
 * its pick numbers (slot, salt) either way, so a family always takes the same count of numbers.
 *
 * Numbers below zero are written with the minus sign "−" (U+2212) stuck to the digits: −4. Small numbers only (to 20): this
 * is recall on a number line, not working out.
 *
 * Types:
 *   int-compare   (Y7) int:smallest  int:inverse  int:inverse-pick
 *   int-add-sub   (Y7) int:up  int:down  int:neg-minus  int:temp-up  int:temp-down
 *   int-negatives (Y8) int:add-neg  int:sub-neg  int:compare-dec
 */
import { int, isInt, type Family, type Made } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { goodPick, pick, rollPick, talk } from './pickKit';

const Y7 = ['MS.Y7.NUM.NS.P3', 'MS.Y7.NUM.NS.P4'];
const Y7_OPS = ['MS.Y7.NUM.NS.P5', 'MS.Y7.NUM.NS.P6'];
const Y8 = ['MS.Y8.NUM.NS.P7', 'MS.Y8.NUM.NS.P8'];

/** −4, 0, 7: how a whole or decimal number is shown, with the real minus sign. */
export const signedText = (n: number) => (n < 0 ? `−${String(Math.round(-n * 100) / 100)}` : String(Math.round(n * 100) / 100));

/**
 * The question as a typed one when the answer is zero or more, or as four choices to tap when it is below zero. `named` maps
 * each named mistake to the number it gives; a typed question keeps the mistakes that are zero or more (the pad has no minus),
 * a pick question shows them as labels.
 */
function signed(base: { parts: string[]; prompt?: string; spoken?: string }, answer: number, named: Named, slot: number, salt: number): Made | null {
  const spoken = base.spoken ?? talk(base.parts);
  if (answer >= 0) return withMistakes({ parts: base.parts, spoken, answer, ...(base.prompt ? { prompt: base.prompt } : {}) }, named);
  const labels: Record<string, string> = {};
  for (const [name, n] of Object.entries(named)) if (Number.isFinite(n) && n !== answer) labels[name] = signedText(n);
  const filled = base.parts.map((p) => p.replace('?', signedText(answer))).join(' ');
  const made = pick({ parts: base.parts, spoken, fact: filled }, signedText(answer), labels, { slot, salt });
  return made && base.prompt ? { ...made, prompt: base.prompt } : made;
}

/** The two pick numbers every family here ends with. */
const withPick = (random: () => number, ...params: number[]) => [...params, ...rollPick(random)];

// ---------------------------------------------------------------- int-compare (Y7)

/** "Which is the smallest?" from four numbers, at least two of them below zero. */
const smallest = oneKey(
  'int:smallest',
  'The smallest of four numbers, some below zero',
  Y7,
  6,
  (_k, r) => {
    const set = new Set<number>();
    while (set.size < 4) set.add(set.size < 2 ? -int(r, 1, 12) : int(r, -12, 12));
    return [...set, ...rollPick(r)];
  },
  (_k, params) => {
    const nums = params.slice(0, 4);
    const [slot, salt] = params.slice(4);
    if (!nums.every((n) => isInt(n, -12, 12)) || new Set(nums).size !== 4 || nums.filter((n) => n < 0).length < 2) return null;
    if (!goodPick(slot, salt)) return null;
    const answer = Math.min(...nums);
    const others = nums.filter((n) => n !== answer);
    // The wrong choices are the other three numbers, each named by the slip that picks it.
    const nearest = [...others].sort((x, y) => Math.abs(x) - Math.abs(y) || x - y)[0];
    const namedLabels: Record<string, string> = {};
    for (const n of others) {
      const why =
        n === Math.max(...nums) ? 'picked the biggest'
        : n === nearest ? 'picked the one nearest zero'
        : n < 0 ? 'picked a number below zero nearer zero'
        : 'ignored the minus signs';
      namedLabels[why in namedLabels ? `${why} (again)` : why] = signedText(n);
    }
    const parts = ['Smallest', '=', '?'];
    // Four fixed choices: the other three numbers in the order rolled, with the right one where the slot says (salt unused).
    const choices = others.map(signedText);
    choices.splice(slot, 0, signedText(answer));
    return {
      parts,
      prompt: `Which is the smallest? ${nums.map(signedText).join(', ')}`,
      spoken: `Which is the smallest: ${nums.map((n) => (n < 0 ? `negative ${-n}` : String(n))).join(', ')}?`,
      answer: slot,
      pick: choices,
      namedLabels,
      fact: `${signedText(answer)} is the smallest`,
    };
  },
);

/** "−7 + ? = 0": the additive inverse of a number below zero (typed, 7). */
const inverse = oneKey(
  'int:inverse',
  'What adds to a negative number to make zero (−7 + ? = 0)',
  Y7,
  1,
  (_k, r) => [int(r, 2, 20)],
  (_k, [n]) => {
    if (!isInt(n, 2, 20)) return null;
    const parts = [signedText(-n), '+', '?', '=', '0'];
    return withMistakes({ parts, spoken: talk(parts), answer: n }, { 'gave zero': 0, 'doubled it': 2 * n, 'one more': n + 1, 'one less': n - 1 });
  },
);

/** "9 + ? = 0": the additive inverse of a number above zero (tap −9). */
const inversePick = oneKey(
  'int:inverse-pick',
  'What adds to a number to make zero (9 + ? = 0)',
  Y7,
  3,
  (_k, r) => withPick(r, int(r, 2, 20)),
  (_k, [n, slot, salt]) => {
    if (!isInt(n, 2, 20)) return null;
    const parts = [String(n), '+', '?', '=', '0'];
    return signed({ parts }, -n, { 'forgot the minus': n, 'gave zero': 0, 'doubled it': -2 * n, 'one too far': -(n + 1), 'one short': -(n - 1) }, slot, salt);
  },
);

// ---------------------------------------------------------------- int-add-sub (Y7): across zero on a number line

/** "−4 + 9 = ?": up from below zero, ending at zero or above (typed). */
const up = oneKey(
  'int:up',
  'Adding up from below zero (−4 + 9)',
  Y7_OPS,
  4,
  (_k, r) => {
    const a = int(r, 1, 12);
    return withPick(r, a, int(r, a, a + 12));
  },
  (_k, [a, b, slot, salt]) => {
    if (!isInt(a, 1, 12) || !isInt(b, a, a + 12)) return null;
    const parts = [signedText(-a), '+', String(b), '=', '?'];
    return signed({ parts }, b - a, { 'added both numbers': a + b, 'one too many': b - a + 1, 'one too few': b - a - 1, 'went the wrong way': -a - b }, slot, salt);
  },
);

/** "3 − 7 = ?": down past zero (tap −4). */
const down = oneKey(
  'int:down',
  'Taking away past zero (3 − 7)',
  Y7_OPS,
  4,
  (_k, r) => {
    const a = int(r, 1, 10);
    return withPick(r, a, int(r, a + 1, a + 12));
  },
  (_k, [a, b, slot, salt]) => {
    if (!isInt(a, 1, 10) || !isInt(b, a + 1, a + 12)) return null;
    const parts = [String(a), '−', String(b), '=', '?'];
    return signed({ parts }, a - b, { 'forgot the minus': b - a, 'added them': -(a + b), 'stopped at zero': 0, 'one too far': a - b - 1, 'one short': a - b + 1 }, slot, salt);
  },
);

/** "−2 − 5 = ?": further below zero (tap −7). */
const negMinus = oneKey(
  'int:neg-minus',
  'Taking away from a negative number (−2 − 5)',
  Y7_OPS,
  4,
  (_k, r) => withPick(r, int(r, 1, 10), int(r, 1, 10)),
  (_k, [a, b, slot, salt]) => {
    if (!isInt(a, 1, 10) || !isInt(b, 1, 10)) return null;
    const parts = [signedText(-a), '−', String(b), '=', '?'];
    return signed({ parts }, -a - b, { 'forgot the minus': a + b, 'went up instead': b - a, 'took the smaller from the bigger': -Math.abs(a - b) || 1, 'one too far': -a - b - 1, 'one short': -a - b + 1 }, slot, salt);
  },
);

/** Temperature: "−3°C, warms up 8°": up from below zero (typed 5). */
const tempUp = oneKey(
  'int:temp-up',
  'Temperature going up from below zero',
  Y7_OPS,
  4,
  (_k, r) => {
    const a = int(r, 1, 10);
    return withPick(r, a, int(r, a, a + 10));
  },
  (_k, [a, b, slot, salt]) => {
    if (!isInt(a, 1, 10) || !isInt(b, a, a + 10)) return null;
    const parts = [`${signedText(-a)}°`, '+', `${b}°`, '=', '?°'];
    const spoken = `It is negative ${a} degrees and it warms up by ${b} degrees. What is the temperature now, in degrees?`;
    return signed({ parts, spoken, prompt: `It is ${signedText(-a)}°C. It warms up by ${b}°.` }, b - a, { 'added both numbers': a + b, 'one too many': b - a + 1, 'one too few': b - a - 1, 'went the wrong way': -a - b }, slot, salt);
  },
);

/** Temperature: "4°C, drops 9°": down past zero (tap −5). */
const tempDown = oneKey(
  'int:temp-down',
  'Temperature dropping below zero',
  Y7_OPS,
  4,
  (_k, r) => {
    const a = int(r, 1, 10);
    return withPick(r, a, int(r, a + 1, a + 10));
  },
  (_k, [a, b, slot, salt]) => {
    if (!isInt(a, 1, 10) || !isInt(b, a + 1, a + 10)) return null;
    const parts = [`${a}°`, '−', `${b}°`, '=', '?°'];
    const spoken = `It is ${a} degrees and it drops by ${b} degrees. What is the temperature now, in degrees?`;
    return signed({ parts, spoken, prompt: `It is ${a}°C. It drops by ${b}°.` }, a - b, { 'forgot the minus': b - a, 'added them': -(a + b), 'stopped at zero': 0, 'one too far': a - b - 1, 'one short': a - b + 1 }, slot, salt);
  },
);

// ---------------------------------------------------------------- int-negatives (Y8): adding and taking away a negative

/** "3 + −7 = ?" or "9 + −4 = ?": adding a negative is taking away. */
const addNeg = oneKey(
  'int:add-neg',
  'Adding a negative number (3 + −7)',
  Y8,
  4,
  (_k, r) => withPick(r, int(r, -10, 12), int(r, 1, 12)),
  (_k, [a, b, slot, salt]) => {
    if (!isInt(a, -10, 12) || !isInt(b, 1, 12) || a === 0) return null;
    const parts = [signedText(a), '+', signedText(-b), '=', '?'];
    const answer = a - b;
    return signed({ parts }, answer, { 'added instead': a + b, 'forgot the minus on the answer': -answer, 'one too far': answer - 1, 'one short': answer + 1 }, slot, salt);
  },
);

/** "5 − −2 = ?" or "−6 − −4 = ?": taking away a negative is adding. */
const subNeg = oneKey(
  'int:sub-neg',
  'Taking away a negative number (5 − −2)',
  Y8,
  4,
  (_k, r) => withPick(r, int(r, -10, 12), int(r, 1, 12)),
  (_k, [a, b, slot, salt]) => {
    if (!isInt(a, -10, 12) || !isInt(b, 1, 12) || a === 0) return null;
    const parts = [signedText(a), '−', signedText(-b), '=', '?'];
    const answer = a + b;
    if (answer === 0) return null;
    return signed({ parts }, answer, { 'took away instead': a - b, 'forgot the minus on the answer': -answer, 'one too far': answer + 1, 'one short': answer - 1 }, slot, salt);
  },
);

/** "Which is smaller?" with decimals below zero: −3.4 or −3 (four choices around one whole number). */
const compareDec = oneKey(
  'int:compare-dec',
  'The smallest of four decimals below zero (−3.4, −3)',
  Y8,
  3,
  (_k, r) => withPick(r, int(r, 1, 9)),
  (_k, [w, slot, salt]) => {
    if (!isInt(w, 1, 9) || !goodPick(slot, salt)) return null;
    // −(w + 0.5) is smallest; the others are the slips that pick a number nearer zero.
    const right = -(w + 0.5);
    const named: Record<string, string> = {
      'picked the whole number': signedText(-w),
      'picked the smallest digit after the point': signedText(-(w + 0.1)),
      'picked the one nearest zero': signedText(-(w - 0.5)),
      'ignored the minus sign': signedText(w + 0.5),
    };
    const made = pick({ parts: ['Smallest', '=', '?'], spoken: `Which is the smallest of these numbers below zero?`, fact: `${signedText(right)} is the smallest` }, signedText(right), named, { slot, salt });
    return made ? { ...made, prompt: 'Which is the smallest?' } : null;
  },
);

// ---------------------------------------------------------------- the lot

export const INTEGER_FAMILIES: Record<string, Family> = Object.fromEntries(
  [smallest, inverse, inversePick, up, down, negMinus, tempUp, tempDown, addNeg, subNeg, compareDec].map((f) => [f.keys[0], f]),
);

export const INTEGER_SKILL_KEYS = {
  'int-compare': ['int:smallest', 'int:inverse', 'int:inverse-pick'],
  'int-add-sub': ['int:up', 'int:down', 'int:neg-minus', 'int:temp-up', 'int:temp-down'],
  'int-negatives': ['int:add-neg', 'int:sub-neg', 'int:compare-dec'],
};
