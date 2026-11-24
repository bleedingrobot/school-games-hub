/**
 * Powers, primes and factors, Year 7 and 8 (docs/plans/ladder-7-8/PLAN.md section 3b, card Y4).
 *
 * Quick recall only: one number to type or one of four choices to tap. Powers and roots are written with Unicode
 * superscripts (10⁴, 2³, 10⁻²). A blank power can't be a superscript, so those questions show "10 000 = 10ⁿ. What is n?" above the sum and ask n = ?.
 *
 * Types:
 *   powers-10     (Y7) pow:ten  pow:zeros  pow:times  pow:same
 *   exponents     (Y7) exp:value  exp:repeat  exp:plus
 *   primes        (Y7) prime:which  prime:not
 *   divisibility  (Y7) divis:by
 *   hcf-lcm       (Y7) hcf:of  hcf:lcm
 *   prime-factors (Y8) pf:mult  pf:power  pf:which
 *   neg-powers    (Y8) negpow:dec  negpow:exp
 */
import { int, isInt, type Family, type Made } from '../banded';
import { oneKey, say, withMistakes } from './generatedKit';
import { goodPick, pick, rollPick, talk } from './pickKit';

const Y7_POW = ['MS.Y7.NUM.NS.P9', 'MS.Y7.NUM.NS.P10'];
const Y7_PRIME = ['MS.Y7.NUM.NS.P11', 'MS.Y7.NUM.NS.P12'];
const Y7_FACT = ['MS.Y7.NUM.NS.P13'];
const Y8 = ['MS.Y8.NUM.NS.P9', 'MS.Y8.NUM.NS.P10'];

// ---------------------------------------------------------------- small helpers

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 4 → "⁴", -2 → "⁻²". */
export const sup = (n: number) => (n < 0 ? '⁻' : '') + [...String(Math.abs(n))].map((d) => SUP[Number(d)]).join('');
/** pw(10, 4) → "10⁴"; a power of 1 is just the base. */
export const pw = (base: number, e: number) => (e === 1 ? String(base) : `${base}${sup(e)}`);

/** 10000 → "10 000" (NZ style for 5 or more digits, like the rest of the ladder). */
const spaced = (n: number) => (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+$)/g, ' ') : String(n));

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const smallestFactor = (n: number) => {
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
  return n;
};

/** The two pick numbers every pick family here ends with. */
const withPick = (random: () => number, ...params: number[]) => [...params, ...rollPick(random)];
const pickOf = <T>(random: () => number, items: readonly T[]) => items[int(random, 0, items.length - 1)];

/** A pick question with its prompt and fact filled in. */
function choose(parts: string[], prompt: string, spoken: string, right: string, named: Record<string, string>, slot: number, salt: number, fact: string): Made | null {
  const made = pick({ parts, spoken, fact }, right, named, { slot, salt });
  return made ? { ...made, prompt } : null;
}

// ---------------------------------------------------------------- powers-10 (Y7)

/** "10⁴ = ?" (typed). */
const powTen = oneKey(
  'pow:ten',
  'A power of ten written out (10⁴ = 10 000)',
  Y7_POW,
  1,
  (_k, r) => [int(r, 2, 6)],
  (_k, [n]) => {
    if (!isInt(n, 2, 6)) return null;
    const parts = [pw(10, n), '=', '?'];
    return withMistakes({ parts, spoken: talk(parts), answer: 10 ** n }, { 'wrote n × 10': n * 10, 'one zero too many': 10 ** (n + 1), 'one zero too few': 10 ** (n - 1), 'added n to 10': 10 + n, 'wrote n': n });
  },
);

/** "10 000 = 10ⁿ, n = ?" (typed): the number of zeros. */
const powZeros = oneKey(
  'pow:zeros',
  'Which power of ten a number is (10 000 = 10ⁿ)',
  Y7_POW,
  1,
  (_k, r) => [int(r, 2, 6)],
  (_k, [n]) => {
    if (!isInt(n, 2, 6)) return null;
    const v = spaced(10 ** n);
    const parts = ['n', '=', '?'];
    return withMistakes(
      { parts, prompt: `${v} = 10ⁿ. What is n?`, spoken: `${v} equals 10 to the power of n. What is n?`, answer: n },
      { 'counted the digits': n + 1, 'one zero too few': n - 1, 'times 10': n * 10, 'two too many': n + 2 },
    );
  },
);

/** "3 × 10³ = ?" (typed). */
const powTimes = oneKey(
  'pow:times',
  'A number times a power of ten (3 × 10³)',
  Y7_POW,
  2,
  (_k, r) => [int(r, 2, 9), int(r, 2, 4)],
  (_k, [a, n]) => {
    if (!isInt(a, 2, 9) || !isInt(n, 2, 4)) return null;
    const parts = [String(a), '×', pw(10, n), '=', '?'];
    return withMistakes(
      { parts, spoken: talk(parts), answer: a * 10 ** n },
      { 'left out the number': 10 ** n, 'one zero too many': a * 10 ** (n + 1), 'one zero too few': a * 10 ** (n - 1), 'multiplied the two numbers': a * n },
    );
  },
);

/** "Which power of 10 is 10 000?" (tap 10⁴). */
const powSame = oneKey(
  'pow:same',
  'Which power of ten a number is (tap 10⁴)',
  Y7_POW,
  3,
  (_k, r) => withPick(r, int(r, 2, 6)),
  (_k, [n, slot, salt]) => {
    if (!isInt(n, 2, 6) || !goodPick(slot, salt)) return null;
    const v = spaced(10 ** n);
    return choose(
      [v, '=', '?'],
      'Which power of 10 is it?',
      `Which power of 10 is ${v}?`,
      pw(10, n),
      { 'counted the digits': pw(10, n + 1), 'one zero too few': pw(10, n - 1), 'two zeros too many': pw(10, n + 2), 'two zeros too few': n > 2 ? pw(10, n - 2) : pw(10, n + 3) },
      slot,
      salt,
      `${v} = ${pw(10, n)}`,
    );
  },
);

// ---------------------------------------------------------------- exponents (Y7)

/** "2⁵ = ?" (typed, answer 256 or less). */
const expValue = oneKey(
  'exp:value',
  'Working out a small power (2⁵, 3³, 5²)',
  Y7_POW,
  2,
  (_k, r) => [int(r, 2, 12), int(r, 2, 8)],
  (_k, [b, e]) => {
    if (!isInt(b, 2, 12) || !isInt(e, 2, 8) || b ** e > 256) return null;
    const parts = [pw(b, e), '=', '?'];
    return withMistakes(
      { parts, spoken: talk(parts), answer: b ** e },
      { 'multiplied the base by the power': b * e, 'one power too many': b ** (e + 1), 'one power too few': b ** (e - 1), 'added the base and the power': b + e },
    );
  },
);

/** "5 × 5 × 5 = ?" (tap 5³). */
const expRepeat = oneKey(
  'exp:repeat',
  'Repeated multiplying as a power (5 × 5 × 5 = 5³)',
  Y7_POW,
  4,
  (_k, r) => withPick(r, int(r, 2, 9), int(r, 2, 4)),
  (_k, [b, e, slot, salt]) => {
    if (!isInt(b, 2, 9) || !isInt(e, 2, 4) || !goodPick(slot, salt)) return null;
    const product = Array(e).fill(b).join(' × ');
    const named: Record<string, string> = { 'one power too many': pw(b, e + 1), 'one power too few': pw(b, e - 1) };
    // "2 × 2 = 4" would make the 2 × 2 choice 4 a right answer too.
    // 2⁴ and 4² are both 16, so swapping them isn't a wrong choice for those.
    if (e ** b !== b ** e) named['swapped the base and the power'] = pw(e, b);
    if (b * e !== b ** e) named['multiplied the base by the count'] = String(b * e);
    return choose([product, '=', '?'], 'Which is the same?', `Which is the same as ${product.replace(/×/g, 'times')}?`, pw(b, e), named, slot, salt, `${product} = ${pw(b, e)}`);
  },
);

/** "6² + 1 = ?" (typed, two steps). */
const expPlus = oneKey(
  'exp:plus',
  'A power plus or take away a small number (6² + 1)',
  Y7_POW,
  4,
  (_k, r) => [int(r, 2, 10), int(r, 2, 3), int(r, 1, 9), int(r, 0, 1)],
  (_k, [b, e, c, minus]) => {
    if (!isInt(b, 2, 10) || !isInt(e, 2, 3) || !isInt(c, 1, 9) || !isInt(minus, 0, 1) || b ** e > 100 || (minus === 1 && b ** e <= c)) return null;
    const sign = minus ? -1 : 1;
    const parts = [pw(b, e), minus ? '−' : '+', String(c), '=', '?'];
    return withMistakes(
      { parts, spoken: talk(parts), answer: b ** e + sign * c },
      { 'forgot the power': b + sign * c, 'multiplied the base by the power': b * e + sign * c, 'did the sum first': (b + sign * c) ** e, 'ignored the last number': b ** e, 'went the other way': b ** e - sign * c },
    );
  },
);

// ---------------------------------------------------------------- primes (Y7)

/** Primes a pupil should know to 100, and odd composites that look prime. */
const PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const LOOKS_PRIME = [21, 27, 33, 39, 49, 51, 55, 57, 63, 65, 69, 77, 81, 85, 87, 91, 93, 95];
const oddButFactors = (n: number) => `${n} is odd but ${smallestFactor(n)} × ${n / smallestFactor(n)}`;

/** "Which is prime?" (tap the prime among three odd composites). */
const primeWhich = oneKey(
  'prime:which',
  'Which number is prime (49, 53, 57, 63)',
  Y7_PRIME,
  6,
  (_k, r) => {
    const cs = new Set<number>();
    while (cs.size < 3) cs.add(pickOf(r, LOOKS_PRIME));
    return withPick(r, pickOf(r, PRIMES), ...cs);
  },
  (_k, [p, c1, c2, c3, slot, salt]) => {
    const cs = [c1, c2, c3];
    if (!PRIMES.includes(p) || !cs.every((c) => LOOKS_PRIME.includes(c)) || new Set(cs).size !== 3 || !goodPick(slot, salt)) return null;
    const named = Object.fromEntries(cs.map((c) => [oddButFactors(c), String(c)]));
    return choose(['Prime number', '=', '?'], 'Which is prime?', 'Which of these numbers is prime?', String(p), named, slot, salt, `${p} is prime`);
  },
);

/** "Which is NOT prime?" (tap the odd composite among three primes). */
const primeNot = oneKey(
  'prime:not',
  'Which number is not prime (53, 59, 61, 51)',
  Y7_PRIME,
  6,
  (_k, r) => {
    const ps = new Set<number>();
    while (ps.size < 3) ps.add(pickOf(r, PRIMES));
    return withPick(r, pickOf(r, LOOKS_PRIME), ...ps);
  },
  (_k, [c, p1, p2, p3, slot, salt]) => {
    const ps = [p1, p2, p3];
    if (!LOOKS_PRIME.includes(c) || !ps.every((p) => PRIMES.includes(p)) || new Set(ps).size !== 3 || !goodPick(slot, salt)) return null;
    const named = Object.fromEntries(ps.map((p) => [`picked ${p}, which is prime`, String(p)]));
    return choose(['Not prime', '=', '?'], 'Which is NOT prime?', 'Which of these numbers is not prime?', String(c), named, slot, salt, `${oddButFactors(c)}, so ${c} is not prime`);
  },
);

// ---------------------------------------------------------------- divisibility (Y7)

const DIVISORS = [3, 4, 6, 8, 9];

/** The slips for "which is divisible by d?", from a true multiple `m`. `t` makes the "ends in d" number (10t + d). */
function divisibleSlips(d: number, m: number, t: number): Record<string, number> {
  const ends = 10 * t + d;
  const slips: Record<string, number> =
    d === 3 ? { 'digit sum one too many': m + 1, 'digit sum one too few': m - 1, 'ends in 3': ends, 'digit sum two too many': m + 2 }
    : d === 4 ? { 'even but not a multiple of 4': m + 2, 'even but not a multiple of 4 (below)': m - 2, 'ends in 4': ends, 'one more than a multiple of 4': m + 1 }
    : d === 6 ? { 'divisible by 3 only': m + 3, 'divisible by 3 only (below)': m - 3, 'divisible by 2 only': m + 2, 'ends in 6': ends }
    : d === 8 ? { 'divisible by 4 only': m + 4, 'divisible by 4 only (below)': m - 4, 'even but not a multiple of 8': m + 2, 'ends in 8': ends }
    : { 'divisible by 3 only': m + 3, 'divisible by 3 only (below)': m - 3, 'digit sum 8': m - 1, 'ends in 9': ends };
  // A slip is only a slip if it really isn't a multiple.
  return Object.fromEntries(Object.entries(slips).filter(([, n]) => n > 0 && n % d !== 0));
}

/** "Which is divisible by 9?" (tap the multiple). */
const divBy = oneKey(
  'divis:by',
  'Which number is divisible by 3, 4, 6, 8 or 9',
  Y7_FACT,
  5,
  (_k, r) => {
    const d = pickOf(r, DIVISORS);
    return withPick(r, d, int(r, Math.ceil(24 / d), Math.floor(198 / d)), int(r, 1, 19));
  },
  (_k, [d, k, t, slot, salt]) => {
    if (!DIVISORS.includes(d) || !isInt(k, 1, 66) || !isInt(t, 1, 19) || !goodPick(slot, salt)) return null;
    const m = d * k;
    if (m < 24 || m > 198) return null;
    const named = Object.fromEntries(Object.entries(divisibleSlips(d, m, t)).map(([name, n]) => [name, String(n)]));
    return choose([`Divisible by ${d}`, '=', '?'], `Which is divisible by ${d}?`, `Which of these numbers is divisible by ${d}?`, String(m), named, slot, salt, `${m} is divisible by ${d}`);
  },
);

// ---------------------------------------------------------------- hcf-lcm (Y7, two steps)

/** "HCF of 24 and 36 = ?" (typed). */
const hcfOf = oneKey(
  'hcf:of',
  'Highest common factor of two numbers to 60 (24 and 36)',
  Y7_FACT,
  2,
  (_k, r) => {
    const a = int(r, 6, 48);
    return [a, int(r, a + 2, 60)];
  },
  (_k, [a, b]) => {
    if (!isInt(a, 6, 48) || !isInt(b, a + 2, 60)) return null;
    const g = gcd(a, b);
    if (g < 2 || g >= a) return null;
    const parts = [`HCF of ${a} and ${b}`, '=', '?'];
    const sp = smallestFactor(g);
    return withMistakes(
      { parts, spoken: `What is the highest common factor of ${a} and ${b}?`, answer: g },
      { 'gave the LCM': lcm(a, b), 'gave the smaller number': a, 'gave the difference': b - a, 'gave 1': 1, 'a common factor, not the highest': sp < g ? g / sp : NaN },
    );
  },
);

/** "LCM of 4 and 6 = ?" (typed). */
const hcfLcm = oneKey(
  'hcf:lcm',
  'Least common multiple of two numbers to 12 (4 and 6)',
  Y7_FACT,
  2,
  (_k, r) => {
    const a = int(r, 2, 11);
    return [a, int(r, a + 1, 12)];
  },
  (_k, [a, b]) => {
    if (!isInt(a, 2, 11) || !isInt(b, a + 1, 12) || b % a === 0) return null;
    const parts = [`LCM of ${a} and ${b}`, '=', '?'];
    return withMistakes(
      { parts, spoken: `What is the least common multiple of ${a} and ${b}?`, answer: lcm(a, b) },
      { 'multiplied them': a * b, 'gave the HCF': gcd(a, b), 'added them': a + b, 'gave the bigger number': b, 'doubled the bigger number': 2 * b },
    );
  },
);

// ---------------------------------------------------------------- prime-factors (Y8)

const PF_PRIMES = [2, 3, 5, 7];

/** "2³ × 3 = ?" (typed, two steps). */
const pfMult = oneKey(
  'pf:mult',
  'Prime factors with powers, multiplied out (2³ × 3)',
  Y8,
  4,
  (_k, r) => {
    const p = pickOf(r, PF_PRIMES.slice(0, 3));
    return [p, int(r, 2, 3), pickOf(r, PF_PRIMES.filter((q) => q > p)), int(r, 1, 2)];
  },
  (_k, [p, e, q, f]) => {
    if (!PF_PRIMES.includes(p) || !PF_PRIMES.includes(q) || q <= p || !isInt(e, 2, 3) || !isInt(f, 1, 2)) return null;
    const answer = p ** e * q ** f;
    if (answer > 300) return null;
    const parts = [pw(p, e), '×', pw(q, f), '=', '?'];
    return withMistakes(
      { parts, spoken: talk(parts), answer },
      { 'multiplied the base by the power': p * e * q ** f, 'added the two': p ** e + q ** f, 'one power too many': p ** (e + 1) * q ** f, 'one power too few': p ** (e - 1) * q ** f, 'multiplied the bases': p * q },
    );
  },
);

/** "36 = 2² × 3ⁿ, n = ?" (typed, two steps). */
const pfPower = oneKey(
  'pf:power',
  'A missing power in prime factors (36 = 2² × 3ⁿ)',
  Y8,
  4,
  (_k, r) => {
    const p = pickOf(r, PF_PRIMES.slice(0, 2));
    return [p, int(r, 2, 3), pickOf(r, PF_PRIMES.filter((q) => q > p)), int(r, 2, 3)];
  },
  (_k, [p, e, q, f]) => {
    if (!PF_PRIMES.includes(p) || !PF_PRIMES.includes(q) || q <= p || !isInt(e, 2, 3) || !isInt(f, 2, 3)) return null;
    const v = p ** e * q ** f;
    if (v > 200) return null;
    const parts = ['n', '=', '?'];
    return withMistakes(
      { parts, prompt: `${v} = ${pw(p, e)} × ${q}ⁿ. What is n?`, spoken: `${v} equals ${p} to the power of ${e} times ${q} to the power of n. What is n?`, answer: f },
      { 'added the powers': e + f, 'one too many': f + 1, 'one too few': f - 1, 'gave the other prime': q, 'gave the first power': e },
    );
  },
);

/** Numbers whose prime factors are quick to find. */
const PF_NUMBERS = [12, 18, 20, 24, 28, 30, 36, 40, 45, 48, 50, 60, 63, 72, 75, 90, 100];

/** n as [prime, power] pairs, smallest prime first. */
function primeFactors(n: number): [number, number][] {
  const out: [number, number][] = [];
  let rest = n;
  for (let p = 2; rest > 1; p++) {
    let e = 0;
    while (rest % p === 0) {
      rest /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  return out;
}
const asPrimes = (fs: [number, number][]) => fs.filter(([, e]) => e > 0).map(([p, e]) => pw(p, e)).join(' × ');

/** "Which is 60 as primes?" (tap 2² × 3 × 5). */
const pfWhich = oneKey(
  'pf:which',
  'A number written with prime factors (60 = 2² × 3 × 5)',
  Y8,
  3,
  (_k, r) => withPick(r, pickOf(r, PF_NUMBERS)),
  (_k, [n, slot, salt]) => {
    if (!PF_NUMBERS.includes(n) || !goodPick(slot, salt)) return null;
    const fs = primeFactors(n);
    const bump = (i: number, by: number) => fs.map(([p, e], j): [number, number] => [p, j === i ? e + by : e]);
    const last = fs.length - 1;
    const named: Record<string, string> = {
      'left out a prime': asPrimes(bump(0, -1)),
      'left out a prime (the last)': asPrimes(bump(last, -1)),
      'one prime too many': asPrimes(bump(0, 1)),
      'one prime too many (the last)': asPrimes(bump(last, 1)),
    };
    // A product that is right but not all prime.
    const [p0, e0] = fs[0];
    if (e0 >= 2) named['wrote a square number, not a prime'] = [String(p0 ** e0), ...fs.slice(1).map(([p, e]) => pw(p, e))].join(' × ');
    if (n / p0 > 3 && !isPrime(n / p0)) named['stopped before all primes'] = `${p0} × ${n / p0}`;
    return choose(['' + n, '=', '?'], `Which is ${n} as primes?`, `Which of these is ${n} written as a product of prime numbers?`, asPrimes(fs), named, slot, salt, `${n} = ${asPrimes(fs)}`);
  },
);

// ---------------------------------------------------------------- neg-powers (Y8)

/** 3 → "0.001". */
const tenth = (n: number) => (n <= 0 ? String(10 ** -n) : `0.${'0'.repeat(n - 1)}1`);

/** "10⁻² = ?" (tap 0.01). */
const negDec = oneKey(
  'negpow:dec',
  'A negative power of ten as a decimal (10⁻² = 0.01)',
  Y8,
  3,
  (_k, r) => withPick(r, int(r, 2, 4)),
  (_k, [n, slot, salt]) => {
    if (!isInt(n, 2, 4) || !goodPick(slot, salt)) return null;
    const parts = [pw(10, -n), '=', '?'];
    return choose(
      parts,
      'Write it as a decimal.',
      `${pw(10, -n).replace(/⁻.*/, '')} to the power of negative ${n} equals what?`,
      tenth(n),
      { 'one place too few': tenth(n - 1), 'one place too many': tenth(n + 1), 'went big instead of small': String(10 ** n), 'wrote n tenths': `0.${n}` },
      slot,
      salt,
      `${pw(10, -n)} = ${tenth(n)}`,
    );
  },
);

/** "0.001 = ?" (tap 10⁻³). */
const negExp = oneKey(
  'negpow:exp',
  'A decimal as a negative power of ten (0.001 = 10⁻³)',
  Y8,
  3,
  (_k, r) => withPick(r, int(r, 2, 4)),
  (_k, [n, slot, salt]) => {
    if (!isInt(n, 2, 4) || !goodPick(slot, salt)) return null;
    return choose(
      [tenth(n), '=', '?'],
      'Write it as a power of 10.',
      `${say(Number(tenth(n)))} equals 10 to the power of what?`,
      pw(10, -n),
      { 'forgot the minus': pw(10, n), 'one too few': pw(10, -(n - 1)), 'one too far': pw(10, -(n + 1)), 'two too far': pw(10, -(n + 2)) },
      slot,
      salt,
      `${tenth(n)} = ${pw(10, -n)}`,
    );
  },
);

// ---------------------------------------------------------------- the lot

export const POWER_FAMILIES: Record<string, Family> = Object.fromEntries(
  [powTen, powZeros, powTimes, powSame, expValue, expRepeat, expPlus, primeWhich, primeNot, divBy, hcfOf, hcfLcm, pfMult, pfPower, pfWhich, negDec, negExp].map((f) => [f.keys[0], f]),
);

export const POWER_SKILL_KEYS = {
  'powers-10': ['pow:ten', 'pow:zeros', 'pow:times', 'pow:same'],
  exponents: ['exp:value', 'exp:repeat', 'exp:plus'],
  primes: ['prime:which', 'prime:not'],
  divisibility: ['divis:by'],
  'hcf-lcm': ['hcf:of', 'hcf:lcm'],
  'prime-factors': ['pf:mult', 'pf:power', 'pf:which'],
  'neg-powers': ['negpow:dec', 'negpow:exp'],
};

/** The two-step types: 12 seconds counts as quick (slow.ts). */
export const POWER_SLOW_KEYS: string[] = ['exp:plus', 'hcf:of', 'hcf:lcm', 'pf:mult', 'pf:power', 'pf:which'];

type PowerStage = 'place-value';
export const POWER_LADDER: { id: keyof typeof POWER_SKILL_KEYS; label: string; tiny: string; stage: PowerStage; year: 7 | 8; tags: string[] }[] = [
  { id: 'powers-10', label: 'Powers of ten', tiny: 'Powers of ten', stage: 'place-value', year: 7, tags: Y7_POW },
  { id: 'exponents', label: 'Exponents (2⁵, 3³)', tiny: 'Exponents', stage: 'place-value', year: 7, tags: Y7_POW },
  { id: 'primes', label: 'Prime numbers to 100', tiny: 'Prime numbers', stage: 'place-value', year: 7, tags: Y7_PRIME },
  { id: 'divisibility', label: 'Divisibility rules', tiny: 'Divisibility rules', stage: 'place-value', year: 7, tags: Y7_FACT },
  { id: 'hcf-lcm', label: 'Highest common factor and least common multiple', tiny: 'HCF and LCM', stage: 'place-value', year: 7, tags: Y7_FACT },
  { id: 'prime-factors', label: 'Prime factors with powers', tiny: 'Prime factors', stage: 'place-value', year: 8, tags: Y8 },
  { id: 'neg-powers', label: 'Negative powers of ten', tiny: 'Negative powers', stage: 'place-value', year: 8, tags: Y8 },
];
