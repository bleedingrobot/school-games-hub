/**
 * The first rungs of the maths ladder: number facts a student should know by heart before
 * times tables. One mastery record per fact, like 7 × 8 in times tables.
 *
 * Keys: "bond10:3+7" (pairs that make 10), "bond20:8+12" (pairs that make 20), "dbl:7"
 * (double 7), "half:14" (half of 14) and "skip5:next:25" (skip counting: see `skipCounting`), "part7:4" (7 altogether, 4 showing: see `partWhole`), "oddeven:7" (is 7 odd or even? see `oddEven`), the number-line keys "place100:n63", "read1000:h300", "tens100:+63", "near10:h65", "zoom:40-50:47" (see `lineFamilies`). Adding and taking away within 20 keeps its own
 * "add:7+8" records (add-sub pack), so nothing already saved changes.
 *
 * Bands: 1 bonds to 10, 2 doubles and halves to 10, 3 bonds to 20, 4 doubles and halves to 20.
 */
import { BandedPack, int, isInt, speak, type Family, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';
import { KEYS as EQUALS_KEYS } from './equalsKeys';

const bondKeys = (prefix: string, total: number, from: number) => {
  const keys: string[] = [];
  for (let a = from; a <= total / 2; a++) keys.push(`${prefix}:${a}+${total - a}`);
  return keys;
};
const parseBond = (key: string) => {
  const m = /^bond(10|20):(\d+)\+(\d+)$/.exec(key);
  return m ? { total: Number(m[1]), a: Number(m[2]), b: Number(m[3]) } : null;
};

/** Variants: 0 a + ? = total, 1 ? + b = total, 2 total − a = ?, 3 total − b = ?. */
function bonds(label: string, tag: string, prefix: string, total: number, from: number): Family {
  const keys = bondKeys(prefix, total, from);
  return {
    label,
    curriculumTags: [tag],
    keys,
    roll: (key, r) => {
      const { a, b } = parseBond(key)!;
      return [a, b, int(r, 0, 3)];
    },
    make: (key, [a, b, v]) => {
      const bond = parseBond(key);
      if (!bond || bond.total !== total || bond.a !== a || bond.b !== b || !keys.includes(key) || !isInt(v, 0, 3)) return null;
      const t = String(total);
      const [parts, answer] =
        v === 0 ? [[String(a), '+', '?', '=', t], b]
        : v === 1 ? [['?', '+', String(b), '=', t], a]
        : v === 2 ? [[t, '−', String(a), '=', '?'], b]
        : [[t, '−', String(b), '=', '?'], a];
      return { parts: parts as string[], spoken: speak(parts as string[]), answer: answer as number, wrong: [answer as number + 1, answer as number - 1, total, answer as number + 2, answer as number - 2, a + b + 1] };
    },
  };
}

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Doubles of dblFrom–dblTo and halves of the even numbers halfFrom–halfTo. */
function doublesHalves(label: string, tag: string, dblFrom: number, dblTo: number, halfFrom: number, halfTo: number): Family {
  const dbls = range(dblFrom, dblTo);
  const halves = range(halfFrom, halfTo, 2);
  const keys = [...dbls.map((n) => `dbl:${n}`), ...halves.map((n) => `half:${n}`)];
  return {
    label,
    curriculumTags: [tag],
    keys,
    roll: (key, r) => [Number(key.split(':')[1]), int(r, 0, 1)],
    make: (key, [n, v]) => {
      if (!keys.includes(key) || key.split(':')[1] !== String(n) || !isInt(v, 0, 1)) return null;
      if (key.startsWith('dbl:')) {
        const parts = v === 0 ? [String(n), '+', String(n), '=', '?'] : ['Double', String(n), '=', '?'];
        return { parts, spoken: speak(parts), answer: 2 * n, wrong: [2 * n + 1, 2 * n - 1, 2 * n + 2, 2 * n - 2, n + 1, n * n] };
      }
      const parts = v === 0 ? ['Half', 'of', String(n), '=', '?'] : [String(n), '÷', '2', '=', '?'];
      const answer = n / 2;
      return { parts, spoken: speak(parts), answer, wrong: [answer + 1, answer - 1, n, answer + 2, answer - 2] };
    },
  };
}

/** "Ten and" facts (10 + 4, 7 + 10): one record for each of the nine, key "tenand:4". Variants: 0 10 + n, 1 n + 10, 2 10 + ? = 10 + n, 3 (10 + n) − 10. */
const tenAnd: Family = {
  label: '"Ten and" facts (10 + 4)',
  curriculumTags: ['MS.Y1.NUM.OP.P6'],
  keys: range(1, 9).map((n) => `tenand:${n}`),
  roll: (key, r) => [Number(key.split(':')[1]), int(r, 0, 3)],
  make: (key, [n, v]) => {
    if (!isInt(n, 1, 9) || key !== `tenand:${n}` || !isInt(v, 0, 3)) return null;
    const t = String(10 + n);
    const [parts, answer] =
      v === 0 ? [['10', '+', String(n), '=', '?'], 10 + n]
      : v === 1 ? [[String(n), '+', '10', '=', '?'], 10 + n]
      : v === 2 ? [['10', '+', '?', '=', t], n]
      : [[t, '−', '10', '=', '?'], n];
    return { parts: parts as string[], spoken: speak(parts as string[]), answer: answer as number, wrong: [(answer as number) + 1, (answer as number) - 1, (answer as number) + 10, n + 1, 20, 1 + n] };
  },
};

/**
 * Ten more and ten less on the teens (Tūī's step 6), one record for each: "tenup:14" is ten more than 14 (and 10 + 10, "tenup:10"),
 * "tendown:24" is ten less than 24. The ten-frame shows the ten going on or coming off. Variants for up: 0 "14 + 10 = ?",
 * 1 "10 + 14 = ?"; for down: 0 "24 − 10 = ?", 1 "10 + ? = 24" (what was left after the ten came off).
 */
export const TEN_UP_FROM = 10;
export const TEN_DOWN_FROM = 20;
const tenMove = (up: boolean): Family => {
  const keys = range(up ? TEN_UP_FROM : TEN_DOWN_FROM, (up ? TEN_UP_FROM : TEN_DOWN_FROM) + 9).map((n) => `${up ? 'tenup' : 'tendown'}:${n}`);
  return {
    label: up ? 'Ten more than a teen (14 + 10)' : 'Ten less than a number in the twenties (24 − 10)',
    curriculumTags: ['MS.Y1.NUM.OP.P6'],
    keys,
    roll: (key, r) => [Number(key.split(':')[1]), int(r, 0, 1)],
    make: (key, [n, v]) => {
      if (!keys.includes(key) || key.split(':')[1] !== String(n) || !isInt(v, 0, 1)) return null;
      const [parts, answer] =
        up ? (v === 0 ? [[String(n), '+', '10', '=', '?'], n + 10] : [['10', '+', String(n), '=', '?'], n + 10])
        : v === 0 ? [[String(n), '−', '10', '=', '?'], n - 10]
        : [['10', '+', '?', '=', String(n)], n - 10];
      const a = answer as number;
      return { parts: parts as string[], spoken: speak(parts as string[]), answer: a, wrong: up ? [a - 10, a + 10, a + 1, a - 1, 10 + 1] : [n, a - 10, a + 1, a - 1, n + 10] };
    },
  };
};

/** The steps juniors skip count in, how far each goes and its word ("Counting in tens"). Up to 20 for twos to start with. */
export const SKIP_STEPS = [
  { step: 10, upTo: 100, word: 'tens' },
  { step: 5, upTo: 50, word: 'fives' },
  { step: 2, upTo: 20, word: 'twos' },
] as const;
export type SkipStep = (typeof SKIP_STEPS)[number]['step'];
/**
 * More skip counting, beside the ladder (ladder-only, so auto practice never meets it; Hop asks it from its own rules):
 * threes to 30 ("skip3:next:12") and fours to 40 ("skip4:up:20"), the same kinds of question as the first three.
 */
export const SKIP_MORE_STEPS = [
  { step: 3, upTo: 30, word: 'threes' },
  { step: 4, upTo: 40, word: 'fours' },
] as const;
/** Tens past 100, to 200: "skip10h:next:110" (80, 90, 100, ?). Only answers past 100, so no key is also a "skip10" one. */
export const SKIP_HIGH = { step: 10, from: 100, upTo: 200, word: 'tens past 100' } as const;
/**
 * Skip counting from a start that isn't a multiple of the step (start at 3, hop by 10: 3, 13, 23, ?), to 4 hops. The first
 * pad is always the start, so "skip10o3:next:33" really is "from 3": the key names the start. Offsets are 1 up to one
 * less than the step.
 */
export const SKIP_FROM_STEPS = [
  { step: 10, word: 'tens' },
  { step: 5, word: 'fives' },
  { step: 4, word: 'fours' },
  { step: 3, word: 'threes' },
  { step: 2, word: 'twos' },
] as const;
/** How a skip-counting question goes: a gap counting up (2, 4, ?, 8), what comes next (2, 4, 6, ?), or a gap counting back (10, 8, ?, 4). */
export type SkipKind = 'up' | 'next' | 'back';

/** A family of skip counting: its step, how far it goes, the lowest answer, its start (null: any multiple of the step, 0 included) and the family-name prefix of its keys. */
interface SkipSpec {
  step: number;
  upTo: number;
  word: string;
  /** Keys read "skip10h:up:110" or "skip10o3:up:23": the prefix before the colon. */
  prefix: (offset: number) => string;
  /** Answers must be past this (tens past 100). */
  above?: number;
  /** The offsets, when every question starts at one ("from 3"). */
  offsets?: readonly number[];
}

/**
 * One way to show a skip-counting question with this answer, or null. `at` is where the gap is: 1 or 2 for up and back
 * (four pads, the gap in the middle), 3 or 4 for next (that many pads shown before the gap). Every pad is a multiple of
 * the step from 0 to `upTo`; with an offset the first pad is the offset itself and counting only goes up.
 */
function skipTerms(spec: SkipSpec, kind: SkipKind, answer: number, at: number, offset = 0): number[] | null {
  const { step, upTo } = spec;
  if (kind === 'next' ? at !== 3 && at !== 4 : at !== 1 && at !== 2) return null;
  const terms =
    kind === 'up' ? range(answer - at * step, answer + (3 - at) * step, step)
    : kind === 'back' ? range(answer - (3 - at) * step, answer + at * step, step).reverse()
    : range(answer - at * step, answer, step);
  if (spec.offsets && (kind === 'back' || terms[0] !== offset)) return null;
  if (spec.above !== undefined && answer <= spec.above) return null;
  return terms.every((n) => n >= 0 && n <= upTo) && answer % step === offset ? terms : null;
}

const skipOffsets = (spec: SkipSpec) => spec.offsets ?? [0];
const skipKeys = (spec: SkipSpec) =>
  skipOffsets(spec).flatMap((offset) =>
    (spec.offsets ? (['up', 'next'] as const) : (['up', 'next', 'back'] as const)).flatMap((kind) =>
      range(offset, spec.upTo, spec.step)
        .filter((n) => [1, 2, 3, 4].some((at) => skipTerms(spec, kind, n, at, offset)))
        .map((n) => `${spec.prefix(offset)}:${kind}:${n}`),
    ),
  );
/** A skip-counting key read apart: "skip10o3:next:33" is step 10, start 3 (offset 3), what comes next, 33; "skip10h:up:110" is high. */
export const parseSkip = (key: string) => {
  const m = /^skip(\d+)(?:o(\d+)|(h))?:(up|next|back):(\d+)$/.exec(key);
  return m ? { step: Number(m[1]), offset: m[2] ? Number(m[2]) : 0, high: !!m[3], kind: m[4] as SkipKind, answer: Number(m[5]) } : null;
};

/**
 * Skip counting in tens, fives or twos (NZ Years 1–2), one record for each missing number of each kind: "skip10:up:40" is
 * the 40 in 20, 30, ?, 50 (or 30, ?, 50, 60). The parts are the pads, the gap as "?": ["20,", "30,", "?,", "50"].
 * Wrong choices: one more or less, the wrong step from the pad before, and a number already shown.
 */
function skipCounting(spec: SkipSpec): Family {
  const { step, word } = spec;
  const keys = skipKeys(spec);
  const ats = (kind: SkipKind) => (kind === 'next' ? [3, 4] : [1, 2]);
  return {
    label: `Counting in ${word}`,
    curriculumTags: [],
    keys,
    roll: (key, r) => {
      const { kind, answer, offset } = parseSkip(key)!;
      const fits = ats(kind).filter((at) => skipTerms(spec, kind, answer, at, offset));
      return [answer, fits[int(r, 0, fits.length - 1)]];
    },
    make: (key, [answer, at]) => {
      const skip = parseSkip(key);
      if (!skip || skip.step !== step || skip.answer !== answer || !keys.includes(key)) return null;
      const terms = skipTerms(spec, skip.kind, answer, at, skip.offset);
      if (!terms) return null;
      const gap = terms.indexOf(answer);
      const parts = terms.map((n, i) => (i === gap ? '?' : String(n)) + (i < terms.length - 1 ? ',' : ''));
      const said = terms.map((n, i) => (i === gap ? (skip.kind === 'next' ? '' : 'something') : String(n))).filter(Boolean).join(', ');
      const prompt = skip.kind === 'next' ? 'What comes next?' : 'What is missing?';
      const before = terms[gap - 1];
      const back = skip.kind === 'back' ? -1 : 1;
      const wrongSteps = [10, 5, 2, 1].filter((s) => s !== step);
      return {
        parts,
        spoken: `Counting ${skip.kind === 'back' ? 'back ' : ''}in ${word}${skip.offset ? ` from ${skip.offset}` : ''}: ${said}. ${prompt}`,
        prompt,
        answer,
        wrong: [answer + 1, answer - 1, ...wrongSteps.map((s) => before + back * s), ...terms.filter((n) => n !== answer)],
      };
    },
  };
}
const skipSpec = (step: number, upTo: number, word: string): SkipSpec => ({ step, upTo, word, prefix: () => `skip${step}` });
const skipFamilies: Record<string, Family> = {
  ...Object.fromEntries([...SKIP_STEPS, ...SKIP_MORE_STEPS].map(({ step, upTo, word }) => [`skip${step}`, skipCounting(skipSpec(step, upTo, word))])),
  skip10h: skipCounting({ step: 10, upTo: SKIP_HIGH.upTo, word: SKIP_HIGH.word, above: SKIP_HIGH.from, prefix: () => 'skip10h' }),
  ...Object.fromEntries(
    SKIP_FROM_STEPS.map(({ step, word }) => [
      `skip${step}o`,
      skipCounting({ step, upTo: step * 5, word, offsets: range(1, step - 1), prefix: (offset) => `skip${step}o${offset}` }),
    ]),
  ),
};
/** The family names of the skip counting kept beside the ladder (threes, fours, tens past 100, and from a start). */
export const SKIP_MORE_FAMILY_NAMES = Object.keys(skipFamilies).filter((n) => !SKIP_STEPS.some(({ step }) => n === `skip${step}`));

/** The wholes in each part-whole skill: small wholes first, then up to 10. */
export const PART_WHOLES = { parts5: [3, 5], parts10: [6, 10] } as const;
const partKeys = (from: number, to: number) => range(from, to).flatMap((w) => range(0, w).map((s) => `part${w}:${s}`));
const parsePart = (key: string) => {
  const m = /^part(\d+):(\d+)$/.exec(key);
  return m ? { whole: Number(m[1]), shown: Number(m[2]) } : null;
};

/**
 * The part-whole idea (NZ Year 1, composition): "part7:4" is 7 altogether with 4 showing, so 3 hiding. Every split
 * counts, 0 hiding and all hiding too. The parts are ["7", "=", "4", "+", "?"]. Wrong choices: one more or less, the
 * number showing, the whole and two more.
 */
function partWhole(label: string, from: number, to: number): Family {
  const keys = partKeys(from, to);
  return {
    label,
    curriculumTags: ['MS.Y1.NUM.OP.P1'],
    keys,
    roll: (key) => {
      const { whole, shown } = parsePart(key)!;
      return [whole, shown];
    },
    make: (key, [whole, shown]) => {
      if (!keys.includes(key) || key !== `part${whole}:${shown}`) return null;
      const answer = whole - shown;
      return {
        parts: [String(whole), '=', String(shown), '+', '?'],
        spoken: `${whole} is ${shown} and how many more?`,
        answer,
        wrong: [answer + 1, answer - 1, shown, whole, answer + 2],
      };
    },
  };
}

/** A part-whole question read back from how it was shown (["7", "=", "4", "+", "?"]), or null when it isn't one. */
export function solvePart(parts: readonly string[]): { answer: number; key: string } | null {
  if (parts.length !== 5 || parts[1] !== '=' || parts[3] !== '+' || parts[4] !== '?') return null;
  if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[2])) return null;
  const key = `part${Number(parts[0])}:${Number(parts[2])}`;
  if (key !== `part${parts[0]}:${parts[2]}`) return null; // no leading zeros
  return Object.values(PART_WHOLES).some(([from, to]) => partKeys(from, to).includes(key)) ? { answer: Number(parts[0]) - Number(parts[2]), key } : null;
}

/**
 * Odd and even to 20 (NZ Year 2): "oddeven:7" asks "Is 7 odd or even?", a pick-one question with the choices
 * ["odd", "even"] (the answer is the index of the right one). Penguin Pairs asks it as "can the two chicks share 7 fish
 * fairly?": even shares fairly, odd leaves one over.
 */
export const ODD_EVEN_TO = 20;
export const ODD_EVEN_LABELS = ['odd', 'even'] as const;
const oddEven: Family = {
  label: 'Odd and even numbers to 20',
  curriculumTags: ['MS.Y2.NUM.OP.P2'],
  keys: range(1, ODD_EVEN_TO).map((n) => `oddeven:${n}`),
  roll: (key) => [Number(key.split(':')[1])],
  make: (key, [n]) => {
    if (!isInt(n, 1, ODD_EVEN_TO) || key !== `oddeven:${n}`) return null;
    const answer = n % 2 === 0 ? 1 : 0;
    return {
      parts: ['Is', String(n), 'odd', 'or', 'even?'],
      spoken: `Is ${n} odd or even?`,
      answer,
      pick: [...ODD_EVEN_LABELS],
      fact: `${n} is ${ODD_EVEN_LABELS[answer]}`,
    };
  },
};

/** An odd-or-even question read back from how it was shown (["Is", "7", "odd", "or", "even?"]): the index of the right choice. */
export function solveOddEven(parts: readonly string[]): { answer: number; key: string } | null {
  if (parts.length !== 5 || parts[0] !== 'Is' || parts[2] !== 'odd' || parts[3] !== 'or' || parts[4] !== 'even?') return null;
  if (!/^[1-9]\d?$/.test(parts[1])) return null;
  const n = Number(parts[1]);
  return n <= ODD_EVEN_TO ? { answer: n % 2 === 0 ? 1 : 0, key: `oddeven:${n}` } : null;
}

/** A skip-counting question read back from how it was shown (its parts), made again and checked, or null when it isn't one. */
export function solveSkip(parts: readonly string[]): { answer: number; key: string } | null {
  if (parts.length < 4 || parts.length > 5 || parts.filter((p) => p === '?' || p === '?,').length !== 1) return null;
  const nums = parts.map((p) => p.replace(/,$/, '')).map((p) => (p === '?' ? null : /^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n))) return null;
  const gap = nums.indexOf(null);
  const known = nums.flatMap((n, i) => (n === null ? [] : [{ n, i }]));
  const diff = (known[1].n - known[0].n) / (known[1].i - known[0].i);
  const step = Math.abs(diff);
  const answer = known[0].n + diff * (gap - known[0].i);
  const kind: SkipKind = gap === parts.length - 1 ? 'next' : diff < 0 ? 'back' : 'up';
  if (kind === 'next' && diff < 0) return null;
  // The same pads could be a multiple-of-the-step question, one past 100, or one from a start (the first pad, below the step).
  const first = known[0].i === 0 ? known[0].n : NaN;
  const prefixes = [`skip${step}`, `skip${step}h`, `skip${step}o${first}`];
  for (const prefix of prefixes) {
    const key = `${prefix}:${kind}:${answer}`;
    const family = Object.values(families).find((f) => f.keys.includes(key));
    const made = family?.make(key, [answer, gap]);
    if (made && made.parts.length === parts.length && made.parts.every((p, i) => p === parts[i])) return { answer, key };
  }
  return null;
}

// ---- The number line (Pigeon's Number Line, docs/plans/maths-review/new-games/N1-number-line.md) -------------------
// Ladder-only keys the game records through `recordMathsAnswers` as plain right or wrong (first tap only). The game
// builds its own picture and wrong cards; these families own the keys so records can be checked and kept.
//   place100:t30 / place100:n63   where does 30 / 63 go on a 0 to 100 line (nine tens, 21 others)
//   read100:t30  / read100:n63    read the number at an unlabelled point on 0 to 100 (the same 30)
//   tens100:+63  / tens100:-63    ten more / ten less than 63 (20: crossings 90 to 100 and 10 to 0 included)
//   near10:n63   / near10:h65     which ten is 63 / 65 closer to (26 others, 10 halfway)
//   zoom:40-50:47                 read or place 47 on a lens zoomed into 40 to 50 (20, three line lengths)
//   place1000:h300 / place1000:n640, read1000:..., (9 hundreds + 31 others each)
//   near100:n640 / near100:h350   which hundred is 640 / 350 closer to (10 others, 10 halfway)
const LINE_TENS = range(1, 9).map((n) => n * 10);
const LINE_OTHERS_100 = [11, 14, 18, 23, 27, 32, 36, 41, 45, 49, 54, 58, 63, 67, 72, 76, 81, 85, 89, 94, 97];
const LINE_HUNDREDS = range(1, 9).map((n) => n * 100);
const LINE_OTHERS_1000 = [120, 140, 170, 230, 250, 270, 310, 340, 360, 390, 410, 450, 480, 520, 540, 570, 610, 640, 660, 690, 720, 750, 780, 810, 830, 860, 880, 910, 940, 960, 980];
export const TENS_MORE = [14, 20, 27, 35, 42, 56, 63, 78, 85, 90];
export const TENS_LESS = [10, 19, 24, 38, 47, 63, 71, 86, 92, 100];
/** Not a tens number and not halfway: every third, so the spread covers the whole line. */
const NEAR10_OTHERS = range(1, 99).filter((n) => n % 5 !== 0).filter((_, i) => i % 3 === 0).slice(0, 26);
const NEAR10_HALF = range(5, 95, 10);
const NEAR100_OTHERS = [130, 180, 220, 280, 340, 390, 430, 480, 530, 580, 610, 640, 680, 730, 790, 830, 870, 920, 960].filter((_, i) => i % 2 === 0).concat([440]);
const NEAR100_HALF = range(150, 950, 100);
export const ZOOM_KEYS = [
  ...range(41, 49).map((n) => `zoom:40-50:${n}`),
  ...range(71, 79).map((n) => `zoom:70-80:${n}`),
  'zoom:0-200:130',
  'zoom:300-400:350',
];

/** The number a key names ("place100:n63" → 63, "tens100:-63" → 63, "zoom:40-50:47" → 47). */
const lineNumber = (key: string) => Number(/(\d+)$/.exec(key)![1]);
/** A line question typed out, as its parts: each family says its own words, so the parts name the key (see `solveLine`). */
const numLine = (label: string, tag: string, keys: string[], parts: (n: number, key: string) => string[], spoken: (n: number, key: string) => string): Family => ({
  label,
  curriculumTags: [tag],
  keys,
  roll: (key) => [lineNumber(key)],
  make: (key, [n]) => {
    if (!keys.includes(key) || lineNumber(key) !== n) return null;
    return { parts: parts(n, key), spoken: spoken(n, key), answer: n, wrong: [n + 1, n - 1, n + 10, n + 2] };
  },
});
const nearWords = (n: number, size: number) => `Is ${n} closer to ${Math.floor(n / size) * size} or ${Math.floor(n / size) * size + size}?`;

const lineFamilies: Record<string, Family> = {
  place100: numLine('Where a number goes on a 0 to 100 line', 'MS.Y3.NUM.NS.P1', [...LINE_TENS.map((n) => `place100:t${n}`), ...LINE_OTHERS_100.map((n) => `place100:n${n}`)], (n) => ['Place', String(n), 'on', 'the', '100', 'line'], (n) => `Where does ${n} go on the line to 100?`),
  read100: numLine('Reading a point on a 0 to 100 line', 'MS.Y3.NUM.NS.P1', [...LINE_TENS.map((n) => `read100:t${n}`), ...LINE_OTHERS_100.map((n) => `read100:n${n}`)], (n) => ['Read', String(n), 'on', 'the', '100', 'line'], () => 'What number is at the arrow?'),
  tens100: numLine('Ten more and ten less on a 0 to 100 line', 'MS.Y3.NUM.NS.P1', [...TENS_MORE.map((n) => `tens100:+${n}`), ...TENS_LESS.map((n) => `tens100:-${n}`)], (n, key) => ['Ten', key.includes('+') ? 'more' : 'less', 'than', String(n)], (n, key) => `What is ten ${key.includes('+') ? 'more' : 'less'} than ${n}?`),
  near10: numLine('Which ten a number is closer to', 'MS.Y3.NUM.NS.P5', [...NEAR10_OTHERS.map((n) => `near10:n${n}`), ...NEAR10_HALF.map((n) => `near10:h${n}`)], (n) => ['Nearest', 'ten', 'to', String(n)], (n) => nearWords(n, 10)),
  zoom: numLine('Reading and placing on a zoomed line', 'MS.Y3.NUM.NS.P1', ZOOM_KEYS, (n, key) => ['Zoom', /zoom:(\d+-\d+)/.exec(key)![1], 'at', String(n)], (n) => `Where is ${n} on the zoomed line?`),
  place1000: numLine('Where a number goes on a 0 to 1000 line', 'MS.Y4.NUM.NS.P1', [...LINE_HUNDREDS.map((n) => `place1000:h${n}`), ...LINE_OTHERS_1000.map((n) => `place1000:n${n}`)], (n) => ['Place', String(n), 'on', 'the', '1000', 'line'], (n) => `Where does ${n} go on the line to 1000?`),
  read1000: numLine('Reading a point on a 0 to 1000 line', 'MS.Y4.NUM.NS.P1', [...LINE_HUNDREDS.map((n) => `read1000:h${n}`), ...LINE_OTHERS_1000.map((n) => `read1000:n${n}`)], (n) => ['Read', String(n), 'on', 'the', '1000', 'line'], () => 'What number is at the arrow?'),
  near100: numLine('Which hundred a number is closer to', 'MS.Y4.NUM.NS.P5', [...NEAR100_OTHERS.map((n) => `near100:n${n}`), ...NEAR100_HALF.map((n) => `near100:h${n}`)], (n) => ['Nearest', 'hundred', 'to', String(n)], (n) => nearWords(n, 100)),
};
export const LINE_FAMILY_NAMES = Object.keys(lineFamilies);

/** A number-line question read back from its parts (["Place", "63", "on", "the", "100", "line"]): its number and key, or null when it isn't one. */
export function solveLine(parts: readonly string[]): { answer: number; key: string } | null {
  const n = parts.map((p) => (/^[1-9]\d{0,2}$/.test(p) ? Number(p) : NaN)).find((x) => !Number.isNaN(x));
  if (n === undefined) return null;
  for (const family of Object.values(lineFamilies)) {
    for (const key of family.keys) {
      if (lineNumber(key) !== n) continue;
      const made = family.make(key, [n]);
      if (made && made.parts.length === parts.length && made.parts.every((x, i) => x === parts[i])) return { answer: n, key };
    }
  }
  return null;
}

// ---- The equals sign (Parrot's See-saw, docs/PARROT-PLAN.md) ----------------------------------------------------------
// Ladder-only keys the game records through `recordMathsAnswers` (first tap only). The game makes its own questions and
// wrong cards; these families own the keys so records are kept, and read as short level-see-saw sentences if typed.
//   eqmiss:8=5+?  eqswap:3+5 (3 + 5 = 5 + ?)  eqboth:6+7=8+?  eqsub:3=8-? and eqsub:9-4=2+?  eqtf:5+3=4+4 (true or false)
const equalsNumbers = (key: string) => (key.split(':')[1].match(/\d+/g) ?? []).map(Number);
const equalsParts = (key: string, n: number[]): string[] => {
  const w = (...x: (number | string)[]) => ['Level', 'see-saw:', ...x.map(String)];
  if (key.startsWith('eqmiss:')) return w(n[0], '=', n[1], '+', '?');
  if (key.startsWith('eqswap:')) return w(n[0], '+', n[1], '=', n[1], '+', '?');
  if (key.startsWith('eqboth:')) return w(n[0], '+', n[1], '=', n[2], '+', '?');
  if (key.startsWith('eqtf:')) return ['True', 'or', 'false?', String(n[0]), '+', String(n[1]), '=', String(n[2]), '+', String(n[3])];
  return key.includes('-?') ? w(n[0], '=', n[1], '-', '?') : w(n[0], '-', n[1], '=', n[2], '+', '?');
};
const equalsAnswer = (key: string, n: number[]): number => {
  if (key.startsWith('eqmiss:')) return n[0] - n[1];
  if (key.startsWith('eqswap:')) return n[0];
  if (key.startsWith('eqboth:')) return n[0] + n[1] - n[2];
  if (key.startsWith('eqtf:')) return n[0] + n[1] === n[2] + n[3] ? 0 : 1;
  return key.includes('-?') ? n[1] - n[0] : n[0] - n[1] - n[2];
};
const equals = (label: string, keys: string[]): Family => ({
  label,
  curriculumTags: [],
  keys,
  roll: (key) => equalsNumbers(key),
  make: (key, params) => {
    const n = equalsNumbers(key);
    if (!keys.includes(key) || n.length !== params.length || n.some((x, i) => x !== params[i])) return null;
    const answer = equalsAnswer(key, n);
    const parts = equalsParts(key, n);
    if (key.startsWith('eqtf:')) return { parts, spoken: `True or false: ${n[0]} plus ${n[1]} equals ${n[2]} plus ${n[3]}?`, answer, pick: ['True', 'False'] };
    return { parts, spoken: `What number keeps the see-saw level?`, answer, wrong: [answer + 1, answer - 1, answer + 2] };
  },
});
const equalsFamilies: Record<string, Family> = {
  eqmiss: equals('See-saw with a missing number (to 10)', EQUALS_KEYS.miss),
  eqswap: equals('Swapping the two numbers of a sum', EQUALS_KEYS.swap),
  eqboth: equals('See-saw with two numbers on each side (to 20)', EQUALS_KEYS.both),
  eqsub: equals('See-saw with taking away', EQUALS_KEYS.sub),
  eqtf: equals('True or false: is the see-saw level?', EQUALS_KEYS.tf),
};

/** An equals-sign question read back from its parts (["Level", "see-saw:", "8", "=", "5", "+", "?"]): its answer and key, or null when it isn't one. */
export function solveEquals(parts: readonly string[]): { answer: number; key: string } | null {
  if (!parts.some((x) => x === 'see-saw:' || x === 'false?')) return null;
  for (const family of Object.values(equalsFamilies)) {
    for (const key of family.keys) {
      const n = equalsNumbers(key);
      const made = family.make(key, n);
      if (made && made.parts.length === parts.length && made.parts.every((x, k) => x === parts[k])) return { answer: made.answer, key };
    }
  }
  return null;
}

const families: Record<string, Family> = {
  ...lineFamilies,
  ...equalsFamilies,
  tenAnd,
  tenUp: tenMove(true),
  tenDown: tenMove(false),
  oddEven,
  parts5: partWhole('Parts of 3, 4 and 5 (5 is 2 and 3)', ...PART_WHOLES.parts5),
  parts10: partWhole('Parts of 6 to 10 (7 is 4 and 3)', ...PART_WHOLES.parts10),
  ...skipFamilies,
  bond10: bonds('Pairs that make 10', 'MS.Y1.NUM.OP.P1', 'bond10', 10, 0),
  dblHalf10: doublesHalves('Doubles and halves to 10', 'MS.Y1.NUM.OP.P2', 1, 5, 2, 10),
  bond20: bonds('Pairs that make 20', 'MS.Y2.NUM.OP.P1', 'bond20', 20, 1),
  dblHalf20: doublesHalves('Doubles and halves to 20', 'MS.Y2.NUM.OP.P2', 6, 10, 12, 20),
};

export const EARLY_FACTS: PackDefinition = {
  id: 'early-facts',
  label: 'Early number facts',
  families,
  bands: [['bond10'], ['dblHalf10'], ['bond20'], ['dblHalf20']],
  // Only the ladder asks the "ten and" facts, the part-whole facts, odd and even and skip counting.
  ladderOnly: ['tenAnd', 'tenUp', 'tenDown', 'oddEven', 'parts5', 'parts10', ...SKIP_STEPS.map(({ step }) => `skip${step}`), ...SKIP_MORE_FAMILY_NAMES, ...LINE_FAMILY_NAMES, ...Object.keys(equalsFamilies)],
};

export const earlyFactsPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(EARLY_FACTS, saved, random, now);
