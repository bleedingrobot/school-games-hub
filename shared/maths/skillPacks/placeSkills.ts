/**
 * The generated place-value skills of the ladder: pairs that make 100 (bonds-100) and 1000 (bonds-1000), times with tens and
 * hundreds (times-tens), factor pairs (factor-pairs), and square and cube numbers (squares-cubes).
 *
 * One mastery record per question type (generatedKit.ts). Every question here can be worked out again from how it is shown
 * (its parts), because the server marks solo-game and placement answers that way. That is why no question here asks the
 * student to pick from choices that aren't in the parts. Wrong choices (when the class has multiple choice on) come from
 * named common mistakes.
 *
 * Types:
 *   bonds-100    bond100:tens  bond100:fives  bond100:any  bond100:take
 *   bonds-1000   bond1000:hundreds  bond1000:fifties  bond1000:tens  bond1000:take
 *   times-tens   times:tens  times:hundreds  times:tens-tens  times:shift  times:powers  times:div-tens
 *   factor-pairs factor:pair  factor:count  factor:largest  factor:common
 *   squares-cubes square:of  cube:of  square:root  cube:root  square:next
 */
import { int, isInt, pickOne, show, speak, type Family } from '../banded';
import { oneKey, readNumber, withMistakes, type Named, type Parser } from './generatedKit';

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const divisorsOf = (n: number) => range(1, n).filter((d) => n % d === 0);

// ---------------------------------------------------------------- pairs that make 100 and 1000

type BondType = 'tens' | 'fives' | 'any' | 'take';

/** Which type "a + ? = total" is, from the number shown (a pair of tens, of fives, or any). */
function bondTypeOf(total: 100 | 1000, a: number): BondType | null {
  if (!Number.isInteger(a) || a < 1 || a >= total) return null;
  if (total === 100) return a % 10 === 0 ? 'tens' : a % 5 === 0 ? 'fives' : 'any';
  return a % 100 === 0 ? 'tens' : a % 50 === 0 ? 'fives' : a % 10 === 0 ? 'any' : null;
}

/** Bond1000 names its types for hundreds (100s), fifties (50s) and tens, so its type words differ. */
const BOND_WORD: Record<100 | 1000, Record<BondType, string>> = {
  100: { tens: 'tens', fives: 'fives', any: 'any', take: 'take' },
  1000: { tens: 'hundreds', fives: 'fifties', any: 'tens', take: 'take' },
};

function bondFamily(total: 100 | 1000, type: BondType, label: string, tags: string[]): Family {
  const word = BOND_WORD[total][type];
  const key = `bond${total}:${word}`;
  const valid = (a: number) => (type === 'take' ? total === 100 ? isInt(a, 1, 99) : isInt(a, 10, 990) && a % 10 === 0 : bondTypeOf(total, a) === type);
  const candidates = range(1, total - 1).filter(valid);
  return oneKey(
    key,
    label,
    tags,
    2,
    (_k, r) => [pickOne(r, candidates), int(r, 0, 1)],
    (_k, [a, v]) => {
      if (!valid(a) || !isInt(v, 0, 1)) return null;
      const t = String(total);
      const answer = total - a;
      const parts = type === 'take' ? [t, '−', String(a), '=', '?'] : v === 0 ? [String(a), '+', '?', '=', t] : ['?', '+', String(a), '=', t];
      const named: Named =
        total === 100
          ? {
              'forgot to carry the one': answer - 1,
              'made both digits add to ten': (10 - Math.floor(a / 10)) * 10 + (10 - (a % 10)),
              'ignored the ones': 100 - Math.floor(a / 10) * 10,
              'one ten too many': answer + 10,
              'one ten too few': answer - 10,
            }
          : {
              'one hundred too many': answer + 100,
              'one hundred too few': answer - 100,
              'one ten too many': answer + 10,
              'one ten too few': answer - 10,
              'made the hundreds add to ten': a % 100 === 0 ? 10 - a / 100 : -1,
            };
      return withMistakes({ parts, spoken: speak(parts), answer }, named, { ok: (n) => n >= 1 && n < total });
    },
  );
}

const parseBond = (total: 100 | 1000): Parser => (parts) => {
  const t = String(total);
  if (parts.length !== 5 || parts[3] !== '=') return null;
  let a: number | null = null;
  let type: BondType | null = null;
  if (parts[1] === '+' && parts[0] === '?' && parts[2] !== '?' && parts[4] === t) a = readNumber(parts[2]);
  else if (parts[1] === '+' && parts[2] === '?' && parts[0] !== '?' && parts[4] === t) a = readNumber(parts[0]);
  else if (parts[1] === '−' && parts[0] === t && parts[4] === '?') {
    a = readNumber(parts[2]);
    type = 'take';
  }
  if (a === null) return null;
  type ??= bondTypeOf(total, a);
  if (!type) return null;
  const key = `bond${total}:${BOND_WORD[total][type]}`;
  return { key, params: [a, parts[0] === '?' ? 1 : 0] };
};

// ---------------------------------------------------------------- times with tens and hundreds

const TENS = range(20, 90, 10);
const HUNDREDS = range(200, 900, 100);
const POWERS = [10, 100, 1000];
const isTens = (n: number) => TENS.includes(n);
const isHundreds = (n: number) => HUNDREDS.includes(n);

/** The type of "x × y" (in the order shown), or null. A fact from the times tables is never one of these. */
function timesKeyOf(x: number, y: number): string | null {
  const pair = (test: (n: number) => boolean, other: (n: number) => boolean) => (test(x) && other(y)) || (test(y) && other(x));
  const digit = (n: number) => n >= 2 && n <= 9;
  if (pair(digit, isTens)) return 'times:tens';
  if (pair(digit, isHundreds)) return 'times:hundreds';
  if (isTens(x) && isTens(y)) return 'times:tens-tens';
  if (pair((n) => n >= 13 && n <= 99 && n % 10 !== 0, (n) => n === 10 || n === 100)) return 'times:shift';
  if (POWERS.includes(x) && POWERS.includes(y) && !(x === 10 && y === 10)) return 'times:powers';
  return null;
}

function timesFamily(key: string, label: string, pools: [number[], number[]]): Family {
  return oneKey(
    key,
    label,
    ['MS.Y4.NUM.OP.P3'],
    2,
    (_k, r) => {
      const pair = [pickOne(r, pools[0]), pickOne(r, pools[1])];
      return r() < 0.5 ? pair : pair.reverse();
    },
    (_k, [x, y]) => {
      if (!isInt(x, 1, 1000) || !isInt(y, 1, 1000) || timesKeyOf(x, y) !== key) return null;
      const answer = x * y;
      const parts = [show(x), '×', show(y), '=', '?'];
      const named: Named = {
        'left out a zero': answer / 10,
        'put in an extra zero': answer * 10,
        'added instead of multiplying': x + y,
        'one step too many': answer + Math.max(x, y),
        'one step too few': answer - Math.max(x, y),
      };
      if (key === 'times:tens-tens') named['multiplied the tens only'] = (x / 10) * (y / 10);
      if (key === 'times:powers') named['two zeros too many'] = answer * 100;
      return withMistakes({ parts, spoken: speak(parts), answer }, named);
    },
  );
}

const divTens = oneKey(
  'times:div-tens',
  'Dividing tens (240 ÷ 6)',
  ['MS.Y4.NUM.OP.P3'],
  2,
  (_k, r) => [int(r, 2, 9), pickOne(r, TENS)],
  (_k, [d, q]) => {
    if (!isInt(d, 2, 9) || !isTens(q)) return null;
    const n = d * q;
    const parts = [show(n), '÷', String(d), '=', '?'];
    return withMistakes(
      { parts, spoken: speak(parts), answer: q },
      { 'left out a zero': q / 10, 'put in an extra zero': q * 10, 'took away instead of dividing': n - d, 'one ten too many': q + 10, 'one ten too few': q - 10 },
    );
  },
);

const parseTimes: Parser = (parts) => {
  if (parts.length !== 5 || parts[3] !== '=' || parts[4] !== '?') return null;
  const x = readNumber(parts[0]);
  const y = readNumber(parts[2]);
  if (x === null || y === null) return null;
  if (parts[1] === '×') {
    const key = timesKeyOf(x, y);
    return key ? { key, params: [x, y] } : null;
  }
  return parts[1] === '÷' && y >= 2 && y <= 9 && isTens(x / y) ? { key: 'times:div-tens', params: [y, x / y] } : null;
};

// ---------------------------------------------------------------- factor pairs

const PAIR_NUMBERS = [12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48, 50, 54, 56, 60, 63, 64, 72, 80, 81, 84, 90, 96, 100];
const COUNT_NUMBERS = [6, 8, 10, 12, 14, 15, 16, 18, 20, 21, 24, 28, 30, 32, 36, 40, 42, 45, 48];
const LARGEST_NUMBERS = [6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 27, 28, 30, 32, 35, 36, 40, 42, 45, 48, 49, 50, 54, 56, 60, 63, 64, 72, 81];
const factorTags = ['MS.Y5.NUM.NS.P2'];

const smallestPrime = (n: number) => range(2, n).find((d) => n % d === 0)!;
/** Two numbers whose biggest shared factor is `g`, found as g × a and g × b with a and b sharing nothing. */
const commonPairs = range(2, 12).flatMap((g) => range(2, 6).flatMap((a) => range(a + 1, 7).filter((b) => gcd(a, b) === 1 && g * b <= 60).map((b) => [g * a, g * b])));

const factorFamilies: Family[] = [
  oneKey(
    'factor:pair',
    'Finding the other number in a factor pair',
    factorTags,
    2,
    (_k, r) => {
      const n = pickOne(r, PAIR_NUMBERS);
      return [n, pickOne(r, divisorsOf(n).filter((d) => d >= 2 && d < n))];
    },
    (_k, [n, a]) => {
      if (!PAIR_NUMBERS.includes(n) || !isInt(a, 2, n - 1) || n % a !== 0) return null;
      const answer = n / a;
      const parts = [String(a), 'and', '?', 'are a factor pair of', String(n)];
      return withMistakes(
        { parts, spoken: `${a} and what are a factor pair of ${n}?`, answer, fact: `${a} × ${answer} = ${n}, so ${a} and ${answer} are a factor pair of ${n}` },
        { 'took away': n - a, 'added': n + a, 'one too many': answer + 1, 'one too few': answer - 1, 'the number itself': n },
      );
    },
  ),
  oneKey(
    'factor:count',
    'Counting the factors of a number',
    factorTags,
    1,
    (_k, r) => [pickOne(r, COUNT_NUMBERS)],
    (_k, [n]) => {
      if (!COUNT_NUMBERS.includes(n)) return null;
      const answer = divisorsOf(n).length;
      const parts = ['How many factors does', String(n), 'have', '?'];
      return withMistakes(
        { parts, spoken: `How many factors does ${n} have?`, answer, fact: `${n} has ${answer} factors: ${divisorsOf(n).join(', ')}` },
        { 'left out 1 and the number': answer - 2, 'counted the pairs': answer / 2, 'one too many': answer + 1, 'one too few': answer - 1, 'two too many': answer + 2 },
      );
    },
  ),
  oneKey(
    'factor:largest',
    'The biggest factor of a number apart from itself',
    factorTags,
    1,
    (_k, r) => [pickOne(r, LARGEST_NUMBERS)],
    (_k, [n]) => {
      if (!LARGEST_NUMBERS.includes(n)) return null;
      const answer = n / smallestPrime(n);
      const parts = ['Biggest factor of', String(n), 'except itself', '=', '?'];
      return withMistakes(
        { parts, spoken: `What is the biggest factor of ${n}, except ${n} itself?`, answer },
        { 'one less than the number': n - 1, 'half of it': n / 2, 'a third of it': n / 3, 'the smallest factor': smallestPrime(n), 'one more': answer + 1, 'one less': answer - 1 },
      );
    },
  ),
  oneKey(
    'factor:common',
    'The biggest number that goes into two numbers',
    factorTags,
    2,
    (_k, r) => [...pickOne(r, commonPairs)],
    (_k, [a, b]) => {
      if (!commonPairs.some(([x, y]) => x === a && y === b)) return null;
      const answer = gcd(a, b);
      const parts = ['Biggest number that goes into', String(a), 'and', String(b), '=', '?'];
      return withMistakes(
        { parts, spoken: `What is the biggest number that goes into both ${a} and ${b}?`, answer },
        { 'the smaller number': a, 'one more': answer + 1, 'one less': answer - 1, 'half of it': answer / 2, 'the difference': b - a, 'double': answer * 2 },
      );
    },
  ),
];

const parseFactors: Parser = (parts) => {
  const n = (i: number) => readNumber(parts[i] ?? '');
  if (parts.length === 5 && parts[1] === 'and' && parts[2] === '?' && parts[3] === 'are a factor pair of') {
    const a = n(0);
    const big = n(4);
    return a !== null && big !== null ? { key: 'factor:pair', params: [big, a] } : null;
  }
  if (parts.length === 4 && parts[0] === 'How many factors does' && parts[2] === 'have' && parts[3] === '?') {
    const big = n(1);
    return big !== null ? { key: 'factor:count', params: [big] } : null;
  }
  if (parts.length === 5 && parts[0] === 'Biggest factor of' && parts[2] === 'except itself' && parts[3] === '=' && parts[4] === '?') {
    const big = n(1);
    return big !== null ? { key: 'factor:largest', params: [big] } : null;
  }
  if (parts.length === 6 && parts[0] === 'Biggest number that goes into' && parts[2] === 'and' && parts[4] === '=' && parts[5] === '?') {
    const a = n(1);
    const b = n(3);
    return a !== null && b !== null ? { key: 'factor:common', params: [a, b] } : null;
  }
  return null;
};

// ---------------------------------------------------------------- squares and cubes

const squareTags = ['MS.Y6.NUM.NS.P6'];
const SQUARES = range(2, 12).map((n) => n * n);
const CUBES = range(2, 5).map((n) => n ** 3);
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n));

const squareFamilies: Family[] = [
  oneKey(
    'square:of',
    'Square numbers (7 squared)',
    squareTags,
    1,
    (_k, r) => [int(r, 2, 12)],
    (_k, [n]) => {
      if (!isInt(n, 2, 12)) return null;
      const parts = [String(n), 'squared', '=', '?'];
      return withMistakes(
        { parts, spoken: `${n} squared equals what?`, answer: n * n, fact: `${n} squared is ${n} × ${n} = ${n * n}` },
        { 'doubled it': 2 * n, 'cubed it': n ** 3, 'the square before': (n - 1) ** 2, 'the square after': (n + 1) ** 2, 'times the next number': n * (n + 1) },
      );
    },
  ),
  oneKey(
    'cube:of',
    'Cube numbers (4 cubed)',
    squareTags,
    1,
    (_k, r) => [int(r, 2, 5)],
    (_k, [n]) => {
      if (!isInt(n, 2, 5)) return null;
      const parts = [String(n), 'cubed', '=', '?'];
      return withMistakes(
        { parts, spoken: `${n} cubed equals what?`, answer: n ** 3, fact: `${n} cubed is ${n} × ${n} × ${n} = ${n ** 3}` },
        { 'times 3': 3 * n, 'squared it': n * n, 'the cube before': (n - 1) ** 3, 'the cube after': (n + 1) ** 3, 'doubled the square': 2 * n * n },
      );
    },
  ),
  oneKey(
    'square:root',
    'Square roots of square numbers',
    squareTags,
    1,
    (_k, r) => [pickOne(r, SQUARES)],
    (_k, [sq]) => {
      if (!SQUARES.includes(sq)) return null;
      const root = Math.sqrt(sq);
      const parts = ['Square root of', String(sq), '=', '?'];
      return withMistakes(
        { parts, spoken: `What is the square root of ${sq}?`, answer: root, fact: `The square root of ${sq} is ${root}, because ${root} × ${root} = ${sq}` },
        { 'half of it': sq / 2, 'one root too many': root + 1, 'one root too few': root - 1, 'a quarter of it': sq / 4, 'two roots too many': root + 2 },
      );
    },
  ),
  oneKey(
    'cube:root',
    'Cube roots of cube numbers',
    squareTags,
    1,
    (_k, r) => [pickOne(r, CUBES)],
    (_k, [cube]) => {
      if (!CUBES.includes(cube)) return null;
      const root = Math.round(Math.cbrt(cube));
      const parts = ['Cube root of', String(cube), '=', '?'];
      return withMistakes(
        { parts, spoken: `What is the cube root of ${cube}?`, answer: root, fact: `The cube root of ${cube} is ${root}, because ${root} × ${root} × ${root} = ${cube}` },
        { 'one root too many': root + 1, 'one root too few': root - 1, 'a third of it': cube / 3, 'the square root': Math.sqrt(cube), 'two roots too many': root + 2 },
      );
    },
  ),
  oneKey(
    'square:next',
    'The next square number',
    squareTags,
    1,
    (_k, r) => {
      for (;;) {
        const x = int(r, 5, 143);
        if (!isSquare(x)) return [x];
      }
    },
    (_k, [x]) => {
      if (!isInt(x, 5, 143) || isSquare(x)) return null;
      const root = Math.floor(Math.sqrt(x)) + 1;
      const parts = ['The next square number after', String(x), '=', '?'];
      return withMistakes(
        { parts, spoken: `What is the next square number after ${x}?`, answer: root * root },
        { 'the square before': (root - 1) ** 2, 'the square after that': (root + 1) ** 2, 'the root, not the square': root, 'one more': x + 1, 'one less than the square': root * root - 1 },
      );
    },
  ),
];

const parseSquares: Parser = (parts) => {
  const n = (i: number) => readNumber(parts[i] ?? '');
  const ends = parts[parts.length - 2] === '=' && parts[parts.length - 1] === '?';
  if (!ends) return null;
  if (parts.length === 4 && parts[1] === 'squared') return n(0) === null ? null : { key: 'square:of', params: [n(0)!] };
  if (parts.length === 4 && parts[1] === 'cubed') return n(0) === null ? null : { key: 'cube:of', params: [n(0)!] };
  if (parts.length === 4 && parts[0] === 'Square root of') return n(1) === null ? null : { key: 'square:root', params: [n(1)!] };
  if (parts.length === 4 && parts[0] === 'Cube root of') return n(1) === null ? null : { key: 'cube:root', params: [n(1)!] };
  if (parts.length === 4 && parts[0] === 'The next square number after') return n(1) === null ? null : { key: 'square:next', params: [n(1)!] };
  return null;
};

// ---------------------------------------------------------------- the lot

const bondTags100 = ['MS.Y3.NUM.OP.P1'];
const bondTags1000: string[] = [];

export const PLACE_FAMILIES: Record<string, Family> = Object.fromEntries(
  [
    bondFamily(100, 'tens', 'Pairs of tens that make 100', bondTags100),
    bondFamily(100, 'fives', 'Pairs that make 100, ending in 5', bondTags100),
    bondFamily(100, 'any', 'Any pair that makes 100', bondTags100),
    bondFamily(100, 'take', 'Taking a number away from 100', bondTags100),
    bondFamily(1000, 'tens', 'Hundreds that make 1000', bondTags1000),
    bondFamily(1000, 'fives', 'Pairs ending in 50 that make 1000', bondTags1000),
    bondFamily(1000, 'any', 'Pairs of tens that make 1000', bondTags1000),
    bondFamily(1000, 'take', 'Taking a number away from 1000', bondTags1000),
    timesFamily('times:tens', 'Times a number of tens (4 × 30)', [range(2, 9), TENS]),
    timesFamily('times:hundreds', 'Times a number of hundreds (6 × 300)', [range(2, 9), HUNDREDS]),
    timesFamily('times:tens-tens', 'Tens times tens (20 × 30)', [TENS, TENS]),
    timesFamily('times:shift', 'Times 10 and 100 (34 × 10)', [range(13, 99).filter((n) => n % 10 !== 0), [10, 100]]),
    timesFamily('times:powers', 'Times 10, 100 and 1000 together (10 × 100)', [POWERS, POWERS]),
    divTens,
    ...factorFamilies,
    ...squareFamilies,
  ].map((f) => [f.keys[0], f]),
);

export const PLACE_SKILL_KEYS = {
  'bonds-100': ['bond100:tens', 'bond100:fives', 'bond100:any', 'bond100:take'],
  'bonds-1000': ['bond1000:hundreds', 'bond1000:fifties', 'bond1000:tens', 'bond1000:take'],
  'times-tens': ['times:tens', 'times:hundreds', 'times:tens-tens', 'times:shift', 'times:powers', 'times:div-tens'],
  'factor-pairs': ['factor:pair', 'factor:count', 'factor:largest', 'factor:common'],
  'squares-cubes': ['square:of', 'cube:of', 'square:root', 'cube:root', 'square:next'],
};

/** Reads a question back into its type and numbers, or null when none of these skills asks it. */
export const parsePlace: Parser = (parts) => parseBond(100)(parts) ?? parseBond(1000)(parts) ?? parseTimes(parts) ?? parseFactors(parts) ?? parseSquares(parts);

