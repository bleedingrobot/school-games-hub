/**
 * Year 5 ladder skills: Number (docs/plans/ladder-y5/PLAN.md). Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 * James: fluency and instant recall only. Easy, tidy numbers; one number to type or one tap of four; nothing to stop and work out.
 *
 * Types:
 *   place-million  pv5:worth  pv5:split
 *   compare-big    big5:biggest  big5:smallest
 *   count-big      cnt5:more  cnt5:less  cnt5:next
 *   mental-big     ment5:add  ment5:take  ment5:big
 *   missing-big    miss5:add  miss5:sub  miss5:nines
 *   times-2by1     mul5:times  mul5:flip  mul5:split
 */
import { int, isInt, show, type Family } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { goodPick, pick, rollPick } from './pickKit';
import type { Y6Row } from './y6Row';

const plain = (n: number) => String(n);
const dig = (n: number, unit: number) => Math.floor(n / unit) % 10;
const digitsOf = (n: number) => String(n).split('').map(Number);

// ---------------------------------------------------------------- place-million: what a digit is worth, and splitting

const PV_TAGS = ['MS.Y5.NUM.NS.P1'];

const rollWorth = (_k: string, r: () => number) => {
  for (;;) {
    const len = int(r, 5, 6);
    const n = int(r, 10 ** (len - 1), 10 ** len - 1);
    const pos = int(r, 0, len - 2);
    const ds = digitsOf(n);
    if (ds[pos] >= 1 && ds.filter((d) => d === ds[pos]).length === 1) return [n, pos];
  }
};

/** Three non-zero digits, so there are exactly three parts: 305 040 = 300 000 + 5 000 + 40. */
const parts3 = (n: number): number[] | null => {
  if (!isInt(n, 10000, 999999)) return null;
  const ds = digitsOf(n);
  const out = ds.map((d, i) => d * 10 ** (ds.length - 1 - i)).filter((v) => v > 0);
  return out.length === 3 ? out : null;
};

const rollSplit = (_k: string, r: () => number) => {
  for (;;) {
    const len = int(r, 5, 6);
    const at = [int(r, 0, len - 1), int(r, 0, len - 1), int(r, 0, len - 1)];
    if (new Set(at).size < 3) continue;
    return [at.reduce((sum, p) => sum + int(r, 1, 9) * 10 ** p, 0)];
  }
};

const pvFamilies = [
  oneKey('pv5:worth', 'What a digit is worth (in 482 316, the 8 is worth ?)', PV_TAGS, 2, rollWorth, (_k, [n, pos]) => {
    if (!isInt(n, 10000, 999999)) return null;
    const ds = digitsOf(n);
    if (!isInt(pos, 0, ds.length - 2)) return null;
    const d = ds[pos];
    if (d < 1 || ds.filter((x) => x === d).length !== 1) return null;
    const answer = d * 10 ** (ds.length - 1 - pos);
    const parts = ['In', `${show(n)},`, 'the', String(d), 'is worth', '?'];
    return withMistakes(
      { parts, spoken: `In ${n}, the ${d} is worth what?`, answer, fact: `In ${show(n)}, the ${d} is worth ${show(answer)}` },
      { 'gave the digit': d, 'one place too small': answer / 10, 'one place too big': answer * 10, 'counted the places from the wrong end': d * 10 ** pos, 'two places too big': answer * 100 },
    );
  }),
  oneKey('pv5:split', 'Splitting a number (305 040 = 300 000 + ? + 40)', PV_TAGS, 1, rollSplit, (_k, [n]) => {
    const comps = parts3(n);
    if (!comps) return null;
    const [a, b, c] = comps;
    const parts = [show(n), '=', show(a), '+', '?', '+', show(c)];
    return withMistakes(
      { parts, spoken: `${n} equals ${a} plus what plus ${c}?`, answer: b, fact: `${show(n)} = ${show(a)} + ${show(b)} + ${show(c)}` },
      { 'gave the digit only': Number(String(b)[0]), 'one place too small': b / 10, 'one place too big': b * 10, 'two places too big': b * 100, 'two places too small': b / 100 },
    );
  }),
];

// ---------------------------------------------------------------- compare-big: biggest and smallest of four

const BIG_TAGS = ['MS.Y5.NUM.NS.P2'];

const swapAt = (n: number, i: number) => {
  const ds = digitsOf(n);
  [ds[i], ds[i + 1]] = [ds[i + 1], ds[i]];
  return Number(ds.join(''));
};

/**
 * Biggest: R is 6 digits; F has 5 digits but a bigger first digit; S is R with two digits swapped; T shares R's first digit.
 * Smallest: R is 5 digits; F has 6 digits but a smaller first digit; S is R with two digits swapped; T shares R's first digit.
 */
function goodBig(biggest: boolean, [R, F, S, T]: number[]): boolean {
  const lo = biggest ? 100000 : 10000;
  const hi = biggest ? 999999 : 99999;
  if (![R, S, T].every((v) => isInt(v, lo, hi)) || !isInt(F, biggest ? 10000 : 100000, biggest ? 99999 : 999999)) return false;
  if (new Set([R, F, S, T]).size !== 4) return false;
  const rs = String(R);
  const len = rs.length;
  const first = Number(rs[0]);
  const firstF = Number(String(F)[0]);
  if (biggest ? !(first <= 8 && firstF > first) : !(first >= 2 && firstF < first && firstF >= 1)) return false;
  // S: one swap of neighbouring digits (not the first), landing on the wrong side of R.
  let swapped = false;
  for (let i = 1; i < len - 1; i++) {
    if (swapAt(R, i) === S && (biggest ? rs[i] > rs[i + 1] : rs[i] < rs[i + 1])) swapped = true;
  }
  if (!swapped) return false;
  // T: same first digit, a different second digit on the wrong side of R.
  const ts = String(T);
  if (Number(ts[0]) !== first) return false;
  return biggest ? Number(ts[1]) < Number(rs[1]) : Number(ts[1]) > Number(rs[1]);
}

const rollBig = (biggest: boolean) => (_k: string, r: () => number) => {
  const len = biggest ? 6 : 5;
  for (;;) {
    const ds = [int(r, biggest ? 1 : 2, biggest ? 8 : 9), ...Array.from({ length: len - 1 }, () => int(r, 0, 9))];
    const R = Number(ds.join(''));
    const swaps = [];
    for (let i = 1; i < len - 1; i++) if (biggest ? ds[i] > ds[i + 1] : ds[i] < ds[i + 1]) swaps.push(i);
    if (!swaps.length || (biggest ? ds[1] < 1 : ds[1] > 8)) continue;
    const S = swapAt(R, swaps[int(r, 0, swaps.length - 1)]);
    const t2 = biggest ? int(r, 0, ds[1] - 1) : int(r, ds[1] + 1, 9);
    const T = Number([ds[0], t2, ...Array.from({ length: len - 2 }, () => int(r, 0, 9))].join(''));
    const f = biggest ? int(r, ds[0] + 1, 9) : int(r, 1, ds[0] - 1);
    const F = Number([f, ...Array.from({ length: biggest ? 4 : 5 }, () => int(r, 0, 9))].join(''));
    if (goodBig(biggest, [R, F, S, T])) return [R, F, S, T, ...rollPick(r)];
  }
};

function bigFamily(key: string, biggest: boolean): Family {
  const word = biggest ? 'biggest' : 'smallest';
  return oneKey(key, `The ${word} of four numbers (482 316, 95 810 ...)`, BIG_TAGS, 6, rollBig(biggest), (_k, [R, F, S, T, slot, salt]) => {
    if (!goodBig(biggest, [R, F, S, T]) || !goodPick(slot, salt)) return null;
    const made = pick(
      { parts: [biggest ? 'Biggest' : 'Smallest', '=', '?'], spoken: `Which of these numbers is the ${word}?`, fact: `${show(R)} is the ${word}` },
      show(R),
      {
        'went by the first digit only': show(F),
        'mixed up the order of two digits': show(S),
        'stopped at the first digit': show(T),
      },
      { slot, salt },
    );
    return made ? { ...made, prompt: `Which is the ${word}?` } : null;
  });
}

const bigFamilies = [bigFamily('big5:biggest', true), bigFamily('big5:smallest', false)];

// ---------------------------------------------------------------- count-big: counting in 1000s, 10 000s and 100 000s

const CNT_TAGS = ['MS.Y5.NUM.NS.P3'];
const STEPS = [1000, 10000, 100000];
const unitFor = (step: number) => (step === 100000 ? 1000 : 50);

/** Changes one place, or crosses just one place along (49 000 + 1000, 70 250 − 1000). */
function stepOk(n: number, step: number, up: boolean): boolean {
  if (!STEPS.includes(step) || !isInt(n, Math.max(step, 10000), 999999) || n % unitFor(step) !== 0) return false;
  const r = up ? n + step : n - step;
  if (!isInt(r, 1000, 999999)) return false;
  const d = dig(n, step);
  if (up) return d <= 8 || dig(n, step * 10) <= 8;
  return d >= 1 || dig(n, step * 10) >= 1;
}

const rollStep = (up: boolean) => (_k: string, r: () => number) => {
  for (;;) {
    const step = STEPS[int(r, 0, 2)];
    const u = unitFor(step);
    const n = u * int(r, Math.ceil(Math.max(step, 10000) / u), Math.floor(999999 / u));
    if (stepOk(n, step, up)) return [n, step];
  }
};

const stepNames = (n: number, step: number, up: boolean): Named => {
  const r = up ? n + step : n - step;
  const sign = up ? 1 : -1;
  return {
    'went the wrong way': n - sign * step,
    'changed the next place along': n + sign * step * 10,
    'changed the place below': n + sign * (step / 10),
    'counted in the wrong size': n + sign * (step === 1000 ? 10000 : 1000),
    [up ? 'forgot to carry' : 'forgot to take from the next place']: up ? r - step * 10 : r + step * 10,
    'left the number as it was': n,
  };
};

const SEQ_STEP_OK = (a: number, step: number, up: boolean) => {
  if (!STEPS.includes(step) || !isInt(a, 1000, 999999) || a % unitFor(step) !== 0) return false;
  const d = dig(a, step);
  const end = up ? a + 3 * step : a - 3 * step;
  return isInt(end, 1000, 999999) && (up ? d + 3 <= 9 : d - 3 >= 0);
};

const cntFamilies = [
  oneKey('cnt5:more', 'Adding 1000, 10 000 or 100 000 (46 300 + 10 000)', CNT_TAGS, 2, rollStep(true), (_k, [n, step]) => {
    if (!stepOk(n, step, true)) return null;
    const answer = n + step;
    const parts = [show(n), '+', show(step), '=', '?'];
    return withMistakes({ parts, spoken: `${n} plus ${step} equals what?`, answer, fact: `${show(n)} + ${show(step)} = ${show(answer)}` }, stepNames(n, step, true));
  }),
  oneKey('cnt5:less', 'Taking away 1000, 10 000 or 100 000 (1000 less than 70 250)', CNT_TAGS, 2, rollStep(false), (_k, [n, step]) => {
    if (!stepOk(n, step, false)) return null;
    const answer = n - step;
    const parts = [show(step), 'less than', show(n), '=', '?'];
    return withMistakes({ parts, spoken: `${step} less than ${n} equals what?`, answer, fact: `${show(step)} less than ${show(n)} is ${show(answer)}` }, stepNames(n, step, false));
  }),
  oneKey(
    'cnt5:next',
    'Counting on in 1000s, 10 000s or 100 000s (23 500, 33 500, 43 500, ?)',
    CNT_TAGS,
    3,
    (_k, r) => {
      for (;;) {
        const step = STEPS[int(r, 0, 2)];
        const u = unitFor(step);
        const a = u * int(r, Math.ceil(1000 / u), Math.floor(999999 / u));
        const dir = int(r, 0, 1);
        if (SEQ_STEP_OK(a, step, dir === 0)) return [a, step, dir];
      }
    },
    (_k, [a, step, dir]) => {
      if (!isInt(dir, 0, 1) || !SEQ_STEP_OK(a, step, dir === 0)) return null;
      const sign = dir === 0 ? 1 : -1;
      const seq = [0, 1, 2, 3].map((i) => a + sign * step * i);
      const answer = seq[3];
      const last = seq[2];
      const parts = [`${show(seq[0])},`, `${show(seq[1])},`, `${show(seq[2])},`, '?'];
      return withMistakes(
        { parts, prompt: 'What comes next?', spoken: `${seq.slice(0, 3).join(', ')}, what comes next?`, answer, fact: `${seq.map(show).join(', ')}` },
        {
          'repeated the last number': last,
          'went backwards': last - sign * step,
          'changed the next place along': last + sign * step * 10,
          'changed the place below': last + sign * (step / 10),
          'skipped one': last + sign * 2 * step,
        },
      );
    },
  ),
];

// ---------------------------------------------------------------- mental-big: thousands in your head

const MENT_TAGS = ['MS.Y5.NUM.OP.P1'];

const rollAdd = (_k: string, r: () => number) => {
  for (;;) {
    const a = 500 * int(r, 2, 19);
    const b = 500 * int(r, 2, 19);
    if (a % 1000 === 500 || b % 1000 === 500) return [a, b];
  }
};
const goodAdd = (a: number, b: number) => isInt(a, 1000, 9500) && isInt(b, 1000, 9500) && a % 500 === 0 && b % 500 === 0 && (a % 1000 === 500 || b % 1000 === 500);

const rollTake = (_k: string, r: () => number) => {
  for (;;) {
    const a = 500 * int(r, 4, 40);
    const b = 100 * int(r, 1, 99);
    if (b % 1000 !== 0 && a - b >= 500 && b <= 9900) return [a, b];
  }
};
const goodTake = (a: number, b: number) => isInt(a, 2000, 20000) && a % 500 === 0 && isInt(b, 100, 9900) && b % 100 === 0 && b % 1000 !== 0 && a - b >= 500;

const goodBigStep = (n: number, k: number, op: number) => {
  if (!isInt(n, 10000, 90000) || n % 1000 !== 0 || !isInt(k, 2, 9) || !isInt(op, 0, 1)) return false;
  const u = dig(n, 1000);
  return op === 0 ? u + k >= 10 && n + k * 1000 <= 100000 : u < k;
};

const mentFamilies = [
  oneKey('ment5:add', 'Adding thousands in your head (4 500 + 3 500)', MENT_TAGS, 2, rollAdd, (_k, [a, b]) => {
    if (!goodAdd(a, b)) return null;
    const answer = a + b;
    const parts = [show(a), '+', show(b), '=', '?'];
    return withMistakes(
      { parts, spoken: `${a} plus ${b} equals what?`, answer, fact: `${show(a)} + ${show(b)} = ${show(answer)}` },
      {
        'forgot the two halves make a thousand': answer - 1000,
        'added the thousands only': (a - (a % 1000)) + (b - (b % 1000)),
        'one thousand too many': answer + 1000,
        'took away instead': Math.abs(a - b),
        'one zero too few': answer / 10,
      },
    );
  }),
  oneKey('ment5:take', 'Taking away thousands in your head (7 000 − 2 400)', MENT_TAGS, 2, rollTake, (_k, [a, b]) => {
    if (!goodTake(a, b)) return null;
    const answer = a - b;
    // Each place taken the smaller from the bigger, whichever way round (7000 − 2400 → 5400).
    const slip = Math.abs(Math.floor(a / 1000) - Math.floor(b / 1000)) * 1000 + Math.abs((a % 1000) - (b % 1000));
    const parts = [show(a), '−', show(b), '=', '?'];
    return withMistakes(
      { parts, spoken: `${a} take away ${b} equals what?`, answer, fact: `${show(a)} − ${show(b)} = ${show(answer)}` },
      { 'took the smaller digit from the bigger': slip, 'one thousand too many': answer + 1000, 'one thousand too few': answer - 1000, 'added instead': a + b, 'one zero too few': answer / 10 },
    );
  }),
  oneKey(
    'ment5:big',
    'Thousands across a ten thousand (36 000 + 9 000)',
    MENT_TAGS,
    3,
    (_k, r) => {
      for (;;) {
        const n = 1000 * int(r, 10, 90);
        const k = int(r, 2, 9);
        const op = int(r, 0, 1);
        if (goodBigStep(n, k, op)) return [n, k, op];
      }
    },
    (_k, [n, k, op]) => {
      if (!goodBigStep(n, k, op)) return null;
      const add = op === 0;
      const answer = add ? n + k * 1000 : n - k * 1000;
      const u = dig(n, 1000);
      const parts = [show(n), add ? '+' : '−', show(k * 1000), '=', '?'];
      const named: Named = add
        ? { 'forgot to carry': answer - 10000, 'took away instead': n - k * 1000, 'one thousand too many': answer + 1000, 'one thousand too few': answer - 1000, 'added hundreds': n + k * 100 }
        : { 'took the smaller digit from the bigger': Math.floor(n / 10000) * 10000 + (k - u) * 1000, 'added instead': n + k * 1000, 'one thousand too many': answer + 1000, 'one thousand too few': answer - 1000, 'took away hundreds': n - k * 100 };
      return withMistakes(
        { parts, spoken: `${n} ${add ? 'plus' : 'take away'} ${k * 1000} equals what?`, answer, fact: `${show(n)} ${add ? '+' : '−'} ${show(k * 1000)} = ${show(answer)}` },
        named,
      );
    },
  ),
];

// ---------------------------------------------------------------- missing-big: easy missing numbers

const MISS_TAGS = ['MS.Y5.NUM.OP.P2'];
/** u is the size of the missing number's unit: 1000 or 10 000. The total is a whole 10u (50 000, 800 000). */
const goodMiss = (u: number, t: number, k: number) => (u === 1000 || u === 10000) && isInt(t, 2, 9) && isInt(k, 1, 10);
const rollMiss = (_k: string, r: () => number) => [r() < 0.5 ? 1000 : 10000, int(r, 2, 9), int(r, 1, 10)];
const NINES = [99999, 999999];
const goodNines = (len: number, p: number, d: number) => (len === 5 || len === 6) && isInt(p, 0, len - 1) && isInt(d, 1, 8);

const missFamilies = [
  oneKey('miss5:add', 'Missing number to a tidy total (45 000 + ? = 50 000)', MISS_TAGS, 3, rollMiss, (_k, [u, t, k]) => {
    if (!goodMiss(u, t, k)) return null;
    const total = t * 10 * u;
    const answer = k * u;
    const a = total - answer;
    const parts = [show(a), '+', '?', '=', show(total)];
    return withMistakes(
      { parts, spoken: `${a} plus what equals ${total}?`, answer, fact: `${show(a)} + ${show(answer)} = ${show(total)}` },
      { 'one place too big': answer * 10, 'one place too small': answer / 10, 'added the two numbers': a + total, 'gave the total': total, 'one step too few': answer - u, 'one step too many': answer + u },
    );
  }),
  oneKey('miss5:sub', 'Missing number taken away (900 000 − ? = 800 000)', MISS_TAGS, 3, rollMiss, (_k, [u, t, k]) => {
    if (!goodMiss(u, t, k)) return null;
    const total = t * 10 * u;
    const answer = k * u;
    const b = total - answer;
    const parts = [show(total), '−', '?', '=', show(b)];
    return withMistakes(
      { parts, spoken: `${total} take away what equals ${b}?`, answer, fact: `${show(total)} − ${show(answer)} = ${show(b)}` },
      { 'one place too big': answer * 10, 'one place too small': answer / 10, 'added the two numbers': total + b, 'gave the number it makes': b, 'one step too few': answer - u, 'one step too many': answer + u },
    );
  }),
  oneKey(
    'miss5:nines',
    'Missing number with nines (999 999 − ? = 899 999)',
    MISS_TAGS,
    3,
    (_k, r) => {
      for (;;) {
        const len = int(r, 5, 6);
        const p = int(r, 0, len - 1);
        const d = int(r, 1, 8);
        if (goodNines(len, p, d)) return [len, p, d];
      }
    },
    (_k, [len, p, d]) => {
      if (!goodNines(len, p, d)) return null;
      const top = NINES[len - 5];
      const answer = d * 10 ** p;
      const b = top - answer;
      const parts = [show(top), '−', '?', '=', show(b)];
      return withMistakes(
        { parts, spoken: `${top} take away what equals ${b}?`, answer, fact: `${show(top)} − ${show(answer)} = ${show(b)}` },
        { 'gave the digit only': d, 'gave the digit that changed to': 9 - d, 'one place too big': answer * 10, 'one place too small': answer / 10, 'two places too big': answer * 100 },
      );
    },
  ),
];

// ---------------------------------------------------------------- times-2by1: 2-digit times 1-digit, easy ones

const MUL_TAGS = ['MS.Y5.NUM.OP.P3'];
/** Tens digit 1 to 4, ones digit 1 to 5, ones times n at most 15 (one small carry), answer 100 or less. */
const goodMul = (x: number, n: number) => {
  if (!isInt(x, 11, 45) || !isInt(n, 2, 9)) return false;
  const t = Math.floor(x / 10);
  const o = x % 10;
  return isInt(t, 1, 4) && isInt(o, 1, 5) && o * n <= 15 && x * n <= 100;
};
const rollMul = (_k: string, r: () => number) => {
  for (;;) {
    const x = 10 * int(r, 1, 4) + int(r, 1, 5);
    const n = int(r, 2, 9);
    if (goodMul(x, n)) return [x, n];
  }
};
const mulNames = (x: number, n: number): Named => {
  const t = Math.floor(x / 10);
  const o = x % 10;
  const answer = x * n;
  return {
    'forgot the ones': t * n * 10,
    'times-ed the tens and added the ones': t * n * 10 + o,
    'forgot to carry': t * n * 10 + ((o * n) % 10),
    'one group too many': answer + n,
    'one group too few': answer - n,
    'added instead': x + n,
  };
};

const mulFamilies = [
  oneKey('mul5:times', '2-digit times 1-digit (23 × 4)', MUL_TAGS, 2, rollMul, (_k, [x, n]) => {
    if (!goodMul(x, n)) return null;
    const answer = x * n;
    return withMistakes({ parts: [plain(x), '×', plain(n), '=', '?'], spoken: `${x} times ${n} equals what?`, answer, fact: `${x} × ${n} = ${answer}` }, mulNames(x, n));
  }),
  oneKey('mul5:flip', '1-digit times 2-digit (4 × 23)', MUL_TAGS, 2, rollMul, (_k, [x, n]) => {
    if (!goodMul(x, n)) return null;
    const answer = x * n;
    return withMistakes({ parts: [plain(n), '×', plain(x), '=', '?'], spoken: `${n} times ${x} equals what?`, answer, fact: `${n} × ${x} = ${answer}` }, mulNames(x, n));
  }),
  oneKey('mul5:split', 'The ones part of a times (23 × 4 = 80 + ?)', MUL_TAGS, 2, rollMul, (_k, [x, n]) => {
    if (!goodMul(x, n)) return null;
    const t = Math.floor(x / 10);
    const o = x % 10;
    const answer = o * n;
    return withMistakes(
      { parts: [plain(x), '×', plain(n), '=', plain(t * n * 10), '+', '?'], spoken: `${x} times ${n} equals ${t * n * 10} plus what?`, answer, fact: `${x} × ${n} = ${t * n * 10} + ${answer}` },
      { 'gave the ones digit': o, 'times-ed the tens digit': t * n, 'added instead': o + n, 'gave the whole answer': x * n, 'gave the tens part again': t * n * 10 },
    );
  }),
];

// ---------------------------------------------------------------- the lot

export const Y5_NUMBER_FAMILIES: Record<string, Family> = Object.fromEntries([...pvFamilies, ...bigFamilies, ...cntFamilies, ...mentFamilies, ...missFamilies, ...mulFamilies].map((f) => [f.keys[0], f]));

export const Y5_NUMBER_SKILL_KEYS: Record<string, readonly string[]> = {
  'place-million': ['pv5:worth', 'pv5:split'],
  'compare-big': ['big5:biggest', 'big5:smallest'],
  'count-big': ['cnt5:more', 'cnt5:less', 'cnt5:next'],
  'mental-big': ['ment5:add', 'ment5:take', 'ment5:big'],
  'missing-big': ['miss5:add', 'miss5:sub', 'miss5:nines'],
  'times-2by1': ['mul5:times', 'mul5:flip', 'mul5:split'],
};

export const Y5_NUMBER_SLOW_KEYS: string[] = ['mul5:times', 'mul5:flip', 'mul5:split'];

export const Y5_NUMBER_LADDER: readonly Y6Row[] = [
  { id: 'place-million', label: 'Place value to a million', tiny: 'Place value to 1M', stage: 'place-value', after: 'add-tenths', tags: PV_TAGS, year: 5 },
  { id: 'compare-big', label: 'Biggest and smallest to a million', tiny: 'Biggest to 1M', stage: 'place-value', after: 'place-million', tags: BIG_TAGS, year: 5 },
  { id: 'count-big', label: 'Counting in 1000s, 10 000s and 100 000s', tiny: 'Count in 1000s', stage: 'place-value', after: 'compare-big', tags: CNT_TAGS, year: 5 },
  { id: 'mental-big', label: 'Adding and taking away thousands in your head', tiny: 'Thousands in head', stage: 'place-value', after: 'count-big', tags: MENT_TAGS, year: 5 },
  { id: 'missing-big', label: 'Missing numbers with big numbers', tiny: 'Missing big numbers', stage: 'algebra', after: 'mental-big', tags: MISS_TAGS, year: 5 },
  { id: 'times-2by1', label: '2-digit times 1-digit in your head (23 × 4)', tiny: '2-digit × 1-digit', stage: 'place-value', after: 'times-tens', tags: MUL_TAGS, year: 5 },
];
