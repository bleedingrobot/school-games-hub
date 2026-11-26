/**
 * Help me for number work (docs/plans/help-me/PLAN.md H4-H7): bonds to 100 and 1000, rounding, times and divide by tens,
 * big numbers (place value, comparing, counting, mental sums), factors and remainders, squares, cubes, primes, powers,
 * negative numbers, BEDMAS and signs. Each helper reads only what the pupil sees and returns null for other questions.
 * Every card ends with a step that finishes in "?" so the pupil does the last bit.
 */
import { num, show, sum, words } from './read';
import type { HelpCard, HelpQuestion, Helper } from './types';

const card = (kind: string, title: string, ...steps: string[]): HelpCard => ({ kind, title, steps });

// ---------------------------------------------------------------- small readers

const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
/** "10⁴" → {base: 10, exp: 4}; "10⁻³" → exp −3; "3²" → exp 2. */
function power(t: string): { base: number; exp: number } | null {
  const m = /^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)$/.exec(t.trim());
  if (!m) return null;
  const exp = Number([...m[2]].map((c) => SUP[c]).join(''));
  return Number.isFinite(exp) ? { base: Number(m[1]), exp } : null;
}
const labelsOf = (q: HelpQuestion): string[] => (q.choiceLabels ? [...q.choiceLabels] : (q.choices ?? []).map((n) => show(n)));
const plain = (t: string) => t.replace(/[\s,]/g, '');
const zerosOf = (n: number) => { let z = 0; while (n > 0 && n % 10 === 0) { n /= 10; z++; } return z; };
const isPow10 = (n: number) => n >= 10 && /^10*$/.test(String(n));
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const PLACE: Record<number, string> = { [-3]: 'thousandths', [-4]: 'ten thousandths', [-5]: 'hundred thousandths', [-2]: 'hundredths', [-1]: 'tenths', 0: 'ones', 1: 'tens', 2: 'hundreds', 3: 'thousands', 4: 'ten thousands', 5: 'hundred thousands', 6: 'millions' };
const place = (e: number) => PLACE[e] ?? `10^${e}s`;

// ---------------------------------------------------------------- bonds to 100 and 1000

const bonds: Helper = (q) => {
  const s = sum(q);
  if (!s) return null;
  let total: number, known: number;
  if (s.op === '+' && s.c !== null && (s.a === null) !== (s.b === null) && (s.c === 100 || s.c === 1000)) { total = s.c; known = (s.a ?? s.b)!; }
  else if (s.op === '−' && s.a !== null && s.b !== null && s.c === null && (s.a === 100 || s.a === 1000)) { total = s.a; known = s.b; }
  else return null;
  if (!Number.isInteger(known) || known <= 0 || known >= total) return null;
  const take = s.op === '−';
  const head = take ? [`${total} − ${known} is the same as ${known} + ? = ${total}.`] : [];
  if (total === 100) {
    if (known % 10 === 0) {
      const t = known / 10;
      return card('bonds-100', 'Think in tens', ...head, `${known} is ${t} ${t === 1 ? 'ten' : 'tens'}, and 100 is 10 tens.`, `How many more tens make 10 tens? 10 − ${t} = ?`, 'Write that many tens as a number: ?');
    }
    const tens = Math.floor(known / 10), ones = known % 10;
    return card('bonds-100', 'Tens make 9, ones make 10', ...head,
      `Ones: ${ones} needs how many more to make 10?`,
      `Tens: ${tens} tens needs how many more tens to make 9?`,
      'Put the tens digit and the ones digit together: ?');
  }
  if (known % 100 === 0) {
    const h = known / 100;
    return card('bonds-1000', 'Think in hundreds', ...head, `${known} is ${h} ${h === 1 ? 'hundred' : 'hundreds'}, and 1000 is 10 hundreds.`, `10 − ${h} = ? hundreds`, 'Write that many hundreds as a number: ?');
  }
  const hundreds = Math.floor(known / 100), tens = Math.floor((known % 100) / 10), ones = known % 10;
  if (ones !== 0) return null;
  return card('bonds-1000', 'Hundreds make 9, tens make 10', ...head,
    `Tens: ${tens} tens needs how many more to make 10 tens?`,
    `Hundreds: ${hundreds} hundreds needs how many more to make 9 hundreds?`,
    'Put the hundreds, tens and a 0 together: ?');
};

// ---------------------------------------------------------------- rounding

function roundCard(text: string, e: number): HelpCard | null {
  const s = plain(text);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [ip, dp = ''] = s.split('.');
  const digitAt = (k: number) => (k >= 0 ? (ip[ip.length - 1 - k] ?? '0') : (dp[-k - 1] ?? '0'));
  const d = digitAt(e), dn = digitAt(e - 1);
  const up = Number(dn) >= 5;
  const where = place(e), next = place(e - 1);
  const carry = up && d === '9' ? ` (9 + 1 makes 10, so write 0 and carry 1 to the digit before)` : '';
  const finish = e >= 1 ? `Change every digit after the ${where} digit to 0: ?`
    : e === 0 ? 'Drop the decimal part and write the whole number: ?'
      : `Drop every digit after the ${where} digit: ?`;
  return card('rounding', 'Look next door', `Find the ${where} digit in ${text}: it is ${d}.`,
    `Look at the digit next door on the right (${next}): it is ${dn}.`,
    up ? `${dn} is 5 or more, so round up: the ${where} digit goes up by 1${carry}.` : `${dn} is 4 or less, so the ${where} digit stays the same.`,
    finish);
}

const rounding: Helper = (q) => {
  const p = q.parts;
  if (p.length === 3 && p[1] === '≈' && /decimal place/.test(q.prompt ?? '')) {
    const n = /(\d+) decimal place/.exec(q.prompt!);
    return n ? roundCard(p[0], -Number(n[1])) : null;
  }
  if (p.length !== 5 || p[0] !== 'Round' || p[3] !== '=' || p[4] !== '?') return null;
  const t = p[2].toLowerCase().replace(/^to the nearest\s*/, '').replace(/\s+/g, '');
  const table: Record<string, number> = { '10': 1, '100': 2, '1000': 3, '10000': 4, '100000': 5, wholenumber: 0, whole: 0, one: 0, ten: 1, hundred: 2, thousand: 3, tenthousand: 4, hundredthousand: 5, tenth: -1, hundredth: -2, thousandth: -3 };
  const e = table[t];
  return e === undefined ? null : roundCard(p[1], e);
};

// ---------------------------------------------------------------- times and divide by tens, ×2 digits

const timesTens: Helper = (q) => {
  const s = sum(q);
  if (!s || s.a === null || s.b === null || s.c !== null || !Number.isInteger(s.a) || !Number.isInteger(s.b) || s.a <= 0 || s.b <= 0) return null;
  const { a, b } = s;
  if (s.op === '×') {
    if (a <= 10 && b <= 10) return null;
    if (isPow10(a) && isPow10(b)) {
      const za = zerosOf(a), zb = zerosOf(b);
      return card('times-tens', 'Count the zeros', `${a} has ${za} ${za === 1 ? 'zero' : 'zeros'} and ${b} has ${zb} ${zb === 1 ? 'zero' : 'zeros'}.`, `Zeros altogether: ${za} + ${zb}.`, 'Write 1 and then that many zeros: ?');
    }
    const [p, other] = isPow10(a) ? [a, b] : isPow10(b) ? [b, a] : [0, 0];
    if (p && (p >= 100 || other >= 10)) {
      const z = zerosOf(p);
      return card('times-tens', `Times ${show(p)} slides the digits`, `Times ${show(p)}: every digit slides ${z} ${z === 1 ? 'place' : 'places'} to the left.`, `The ${z === 1 ? 'gap' : 'gaps'} on the right fill with 0.`, `${show(other)} × ${show(p)} = ?`);
    }
    const za = zerosOf(a), zb = zerosOf(b), z = za + zb;
    if (z === 0) return null;
    const a0 = a / 10 ** za, b0 = b / 10 ** zb;
    if (a0 > 12 || b0 > 12) return null;
    return card('times-tens', 'Do the fact, then add the zeros', `Cover the zeros: ${a0} × ${b0} = ${show(a0 * b0)}.`,
      `${z === 1 ? 'There was 1 zero' : `There were ${z} zeros`} altogether.`,
      `Put ${z === 1 ? 'that zero' : `those ${z} zeros`} on the end of ${show(a0 * b0)}: ?`);
  }
  if (s.op === '÷' && a >= 100 && a % 10 === 0 && b >= 2 && b <= 12 && a % b === 0) {
    let z = 0;
    while (a % 10 ** (z + 1) === 0 && (a / 10 ** (z + 1)) % b === 0) z++;
    if (z === 0) return null;
    const a0 = a / 10 ** z;
    return card('divide-tens', 'Cover the zeros', `Cover ${z === 1 ? 'the 0' : `${z} zeros`} on ${show(a)}: it is ${a0} ÷ ${b}, a tables fact.`,
      `Work out ${a0} ÷ ${b}, then put ${z === 1 ? 'the 0' : `the ${z} zeros`} back on the end: ?`);
  }
  return null;
};

/** 23 × 2, 2 × 15, 13 × 4 = 40 + ?: split the big number into tens and ones. */
const splitTimes: Helper = (q) => {
  const p = q.parts;
  let a: number | null, b: number | null, c: number | null = null;
  if (p.length === 7 && p[1] === '×' && p[3] === '=' && p[5] === '+' && p[6] === '?') { a = num(p[0]); b = num(p[2]); c = num(p[4]); }
  else {
    const s = sum(q);
    if (!s || s.op !== '×' || s.c !== null) return null;
    a = s.a; b = s.b;
  }
  if (a === null || b === null || !Number.isInteger(a) || !Number.isInteger(b)) return null;
  const big = Math.max(a, b), small = Math.min(a, b);
  if (small < 2 || small > 9 || big < (c !== null ? 11 : 13) || big > 999 || big % 10 === 0) return null;
  const tens = Math.floor(big / 10) * 10, ones = big % 10;
  if (c !== null) {
    if (tens * small !== c) return null;
    return card('times-split', 'Split the big number', `${big} is ${tens} + ${ones}.`, `${tens} × ${small} = ${c} is already done.`, `What is left is ${ones} × ${small} = ?`);
  }
  const parts: number[] = [];
  const hundreds = Math.floor(big / 100) * 100, t = Math.floor((big % 100) / 10) * 10;
  if (hundreds) parts.push(hundreds);
  if (t) parts.push(t);
  if (ones) parts.push(ones);
  const prods = parts.map((x) => x * small);
  return card('times-split', 'Split the big number', `Split ${big} into ${parts.join(' + ')}.`,
    `${parts.map((x, i) => `${x} × ${small} = ${show(prods[i])}`).join(', ')}.`, `Add the parts: ${prods.map(show).join(' + ')} = ?`);
};

// ---------------------------------------------------------------- big numbers (Year 5)

const placeValue: Helper = (q) => {
  const p = q.parts;
  if (p.length === 6 && p[0] === 'In' && p[2] === 'the' && p[4] === 'is worth' && p[5] === '?') {
    const n = plain(p[1]), d = p[3];
    const from = n.length - 1 - n.indexOf(d);
    if (!/^\d+$/.test(n) || n.indexOf(d) < 0) return null;
    return card('place-value', 'Count the places from the right', `Find the ${d} in ${p[1].replace(/,$/, '')}.`,
      'Say the places from the right: ones, tens, hundreds, thousands, ten thousands, hundred thousands.',
      `The ${d} is the ${ordinal(from + 1)} digit from the right. What is ${d} worth in that place? ?`);
  }
  if (p.length === 7 && p[1] === '=' && p[3] === '+' && p[5] === '+') {
    const n = num(p[0]);
    const idx = [2, 4, 6].filter((i) => p[i] === '?');
    if (n === null || idx.length !== 1) return null;
    const knownParts = [2, 4, 6].filter((i) => i !== idx[0]).map((i) => num(p[i]));
    if (knownParts.some((x) => x === null)) return null;
    const left = n - knownParts.reduce<number>((t, x) => t + (x ?? 0), 0);
    if (left <= 0) return null;
    const dig = String(left)[0];
    return card('place-value', 'Which digit is left over?', `Read ${p[0]} one digit at a time, with its place.`,
      `${[2, 4, 6].filter((i) => i !== idx[0]).map((i) => p[i]).join(' and ')} already use some of the digits. The digit left over is the ${dig}.`,
      `What is the ${dig} worth in its place? ?`);
  }
  return null;
};

const biggest: Helper = (q) => {
  const w = words(q);
  const big = /biggest|largest|greatest/i.test(w), small = /smallest|least/i.test(w);
  if (big === small || !q.parts.includes('?')) return null;
  const labs = labelsOf(q);
  const vals = labs.map((l) => (/^[−-]?\d[\d ]*$/.test(l) ? num(l) : null));
  if (labs.length < 2 || vals.some((v) => v === null || !Number.isInteger(v) || v < 0)) return null;
  const lens = labs.map((l) => plain(l).length);
  const same = lens.every((x) => x === lens[0]);
  return card('compare-big', 'Count digits, then compare from the left',
    same ? `All the numbers have ${lens[0]} digits.` : `Count the digits in each number. ${big ? 'More' : 'Fewer'} digits means ${big ? 'bigger' : 'smaller'}.`,
    same ? 'Compare the left-most digits first.' : `Cross out the numbers with ${big ? 'fewer' : 'more'} digits.`,
    'If the left-most digits match, look at the next digit along, and so on. The first digit that is different decides.',
    `Which number is the ${big ? 'biggest' : 'smallest'}? ?`);
};

const countBig: Helper = (q) => {
  const p = q.parts;
  let n: number | null, by: number | null, add: boolean;
  if (p.length === 5 && p[1] === '+' && p[3] === '=') { n = num(p[0]); by = num(p[2]); add = true; }
  else if (p.length === 5 && p[1] === 'less than' && p[3] === '=') { by = num(p[0]); n = num(p[2]); add = false; }
  else return null;
  if (n === null || by === null || !isPow10(by) || n < 1000 || by > 100000) return null;
  const e = zerosOf(by);
  const s = String(n);
  const d = s[s.length - 1 - e] ?? '0';
  const shown = p[add ? 0 : 2];
  const edge = add && d === '9' ? ' (9 + 1 makes 10, so it carries into the next place)' : !add && d === '0' ? ' (0 can’t go down, so borrow 1 from the next place)' : '';
  return card('count-big', `Only the ${place(e)} digit changes`, `${show(by)} is 1 in the ${place(e)} place.`, `In ${shown} the ${place(e)} digit is ${d}.`,
    `${add ? 'Adding' : 'Taking away'} ${show(by)} makes that digit go ${add ? 'up' : 'down'} by 1${edge}.`, 'Write the number with that digit changed: ?');
};

const mentalBig: Helper = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '+' && s.op !== '−') || s.c !== null || s.a === null || s.b === null) return null;
  const { a, b, op } = s;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a % 100 !== 0 || b % 100 !== 0 || (a < 1000 && b < 1000)) return null;
  const verb = op === '+' ? 'add' : 'take away';
  const lead = String(b)[0] + '0'.repeat(String(b).length - 1);
  const rest = b - Number(lead);
  if (rest === 0) {
    const k = zerosOf(b), unit = 10 ** k;
    const ak = Math.floor(a / unit), left = a % unit;
    return card('mental-big', `Work in ${place(k)}`, `${show(a)} is ${ak} ${place(k)}${left ? ` and ${left}` : ''}.`, `${ak} ${op} ${b / unit} = ? ${place(k)}.`,
      left ? `Put the ${left} back on the end: ?` : 'Write that many with the zeros back on: ?');
  }
  const mid = op === '+' ? a + Number(lead) : a - Number(lead);
  return card('mental-big', op === '+' ? 'Split the number you add' : 'Split the number you take away', `Split ${show(b)} into ${show(Number(lead))} and ${show(rest)}.`, `First ${verb} ${show(Number(lead))}: ${show(a)} ${op} ${show(Number(lead))} = ${show(mid)}.`,
    `Then ${verb} ${show(rest)}: ${show(mid)} ${op} ${show(rest)} = ?`);
};

const missingBig: Helper = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '+' && s.op !== '−')) return null;
  const known = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (known.length !== 2 || known.some((n) => !Number.isInteger(n) || n < 10000)) return null;
  if (s.op === '−' && s.a !== null && s.c !== null && /^9+$/.test(String(s.a))) {
    const A = String(s.a), C = String(s.c).padStart(A.length, '0');
    const diff = [...A].map((ch, i) => (ch !== C[i] ? i : -1)).filter((i) => i >= 0);
    if (A.length === C.length && diff.length === 1) {
      const e = A.length - 1 - diff[0];
      return card('missing-big', 'Spot the one digit that changed', `Line the numbers up: ${show(s.a)} and ${show(s.c)}.`, `Only the ${place(e)} digit is different: ${A[diff[0]]} and ${C[diff[0]]}.`,
        `${A[diff[0]]} − ${C[diff[0]]} = ? ${place(e)}. What number is that? ?`);
    }
  }
  let t = 1;
  while (known.every((n) => n % (t * 10) === 0)) t *= 10;
  if (t < 10 && !known.every((n) => n % 1000 === 0)) return null;
  const sc = (n: number | null) => (n === null ? '?' : show(n / t));
  const z = zerosOf(t);
  return card('missing-big', 'Cover the zeros', `Cover the ${z === 1 ? 'zero' : `${z} zeros`} on the end of each number: ${sc(s.a)} ${s.op} ${sc(s.b)} = ${sc(s.c)}.`,
    'Work out the missing number in that smaller sum.', `Put the ${z === 1 ? 'zero' : `${z} zeros`} back on the end: ?`);
};

// ---------------------------------------------------------------- factors, remainders, squares and cubes

const factors: Helper = (q) => {
  const p = q.parts;
  if (p.length === 5 && p[1] === 'and' && p[2] === '?' && /factor pair of/.test(p[3])) {
    const a = num(p[0]), n = num(p[4]);
    if (a === null || n === null) return null;
    return card('factors', 'A factor pair multiplies', `A factor pair is two numbers that multiply to make ${n}.`, `${a} × ? = ${n}`, `Use the ${a} times table backwards: ${n} ÷ ${a} = ?`);
  }
  if (p.length === 2 && /Which is a factor pair of/.test(p[0])) {
    const labs = labelsOf(q);
    const m = /^(\d+) and (\d+)$/.exec(labs[0] ?? '');
    if (!m) return null;
    return card('factors', 'Multiply each pair', `A factor pair multiplies to make ${p[1].replace('?', '')}.`, `Try the first choice: ${m[1]} × ${m[2]} = ?`, 'Do the same for the others. Which pair makes it? ?');
  }
  return null;
};

const remainders: Helper = (q) => {
  const p = q.parts;
  if (p.length === 6 && p[1] === '÷' && p[3] === '=' && /r$/.test(p[4]) && p[5] === '?') {
    const a = num(p[0]), b = num(p[2]), k = num(p[4].replace(/ r$/, ''));
    if (a === null || b === null || k === null) return null;
    return card('remainders', 'Whole lots, then what is left', `${k} lots of ${b} is ${k} × ${b} = ${k * b}.`, `How much is left over from ${a}?`, `${a} − ${k * b} = ?`);
  }
  if (p.length === 7 && p[1] === '÷' && p[3] === '=' && p[4] === '?' && p[5] === 'r') {
    const a = num(p[0]), b = num(p[2]), r = num(p[6]);
    if (a === null || b === null || r === null) return null;
    return card('remainders', 'Take off the left-over bit first', `Take the ${r} left over off ${a}: ${a} − ${r} = ${a - r}.`, `${a - r} shares exactly into lots of ${b}.`, `${a - r} ÷ ${b} = ?`);
  }
  return null;
};

const squares: Helper = (q) => {
  const p = q.parts;
  if (p.length === 4 && (p[1] === 'squared' || p[1] === 'cubed') && p[2] === '=') {
    const n = num(p[0]);
    if (n === null) return null;
    return p[1] === 'squared'
      ? card('squares', 'Times itself', 'Squared means a number times itself.', `${n} squared is ${n} × ${n}.`, `${n} × ${n} = ?`)
      : card('squares', 'Times itself three times', `Cubed means ${n} × ${n} × ${n}.`, `Do the first two: ${n} × ${n} = ${n * n}.`, `${n * n} × ${n} = ?`);
  }
  if (p.length === 4 && p[0] === 'Square root of' && p[2] === '=') {
    const n = num(p[1]);
    if (n === null || n <= 1) return null;
    const r = Math.round(Math.sqrt(n));
    const k = r > 10 ? 10 : r > 5 ? 5 : r > 2 ? 2 : 1;
    return card('squares', 'Which number times itself?', `The square root of ${n} is the number that times itself makes ${n}.`, `Benchmark: ${k} × ${k} = ${k * k}. Is ${n} bigger or smaller?`, `Try numbers on that side. Which number times itself makes ${n}? ?`);
  }
  if (p.length === 4 && p[0] === 'Cube root of' && p[2] === '=') {
    const n = num(p[1]);
    if (n === null) return null;
    return card('squares', 'Which number times itself three times?', `The cube root of ${n} is the number that makes ${n} when you multiply it by itself 3 times.`,
      'Try 1 × 1 × 1 = 1, then 2, then 3, and so on, until you get there.', `Which number, multiplied 3 times, makes ${n}? ?`);
  }
  if (p.length === 4 && /next square number after/.test(p[0])) {
    const n = num(p[1]);
    if (n === null) return null;
    const r = Math.floor(Math.sqrt(n));
    return card('squares', 'Find the square just below', `Squares are numbers times themselves. Find the one just below ${n}: ${r} × ${r} = ${r * r}.`, `The next square uses the next number up: ${r + 1}.`, `${r + 1} × ${r + 1} = ?`);
  }
  return null;
};

// ---------------------------------------------------------------- patterns the basic helper misses

const stepOf: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 3 || p[1] !== 'goes up by' || p[2] !== '?') return null;
  const items = p[0].split(',').map((x) => num(x.trim()));
  if (items.length < 3 || items.some((x) => x === null)) return null;
  const v = items as number[];
  return card('pattern', 'Take neighbours apart', `Pick two numbers side by side: ${show(v[0])} and ${show(v[1])}.`,
    `Check with another pair, like ${show(v[v.length - 2])} and ${show(v[v.length - 1])}: the jump is the same.`, `Bigger − smaller: ${show(v[1])} − ${show(v[0])} = ?`);
};

// ---------------------------------------------------------------- BEDMAS and signs

const apply = (a: number, op: string, b: number) => (op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b);
const HIGH = (o: string) => o === '×' || o === '÷';

const bedmas: Helper = (q) => {
  const p = q.parts;
  if (p.length < 5 || p[p.length - 2] !== '=' || p[p.length - 1] !== '?') return null;
  const toks = p.slice(0, -2);
  const nums: number[] = [], ops: string[] = [];
  const lines: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (i % 2 === 1) { if (!['+', '−', '×', '÷'].includes(t)) return null; ops.push(t); continue; }
    const br = /^\((\d+) ([+−×÷]) (\d+)\)$/.exec(t);
    if (br) { const v = apply(Number(br[1]), br[2], Number(br[3])); nums.push(v); lines.push(`${t} = ${show(v)}`); }
    else { const v = num(t); if (v === null) return null; nums.push(v); }
  }
  if (nums.length < 2 || ops.length !== nums.length - 1) return null;
  if (nums.length < 3 && lines.length === 0) return null;
  const steps: { rule: string; text: string }[] = lines.map((l) => ({ rule: 'Brackets first.', text: l }));
  const N = [...nums], O = [...ops];
  const mixed = O.some(HIGH) && O.some((o) => !HIGH(o));
  let first = true;
  const mark = (text: string, ruleText: string) => { steps.push({ rule: first ? ruleText : '', text }); first = false; };
  if (mixed) {
    first = true;
    const done: string[] = [];
    for (let i = 0; i < O.length;) {
      if (HIGH(O[i])) { const v = apply(N[i], O[i], N[i + 1]); done.push(`${show(N[i])} ${O[i]} ${show(N[i + 1])} = ${show(v)}`); N.splice(i, 2, v); O.splice(i, 1); } else i++;
    }
    mark(done.join(' and '), '× and ÷ come before + and −.');
  }
  first = true;
  while (O.length > 1 || (O.length === 1 && false)) {
    const v = apply(N[0], O[0], N[1]);
    mark(`${show(N[0])} ${O[0]} ${show(N[1])} = ${show(v)}`, mixed ? 'Now left to right.' : 'Same level, so go left to right.');
    N.splice(0, 2, v); O.shift();
  }
  const out: string[] = steps.map((s) => `${s.rule} ${s.text}.`.trim());
  const rule = out.length === 0 ? (HIGH(O[0]) ? '' : '') : '';
  out.push(`${rule}${show(N[0])} ${O[0]} ${show(N[1])} = ?`.trim());
  if (out.length === 1) out.unshift('Work through the sum in the right order (BEDMAS).');
  while (out.length > 4) out.splice(0, 2, `${out[0]} ${out[1]}`);
  return card('bedmas', 'Brackets, then × ÷, then + −', ...out);
};

const signs: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 3 || p[1] !== '?' || !/sign/i.test(q.prompt ?? '')) return null;
  const side = (t: string) => {
    const m = /^(\d+) ([+−×÷]) (\d+)$/.exec(t);
    return m ? { text: t, value: apply(Number(m[1]), m[2], Number(m[3])), calc: true } : num(t) !== null ? { text: t, value: num(t)!, calc: false } : null;
  };
  const l = side(p[0]), r = side(p[2]);
  if (!l || !r) return null;
  const lines: string[] = [];
  if (l.calc) lines.push(`Left: ${l.text} = ${show(l.value)}.`);
  if (r.calc) lines.push(`Right: ${r.text} = ${show(r.value)}.`);
  const first = 'Work out each side on its own first, then compare them.';
  return card('signs', 'Work out both sides, then compare', first, ...lines, `Which sign fits the left side and the right side? ?`);
};

// ---------------------------------------------------------------- negative numbers

const intSums: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[3] !== '=') return null;
  const temp = p.some((t) => t.includes('°'));
  const clean = (t: string) => t.replace(/°/g, '').replace(/^\?$/, '?');
  const [A, op, B, , C] = [clean(p[0]), p[1], clean(p[2]), p[3], clean(p[4])];
  if (op !== '+' && op !== '−') return null;
  const a = num(A), b = num(B);
  if (C === '?' && a !== null && b !== null) {
    const u = temp ? '°' : '';
    const sh = (n: number) => `${show(n)}${u}`;
    const abs = (n: number) => show(Math.abs(n));
    if (op === '+' && a < 0 && b < 0) return card('negatives', 'Two negatives pile up', 'Two negatives together make a bigger negative, like owing $' + abs(a) + ' and then owing $' + abs(b) + ' more.', `Add the sizes: ${abs(a)} + ${abs(b)} = ?`, 'Put the minus sign back in front of that answer: ?');
    if (op === '+' && a >= 0 && b < 0) return card('negatives', 'Adding a negative is taking away', 'Adding a negative number is the same as taking away.', `${show(a)} + ${show(b)} is ${show(a)} − ${abs(b)}.`, `${show(a)} − ${abs(b)} = ?`);
    if (op === '+' && a < 0 && b >= 0) {
      if (b >= -a) return card('negatives', 'Up to zero, then on', `Picture a number line. Start at ${sh(a)}.`, `Going up ${abs(b)} steps: ${abs(a)} of them get you to 0.`, `How many steps are left to go past 0? ${abs(b)} − ${abs(a)} = ?`);
      return card('negatives', 'Up the number line', `Picture a number line. Start at ${sh(a)}, which is ${abs(a)} below 0.`, `Go up ${abs(b)} steps. You stay below 0.`, `${abs(a)} − ${abs(b)} = ? below 0. Write it with a minus sign: ?`);
    }
    if (op === '−' && b < 0 && a >= 0) return card('negatives', 'Taking away a negative adds', 'Taking away a negative number is the same as adding.', `${show(a)} − ${show(b)} becomes ${show(a)} + ${abs(b)}.`, `${show(a)} + ${abs(b)} = ?`);
    if (op === '−' && b < 0 && a < 0) return card('negatives', 'Taking away a negative adds', 'Taking away a negative number is the same as adding.', `${show(a)} − ${show(b)} becomes ${show(a)} + ${abs(b)}.`, `Start at ${show(a)} and go up ${abs(b)} steps: ?`);
    if (op === '−' && a >= 0 && b > a) return card('negatives', 'Down past zero', `Picture a number line. Start at ${sh(a)}.`, `Going down ${sh(b)}: ${show(a)} of the steps get you to 0.`, `${show(b)} − ${show(a)} = ? steps below 0. Write it with a minus sign: ?`);
    if (op === '−' && a >= 0 && b >= 0) return temp ? card('negatives', 'Go down', `Start at ${sh(a)}.`, `Go down ${sh(b)}. You stay at or above 0.`, `${show(a)} − ${show(b)} = ?`) : null;
    if (op === '−' && a < 0 && b >= 0) return card('negatives', 'Further below zero', `${sh(a)} is already below 0, and taking away goes down even more.`, `Add the sizes: ${abs(a)} + ${show(b)} = ?`, 'Put the minus sign back in front of that answer: ?');
    return null;
  }
  if (C === '0' && op === '+' && B === '?' && a !== null && a !== 0) {
    return card('negatives', 'Back to zero', `${show(a)} is ${Math.abs(a)} ${a < 0 ? 'below' : 'above'} 0.`, 'To get back to 0 you go the other way.', `Do you go ${a < 0 ? 'up' : 'down'} or ${a < 0 ? 'down' : 'up'}? Count the steps: ?`);
  }
  return null;
};

const negCompare: Helper = (q) => {
  const w = words(q);
  const small = /smallest|least|lowest/i.test(w), big = /biggest|largest|greatest|highest/i.test(w);
  if (small === big) return null;
  const labs = labelsOf(q);
  const vals = labs.map((l) => num(l));
  if (labs.length < 2 || vals.some((v) => v === null) || !vals.some((v) => v! < 0)) return null;
  const negs = labs.filter((_, i) => vals[i]! < 0);
  return card('negatives', small ? 'Furthest below zero is smallest' : 'Closest to zero is biggest',
    small ? 'Negative numbers are below 0, so any negative is smaller than any positive.' : 'Any positive number is bigger than any negative number, so look at the sizes.',
    `Look at the negatives: ${negs.join(', ')}.`,
    small ? 'The one with the biggest number after the minus is furthest below 0.' : 'The one with the smallest number after the minus is closest to 0.',
    `Which one is it? ?`);
};

// ---------------------------------------------------------------- powers

const pow10: Helper = (q) => {
  const p = q.parts, w = q.prompt ?? '';
  if (p.length === 3 && p[1] === '=' && p[2] === '?') {
    const pw = power(p[0]);
    if (pw && pw.base === 10 && pw.exp > 0 && !w) return card('powers', 'The small number counts the zeros', `${p[0]} means ten multiplied by itself ${pw.exp} times.`, `The small number is how many 0s follow the 1: ${pw.exp} zeros.`, 'Write 1 and then those zeros: ?');
    if (pw && pw.base === 10 && pw.exp < 0) {
      return card('powers', 'A negative power is a decimal', `${p[0]}: the minus means it gets smaller than 1, so it is a decimal.`, `The ${-pw.exp} means the 1 sits in the ${ordinal(-pw.exp)} place after the decimal point.`, `Write 0. then fill the places before the 1 with zeros: ?`);
    }
    if (pw && pw.base !== 10 && pw.exp >= 2 && pw.exp <= 6) {
      const b = pw.base;
      const run: string[] = [];
      for (let k = 2; k < pw.exp; k++) run.push(`${show(b ** (k - 1))} × ${b} = ${show(b ** k)}`);
      return card('powers', `${b} multiplied ${pw.exp} times`, `${p[0]} means ${Array(pw.exp).fill(b).join(' × ')}.`,
        ...(pw.exp === 2 ? [`${b} × ${b} = ?`] : [`Work from the left: ${run.join(', ')}.`, `${show(b ** (pw.exp - 1))} × ${b} = ?`]));
    }
    // "0.01 = ?" as a power of 10, "1 000 000 = ?" as a power of 10, "n = ?" with a prompt
    const dec = /^0\.0*1$/.test(p[0]);
    if (dec && /power of 10/.test(w)) return card('powers', 'Count the decimal places', `In ${p[0]} the 1 is in the ${ordinal(p[0].length - 2)} place after the decimal point.`, 'A decimal like that is 10 with a minus power.', `The power is − (that place number): 10 to the power ?`);
    if (/^[1 ]*0[0 ]*$/.test(p[0]) && /^1(\s?000)*|^10*$/.test(plain(p[0])) && /power of 10/.test(w)) {
      const z = plain(p[0]).length - 1;
      return card('powers', 'Count the zeros', `Count the zeros in ${p[0]}: there are ${z}.`, 'The small number in 10 to a power is the number of zeros.', 'Which choice has that small number? ?');
    }
    if (p[0] === 'n' && /10ⁿ/.test(w)) {
      const m = /^(\d[\d ]*) = 10ⁿ/.exec(w);
      if (m) return card('powers', 'Count the zeros', `Count the zeros in ${m[1]}.`, 'The number of zeros is the small number n.', 'How many zeros? ?');
    }
  }
  const t = /^(\d+) × (10[⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(p.slice(0, 3).join(' '));
  if (t && p[3] === '=' && p[4] === '?') {
    const pw = power(t[2])!;
    return card('powers', 'Ten to a power is 1 and zeros', `${t[2]} is 1 followed by ${pw.exp} zeros: ${show(10 ** pw.exp)}.`, `${t[1]} × ${show(10 ** pw.exp)} = ?`);
  }
  return null;
};

/** 3² − 2 = ?, 8² − 5 = ?, 5² × 7 = ?, 2³ × 3² = ? */
const powerSums: Helper = (q) => {
  const p = q.parts;
  if (p.length < 5 || p[p.length - 2] !== '=' || p[p.length - 1] !== '?') return null;
  const toks = p.slice(0, -2);
  if (toks.length % 2 === 0 || !toks.some((t) => power(t))) return null;
  const vals: number[] = [], lines: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    if (i % 2 === 1) { if (!['+', '−', '×'].includes(toks[i])) return null; continue; }
    const pw = power(toks[i]);
    if (pw) {
      if (pw.exp < 0 || pw.exp > 6) return null;
      const v = pw.base ** pw.exp;
      vals.push(v);
      lines.push(`${toks[i]} = ${Array(pw.exp).fill(pw.base).join(' × ')} = ${show(v)}`);
    } else { const v = num(toks[i]); if (v === null) return null; vals.push(v); }
  }
  if (vals.length !== 2) return null;
  const op = toks[1];
  return card('powers', 'Do the power first', `Work out the power${lines.length > 1 ? 's' : ''} first: ${lines.join('. ')}.`, `${show(vals[0])} ${op} ${show(vals[1])} = ?`);
};

const repeated: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 3 || p[1] !== '=' || p[2] !== '?' || !/^\d+( × \d+)+$/.test(p[0])) return null;
  const f = p[0].split(' × ');
  if (new Set(f).size !== 1) return null;
  return card('powers', 'Count the repeats', 'A power is a short way to write the same number multiplied again and again.', `Count how many ${f[0]}s are multiplied in ${p[0]}.`, `Which choice has ${f[0]} with that small raised number? ?`);
};

const primeFactors: Helper = (q) => {
  const p = q.parts, w = q.prompt ?? '';
  const m = /^(\d+) = (\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) × (\d+)ⁿ\./.exec(w);
  if (m && p[0] === 'n') {
    const N = Number(m[1]), base = Number(m[2]), e = power(m[2] + m[3])!.exp, other = Number(m[4]);
    const known = base ** e;
    return card('prime-factors', 'Take off the part you know', `${m[2]}${m[3]} = ${known}.`, `${N} ÷ ${known} = ${N / known}.`, `How many ${other}s multiply together to make ${N / known}? ?`);
  }
  const wh = /^Which is (\d+) as primes\?/.exec(w);
  if (wh) {
    const n = Number(wh[1]);
    let d = 2;
    while (n % d !== 0 && d < n) d++;
    return card('prime-factors', 'Split into primes', `Divide by the smallest prime that goes in, again and again: ${n} ÷ ${d} = ${n / d}.`, 'Keep dividing each answer until you are left with a prime.',
      'Count how many times each prime was used, and write repeats as a small raised number. Which choice matches? ?');
  }
  return null;
};

const primes: Helper = (q) => {
  const w = words(q);
  const isNot = /not prime/i.test(w);
  if (!(/prime/i.test(w)) || !q.choices?.length && !q.choiceLabels?.length) return null;
  if (/factor|pair/i.test(w)) return null;
  return card('primes', 'Look for a number that divides it', 'A prime has only two factors: 1 and itself.',
    'Test each number: is it even? Does it end in 5? Do its digits add to a multiple of 3? Is it in the 7 times table?',
    isNot ? 'The one that is NOT prime has one of those. Which is it? ?' : 'The prime one fails all of those tests. Which is it? ?');
};

const divisible: Helper = (q) => {
  const m = /divisible by (\d+)/i.exec(words(q));
  if (!m || (!q.choices?.length && !q.choiceLabels?.length)) return null;
  const d = Number(m[1]);
  const rule: Record<number, string> = {
    2: 'Even numbers end in 0, 2, 4, 6 or 8.', 3: 'Add up the digits. If that total is in the 3 times table, so is the number.',
    4: 'Look at the last two digits. If they are in the 4 times table, so is the number.', 5: 'It must end in 0 or 5.',
    6: 'It must be even AND its digits add up to a number in the 3 times table.', 8: 'Halve it three times. If you always get a whole number, it works.',
    9: 'Add up the digits. If that total is in the 9 times table, so is the number.', 10: 'It must end in 0.',
    11: 'Add the 1st, 3rd, … digits, then the 2nd, 4th, … digits. If the totals differ by 0 or 11, it works.',
  };
  return card('divisible', `Test for ${d}`, `Divisible by ${d} means it shares into ${d} groups with nothing left over.`,
    rule[d] ?? `Check each number against the ${d} times table.`, `Test each choice. Which one passes? ?`);
};

const hcfLcm: Helper = (q) => {
  const m = /^(HCF|LCM) of (\d+) and (\d+)$/.exec(q.parts[0] ?? '');
  if (!m || q.parts.length !== 3) return null;
  const x = Number(m[2]), y = Number(m[3]);
  if (m[1] === 'HCF') {
    const small = Math.min(x, y), big = Math.max(x, y);
    const fs: number[] = [];
    for (let i = 1; i <= small; i++) if (small % i === 0) fs.push(i);
    return card('hcf', 'List the factors', `Factors of ${small}: ${fs.join(', ')}.`, `Which of those also go into ${big}? Check from the biggest down.`, 'The biggest one that goes into both: ?');
  }
  const bigger = Math.max(x, y), smaller = Math.min(x, y);
  const k = (bigger * smaller) / gcd(x, y) / bigger;
  if (k === 1) return card('lcm', 'List the multiples', `Count in ${bigger}s.`, `Does ${smaller} go into ${bigger}?`, 'The smallest number in both times tables: ?');
  const shown = Array.from({ length: Math.min(3, k - 1) }, (_, i) => bigger * (i + 1));
  return card('lcm', 'List the multiples', `Count in ${bigger}s: ${shown.join(', ')}, …`, `Stop at the first number that is also in the ${smaller} times table.`, 'The smallest number in both times tables: ?');
};
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// ---------------------------------------------------------------- estimating

const estimate: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[1] !== '×' || p[3] !== '≈' || !/estimate|round first/i.test(q.prompt ?? '')) return null;
  const a = num(p[0]), b = num(p[2]);
  if (a === null || b === null) return null;
  const dec = !Number.isInteger(a) ? a : b;
  const other = dec === a ? b : a;
  const r = dec >= 10 ? Math.round(dec / 10) * 10 : Math.round(dec);
  return card('estimate', 'Round to something easy', `Round the tricky number first: ${show(dec)} is close to ${show(r)}.`, `Now do the easy multiplication with the rounded number.`, `${show(r)} × ${show(other)} = ?`);
};

// ----------------------------------------------------------------

export const NUMBER_HELPERS: Helper[] = [
  bonds, rounding, timesTens, splitTimes, placeValue, biggest, negCompare, countBig, mentalBig, missingBig, factors, remainders, squares, stepOf,
  intSums, bedmas, signs, powerSums, pow10, repeated, primeFactors, primes, divisible, hcfLcm, estimate,
];
