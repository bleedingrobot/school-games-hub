/**
 * Help me for fractions, decimals, percentages, money and ratio (docs/plans/help-me/PLAN.md). Tricks: share into the
 * bottom number of equal parts, same bottoms then tops, work back to one part, 10% then build, digits move places,
 * count up to the next whole, same number on the top and the bottom. Every card leaves the last bit for the pupil.
 */
import { fractionSteps } from '../hint';
import { num, show, sum, words } from './read';
import type { HelpCard, HelpQuestion, Helper } from './types';

const card = (kind: string, title: string, ...steps: string[]): HelpCard => ({ kind, title, steps });

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const NAMES: Record<number, string> = {
  2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths', 9: 'ninths',
  10: 'tenths', 12: 'twelfths', 100: 'hundredths', 1000: 'thousandths',
};
const nameOf = (b: number) => NAMES[b] ?? `parts of ${b}`;
const PLACES: Record<number, string> = { 1: 'tenths', 2: 'hundredths', 3: 'thousandths' };

function frac(t: string | undefined): [number, number] | null {
  const m = /^(\d+)\/(\d+)$/.exec(t ?? '');
  return m && Number(m[2]) > 0 ? [Number(m[1]), Number(m[2])] : null;
}
const pct = (t: string | undefined): number | null => {
  const m = /^(\d+(?:\.\d+)?)%$/.exec(t ?? '');
  return m ? Number(m[1]) : null;
};
/** A plain decimal as shown ("0.75", "4.6"): its value and number of places. */
function dec(t: string | undefined): { v: number; dp: number } | null {
  const m = /^(\d+)\.(\d+)$/.exec(t ?? '');
  return m ? { v: Number(t), dp: m[2].length } : null;
}
const dpOf = (x: number) => (Number.isInteger(Math.round(x * 1e6) / 1e6) ? 0 : Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : Math.abs(x * 100 - Math.round(x * 100)) < 1e-9 ? 2 : 3);
const choicesOf = (q: HelpQuestion): string[] | null => (q.choiceLabels ? [...q.choiceLabels] : q.choices ? q.choices.map(String) : null);
const money = (cents: number) => '$' + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
const one = (n: number, name: string) => (n === 1 ? (name === 'halves' ? 'half' : name.replace(/s$/, '')) : name);
const isEven = (n: number) => Number.isInteger(n) && n % 2 === 0;

// ---------------------------------------------------------------- a fraction of an amount, and back to the whole

function whole(n: number, b: number, v: number, intro?: string): HelpCard {
  const steps: string[] = intro ? [intro] : [];
  if (n === 1) {
    steps.push(`${show(v)} is 1 of the ${b} equal parts. The whole is all ${b} parts.`, `${b} × ${show(v)} = ?`);
  } else {
    const u = v / n;
    steps.push(`${show(v)} is ${n} of the ${b} equal parts.`, Number.isInteger(u) ? `So 1 part is ${show(v)} ÷ ${n} = ${show(u)}.` : `Find 1 part: ${show(v)} ÷ ${n}.`, Number.isInteger(u) ? `The whole is ${b} parts: ${b} × ${show(u)} = ?` : `The whole is ${b} parts: ${b} × (1 part) = ?`);
  }
  return card('whole-from-fraction', 'Work back to one part', ...steps);
}

function ofCard(n: number, b: number, N: number): HelpCard {
  // The last step always comes back to the top number: how many of the equal groups the answer is (James, 26 Nov 2026).
  const u = N / b;
  const one = Number.isInteger(u) ? show(u) : null;
  if (n === 1) {
    const top = 'The top number is 1, so the answer is just 1 group: 1 group = ?';
    if (b === 2) return card('fraction-of', 'Half is sharing in 2', 'A half is 1 of 2 equal groups.', `Share ${show(N)} into 2 equal groups: ${show(N)} ÷ 2 is one group.`, top);
    if (b === 4 && isEven(N)) return card('fraction-of', 'A quarter is half of a half', 'A quarter is 1 of 4 equal groups: half of a half.', `Half of ${show(N)} is ${show(N / 2)}. Half again is one group.`, top);
    if (b === 10) return card('fraction-of', 'A tenth is divide by 10', 'A tenth is 1 of 10 equal groups.', `÷ 10 moves each digit one place right: ${show(N)} ÷ 10 is one group.`, top);
    return card('fraction-of', `1/${b} is share into ${b}`, `1/${b} means share ${show(N)} into ${b} equal groups.`,
      N % b === 0 ? `Think of the ${b} times table: ${b} × (one group) = ${show(N)}.` : `${show(N)} ÷ ${b} is one group.`, top);
  }
  return card('fraction-of', 'Find one group, then take the top many',
    `The bottom number is ${b}: share ${show(N)} into ${b} equal groups. ${show(N)} ÷ ${b}${one ? ` = ${one}` : ''} in each group.`,
    `The top number is ${n}: the answer is ${n} of those groups.`,
    one ? `${n} × ${one} = ?` : `${n} × (one group) = ?`);
}

const fractionOf: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[1] !== 'of' || p[3] !== '=') return null;
  const f = frac(p[0]);
  if (f && p[4] === '?' && num(p[2]) !== null) return ofCard(f[0], f[1], num(p[2])!);
  if (f && p[2] === '?' && num(p[4]) !== null) return whole(f[0], f[1], num(p[4])!);
  return null;
};

// ---------------------------------------------------------------- percentages of an amount

/** How to find P% of N: a sentence with the method, and the last calculation for the pupil. */
function pctParts(P: number, N: number): { how: string; calc: string } {
  const n = show(N);
  if (P === 50) return { how: '50% is a half.', calc: `${n} ÷ 2` };
  if (P === 25) return isEven(N) ? { how: `25% is a quarter: half of a half. Half of ${n} is ${show(N / 2)}.`, calc: `half of ${show(N / 2)}` } : { how: '25% is a quarter: half of a half.', calc: `${n} ÷ 4` };
  if (P === 75) return { how: `25% of ${n} is ${n} ÷ 4${N % 4 === 0 ? ` = ${show(N / 4)}` : ''}. 75% is 3 lots of 25%.`, calc: N % 4 === 0 ? `3 × ${show(N / 4)}` : `3 × (${n} ÷ 4)` };
  if (P === 10) return { how: '10% is a tenth: ÷ 10 moves each digit one place right.', calc: `${n} ÷ 10` };
  if (P === 1) return { how: '1% is a hundredth: ÷ 100 moves each digit two places right.', calc: `${n} ÷ 100` };
  if (P === 5) return { how: `10% of ${n} is ${show(N / 10)}. 5% is half of that.`, calc: `half of ${show(N / 10)}` };
  if (P % 10 === 0) return { how: `10% of ${n} is ${n} ÷ 10 = ${show(N / 10)}. ${P}% is ${P / 10} lots of 10%.`, calc: `${P / 10} × ${show(N / 10)}` };
  const g = gcd(P, 100), a = P / g, b = 100 / g;
  return { how: `${P}% is ${a}/${b}: ${n} ÷ ${b}${N % b === 0 ? ` = ${show(N / b)}` : ''}${a > 1 ? `, then ${a} lots` : ''}.`, calc: a === 1 ? `${n} ÷ ${b}` : N % b === 0 ? `${a} × ${show(N / b)}` : `${a} × (${n} ÷ ${b})` };
}

const percentOf: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[1] !== 'of' || p[3] !== '=') return null;
  const P = pct(p[0]);
  if (P === null) return null;
  if (p[4] === '?' && num(p[2]) !== null) {
    const { how, calc } = pctParts(P, num(p[2])!);
    return card('percent-of', P === 10 ? '10% is divide by 10' : P === 50 ? '50% is half' : P === 25 ? '25% is a quarter' : 'Find 10% (or a quarter), then build', how, `${calc[0].toUpperCase()}${calc.slice(1)} = ?`);
  }
  if (p[2] === '?' && num(p[4]) !== null && P > 0) {
    const g = gcd(P, 100);
    return whole(P / g, 100 / g, num(p[4])!, `${P}% is the same as ${P / g}/${100 / g}.`);
  }
  return null;
};

// ---------------------------------------------------------------- fractions, decimals and percentages changed into each other

/** A decimal with 1 to 3 places as a fraction over 10, 100 or 1000. */
function decToFrac(t: string, choices: string[] | null): HelpCard | null {
  const d = dec(t);
  if (!d || d.dp > 3) return null;
  const bottom = 10 ** d.dp, top = Math.round(d.v * bottom);
  const g = gcd(top, bottom);
  const raw = `${top}/${bottom}`;
  const simplify = g > 1 && !(choices ?? []).includes(raw);
  const steps = [
    `${d.dp === 1 ? 'One place' : d.dp === 2 ? 'Two places' : 'Three places'} after the point means ${PLACES[d.dp]}: the bottom is ${bottom}.`,
    `${t} is ${top} ${PLACES[d.dp]}.`,
  ];
  if (simplify) steps.push(`Make it simpler: divide the top and the bottom by ${g}: ${top} ÷ ${g} = ? and ${bottom} ÷ ${g} = ?`);
  else steps.push(`Write ${top} ${PLACES[d.dp]} as a fraction: ?`);
  return card('dec-to-fraction', 'Say the decimal in tenths or hundredths', ...steps);
}

/** A fraction with 10, 100 or 1000 on the bottom as a decimal. */
function tenthFracToDec(a: number, b: number): HelpCard | null {
  const dp = b === 10 ? 1 : b === 100 ? 2 : b === 1000 ? 3 : 0;
  if (!dp) return null;
  return card('frac-to-decimal', 'Put the top in the right places', `The bottom ${b} means ${PLACES[dp]}: ${dp} place${dp > 1 ? 's' : ''} after the point.`,
    `The top ${a} fills ${dp === 1 ? 'that place' : `those ${dp} places`}${a < b / 10 ? ' (use a 0 in front where the top is short)' : ''}.`, 'Write it with the decimal point: ?');
}

function simpleFracToDec(a: number, b: number): HelpCard | null {
  const to = 10 % b === 0 ? 10 : 100 % b === 0 ? 100 : 0;
  if (!to || b === to) return null;
  const k = to / b;
  return card('frac-to-decimal', `Make the bottom ${to}`, `Make the bottom ${to}: ${b} × ${k} = ${to}.`, `Do the same to the top: ${a} × ${k} = ? ${PLACES[to === 10 ? 1 : 2]}.`, `Write that many ${PLACES[to === 10 ? 1 : 2]} as a decimal: ?`);
}

function pctToFrac(P: number): HelpCard {
  const g = gcd(P, 100);
  if (g === 1) return card('pct-to-fraction', 'Percent means out of 100', '% means "out of 100".', `So ${P}% is ${P} out of 100. Write that as a fraction: ?`);
  return card('pct-to-fraction', 'Percent means out of 100', '% means "out of 100", so a percent is a fraction with 100 on the bottom.', `${P}% is ${P}/100. The biggest number that goes into both ${P} and 100 is ${g}.`, `Divide the top and the bottom by ${g}: ${P} ÷ ${g} = ? and 100 ÷ ${g} = ?`);
}

const fractionToPct = (a: number, b: number): HelpCard | null =>
  100 % b === 0 ? card('fraction-to-pct', 'Make the bottom 100', '% means "out of 100", so make the bottom 100.', `${b} × ${100 / b} = 100.`, `Do the same to the top: ${a} × ${100 / b} = ?`) : null;

const decToPct = (t: string, pick: boolean): HelpCard =>
  card('dec-to-pct', 'Times 100 for percent', 'Percent means out of 100, so 1 whole is 100%.', pick ? '× 100 moves each digit two places left. Then pick the choice with that percent.' : '× 100 moves each digit two places left.', `${t} × 100 = ?`);

const pctToDec = (P: number): HelpCard =>
  card('pct-to-decimal', 'Percent is hundredths', `% means out of 100, so ${show(P)}% is ${show(P)}/100.`, '÷ 100 moves each digit two places right (hundredths are the second place after the point).', `${show(P)} ÷ 100 = ?`);

function mixedImproper(a: number, b: number, tap: boolean): HelpCard {
  return card('mixed-number', 'Each whole is a full set of parts', `Each whole is made of ${b}/${b}.`,
    tap ? `How many wholes fit in ${a}/${b}? That is the whole number.` : `Take out whole lots of ${b} from the top ${a}: the leftover is the fraction part.`,
    tap ? `What is left over goes on top of ${b}: ${a} − (wholes × ${b}) = ?` : `How many times does ${b} go into ${a}? ?`);
}

const conversions: Helper = (q) => {
  const p = q.parts;
  const ch = choicesOf(q);
  const prompt = words(q);
  if (p.length === 4 && p[1] === '=' && p[2] === '?' && p[3] === '%') {
    const f = frac(p[0]);
    if (f) return fractionToPct(f[0], f[1]);
    if (dec(p[0])) return decToPct(p[0], false);
    return null;
  }
  if (p.length === 3 && p[1] === '=' && p[2] === '?') {
    const P = pct(p[0]);
    if (P !== null) return /decimal/i.test(prompt) ? pctToDec(P) : pctToFrac(P);
    const d = dec(p[0]);
    if (d) {
      if (ch && ch.some((c) => c.includes('%'))) return decToPct(p[0], true);
      return decToFrac(p[0], ch);
    }
    const f = frac(p[0]);
    if (f) {
      const mixed = ch && ch.some((c) => c.includes(' '));
      if (mixed || (ch === null && f[0] > f[1] && /mixed/i.test(prompt))) return mixedImproper(f[0], f[1], true);
      if (ch && ch.some((c) => c.includes('/')) && !/decimal/i.test(prompt)) {
        return card('equivalent-fractions', 'Do the same to the top and the bottom',
          'Equal fractions come from times-ing (or dividing) the top and the bottom by the same number.',
          `Check each choice: how many times bigger is its bottom than ${f[1]}? And its top than ${f[0]}?`, 'Which choice has both times-ed by the same number? ?');
      }
      return tenthFracToDec(f[0], f[1]) ?? simpleFracToDec(f[0], f[1]);
    }
    return null;
  }
  return null;
};

/** The "?" fill-ins: 1 = ?/5, 0.8 = ?/10, 2.6 = ?/10, 0.22 = ?/1000, 4 1/4 = ?/4, 21/8 = ? 5/8. */
const fillIns: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 3 || p[1] !== '=') return null;
  const [L, , R] = p;
  let m = /^\?\/(\d+)$/.exec(R);
  if (m) {
    const b = Number(m[1]);
    if (L === '1') return card('fraction-bonds', 'One whole is the bottom over the bottom', `Cut one whole into ${b} equal parts.`, `How many ${nameOf(b)} make the whole? ?`);
    const mix = /^(\d+) (\d+)\/(\d+)$/.exec(L);
    if (mix && Number(mix[3]) === b) {
      const w = Number(mix[1]), n = Number(mix[2]);
      return card('mixed-number', 'Each whole is a full set of parts', `Each whole is made of ${b} ${nameOf(b)}.`, `${w} whole${w > 1 ? "s" : ""}: ${w} × ${b} = ${w * b} ${nameOf(b)}.`, `Add the ${n} ${one(n, nameOf(b))}: ${w * b} + ${n} = ?`);
    }
    const d = dec(L);
    if (d && (b === 10 || b === 100 || b === 1000)) {
      const places = Math.log10(b);
      if (b === 10 && d.v >= 1) {
        const w = Math.floor(d.v), t = Math.round((d.v - w) * 10);
        return card('tenths', 'Count the tenths', '1 whole is 10 tenths.', `${L} is ${w} whole${w > 1 ? 's' : ''} and ${t} tenth${t === 1 ? '' : 's'}: ${w} × 10 = ${w * 10} tenths.`, `Add the ${t} tenth${t === 1 ? '' : 's'}: ${w * 10} + ${t} = ?`);
      }
      if (b === 10) return card('tenths', 'Count the tenths', 'The digit after the point counts the tenths.', `How many tenths is ${L}? ?`);
      return card('thousandths', 'Fill the places with zeros', `${places === 3 ? 'Thousandths' : 'Hundredths'} need ${places} places after the point.`,
        `Put zeros on the end of ${L} to fill ${places} places.`, `Now read the digits after the point as a whole number: ?`);
    }
    return null;
  }
  m = /^\? (\d+)\/(\d+)$/.exec(R);
  const f = frac(L);
  if (m && f && Number(m[2]) === f[1]) return mixedImproper(f[0], f[1], false);
  return null;
};

// ---------------------------------------------------------------- times and divide by 10, 100, 1000, and decimal order

const shift: Helper = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '×' && s.op !== '÷')) return null;
  const isPow = (n: number | null) => n === 10 || n === 100 || n === 1000;
  const placesOf = (n: number) => Math.log10(n);
  const pl = (k: number) => `${k} place${k > 1 ? 's' : ''}`;
  if (s.c === null && s.a !== null && isPow(s.b)) {
    const k = placesOf(s.b!), x = show(s.a);
    if (s.op === '×') {
      if (!q.parts[0].includes('.')) return null;
      return card('times-decimals', `Times ${s.b}: digits move ${pl(k)} left`, `× ${s.b} makes every digit ${s.b} times bigger: each digit moves ${pl(k)} to the left.`, `Slide each digit of ${x} ${pl(k)} to the left (the point seems to move right), filling gaps with zeros.`, 'Read the new number: ?');
    }
    return card('divide-decimals', `Divide by ${s.b}: digits move ${pl(k)} right`, `÷ ${s.b} makes every digit ${s.b} times smaller: each digit moves ${pl(k)} to the right.`, `Slide each digit of ${x} ${pl(k)} to the right (the point seems to move left), filling gaps with zeros.`, 'Read the new number: ?');
  }
  if (s.a === null && s.b !== null && isPow(s.b) && s.c !== null) {
    return card('times-decimals', 'Do the opposite', `The opposite of ${s.op} ${s.b} is ${s.op === '×' ? '÷' : '×'} ${s.b}.`, `${show(s.c)} ${s.op === '×' ? '÷' : '×'} ${s.b} = ?`);
  }
  if (s.b === null && s.a !== null && s.c !== null && s.op === '×' && (q.parts[0].includes('.') || q.parts[4].includes('.'))) {
    return card('times-decimals', 'Count how far the digits moved', `Look at how the digits of ${show(s.a)} moved to make ${show(s.c)}.`, '1 place left is × 10, 2 places is × 100, 3 places is × 1000.', 'How many places did they move? ?');
  }
  return null;
};

const decimalOrder: Helper = (q) => {
  const ch = choicesOf(q);
  const t = words(q);
  const m = /(bigg?est|bigger|larg(?:est|er)|smallest|smaller|least)/i.exec(t);
  if (!ch || !m || ch.length < 2 || !ch.every((c) => num(c) !== null) || !ch.some((c) => c.includes('.'))) return null;
  // Below zero the digits don't compare like whole numbers; the number file's helper does those.
  if (ch.some((c) => (num(c) ?? 0) < 0)) return null;
  const maxDp = Math.max(...ch.map((c) => (c.split('.')[1] ?? '').length));
  const padded = ch.map((c) => { const [i, f = ''] = c.split('.'); return `${i}.${f.padEnd(maxDp, '0')}`; });
  const digits = padded.map((c) => String(Number(c.replace('.', ''))));
  const word = m[1].toLowerCase();
  return card('decimal-order', 'Make them the same length', `Give every number the same number of places by adding zeros on the end: ${padded.join(', ')}.`,
    `Now they compare like whole numbers: ${digits.join(', ')}.`, `Which is ${/^(bigger|larger|smaller)$/.test(word) ? '' : 'the '}${word}? ?`);
};

// ---------------------------------------------------------------- adding and taking away decimals

/** How far from a decimal up to a whole number. */
function gapCard(from: number, to: number): HelpCard | null {
  const dp = dpOf(from);
  if (dp < 1 || dp > 2 || !Number.isInteger(to)) return null;
  const ceil = Math.ceil(from), j2 = to - ceil;
  const frac100 = Math.round((from - Math.floor(from)) * 100);
  const unit = dp === 1 ? 10 : 100, fr = dp === 1 ? frac100 / 10 : frac100, name = dp === 1 ? 'tenths' : 'hundredths';
  const first = `${fr} + ? = ${unit} ${name}`;
  const trick = dp === 2 && frac100 % 10 !== 0 ? ' (Pairs to 100: the tens make 9, the ones make 10.)' : '';
  if (j2 > 0) {
    return card('count-up', `Count up to the next whole number`, `Count up from ${show(from)} to ${show(to)} in two jumps.`,
      `First jump to ${ceil}: ${first}.${trick}`, `Then ${ceil} → ${to} is ${j2}. Add the two jumps: ? + ${j2} = ?`);
  }
  return card('count-up', 'Count up to the next whole number', `Count up from ${show(from)} to ${show(to)}.`, `${first}.${trick} Write that many ${name} as a decimal: ?`);
}

const decimalAddSub: Helper = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '+' && s.op !== '−')) return null;
  const vals = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (!q.parts.some((t) => t.includes('.')) || q.parts.some((t) => /[$%/]/.test(t))) return null;
  if (vals.some((n) => dpOf(n) > 2 || n < 0)) return null;
  // A missing number: count up from the smaller to the bigger.
  if (s.c === null || s.a === null || s.b === null) {
    if (s.op === '+' && s.c !== null) return gapCard(s.a ?? s.b!, s.c);
    if (s.op === '−' && s.c === null && s.a !== null && s.b !== null) {
      const { a, b } = s;
      if (Number.isInteger(a) && dpOf(b) > 0) {
        if (b < 1 && a > 1) return card('take-from-whole', 'Break off one whole', `Break one whole off ${a}: ${a} is ${a - 1} and 1.`, `1 − ${show(b)} = ? (what makes 1 with ${show(b)}?)`, `Put the ${a - 1} back with it: ${a - 1} + ? = ?`);
        return gapCard(b, a);
      }
    }
  }
  if (s.c !== null || s.a === null || s.b === null) return null;
  const { a, b } = s;
  const dp = Math.max(dpOf(a), dpOf(b));
  const A = Math.round(a * 10 ** dp), B = Math.round(b * 10 ** dp);
  if (dp === 1) {
    const ao = Math.floor(A / 10), at = A % 10, bo = Math.floor(B / 10), bt = B % 10;
    if (s.op === '+') {
      if (at + bt > 10 && at > 0) {
        const toNext = (10 - at) / 10, rest = b - toNext;
        return card('make-whole', 'Make the whole number first', `Split ${show(b)} into ${show(toNext)} and ${show(rest)}.`, `${show(a)} + ${show(toNext)} makes the next whole number: ${ao + 1}.`, `${ao + 1} + ${show(rest)} = ?`);
      }
      if (at + bt === 10 && at > 0) {
        return card('make-whole', 'Tenths that make a whole', `${at} tenths + ${bt} tenths = 10 tenths, which is 1 whole.`, `So add 1 to the ones: ${ao} + ${bo} + 1 = ?`);
      }
      if (Number.isInteger(a) || Number.isInteger(b)) return card('decimal-add', 'Ones before the point, tenths after', 'The whole number goes before the point and the tenths go after it.', `Put ${Number.isInteger(a) ? show(a) : show(b)} and ${Number.isInteger(a) ? show(b) : show(a)} together without adding anything: ?`);
      return card('decimal-add', 'Add the ones, then the tenths', `Add the ones: ${ao} + ${bo} = ${ao + bo}.`, `Add the tenths: ${at} + ${bt} = ? tenths.`, 'Put the ones and the tenths together: ?');
    }
    if (at >= bt) {
      if (Number.isInteger(b)) return card('decimal-take', 'Only the ones change', `${show(b)} is a whole number, so only the ones change.`, `${ao} − ${bo} = ? ones, and the ${at} tenths stay.`, 'Put them together: ?');
      return card('decimal-take', 'Take away the ones, then the tenths', `Take away the ones: ${ao} − ${bo} = ${ao - bo}.`, `Take away the tenths: ${at} − ${bt} = ? tenths.`, 'Put the ones and the tenths together: ?');
    }
    if (Number.isInteger(a)) return null;
    const ceilB = Math.ceil(b), j2 = a - ceilB;
    return card('count-up', 'Count up from the smaller number', `Count up from ${show(b)} to ${show(a)} in two jumps.`, `First jump to ${ceilB}: ${bt} tenths + ? tenths = 10 tenths.`, `Then ${ceilB} → ${show(a)} is ${show(j2)}. Add the two jumps: ?`);
  }
  // Hundredths: the tenths part of the second number first, then its hundredths.
  const word = s.op === '+' ? 'Add' : 'Take away';
  const bigPart = Math.floor(B / 10) / 10, small = (B % 10) / 100;
  if (small === 0) {
    const aT = Math.floor(A / 10), aH = A % 10, bT = Math.round(b * 10);
    return card('decimal-hundredths', 'Only the tenths change', `${show(b)} is ${bT} tenth${bT === 1 ? '' : 's'}, so the hundredths digit (${aH}) of ${show(a)} stays the same.`,
      `${show(a)} has ${aT} tenth${aT === 1 ? '' : 's'}: ${aT} ${s.op} ${bT} = ? tenths.`, `Put the ${aH} hundredths back on the end: ?`);
  }
  const first = s.op === '+' ? a + bigPart : a - bigPart;
  return card('decimal-hundredths', 'Tenths first, then hundredths', `Split ${show(b)} into ${show(bigPart)} and ${show(small)}.`, `${word} the tenths first: ${show(a)} ${s.op} ${show(bigPart)} = ${show(first)}.`, `Then ${show(first)} ${s.op} ${show(small)} = ?`);
};

/** Decimal times a whole number, or divided by one: do the digits as tenths or hundredths. */
const decimalMulDiv: Helper = (q) => {
  const s = sum(q);
  if (!s || s.c !== null || s.a === null || s.b === null || (s.op !== '×' && s.op !== '÷')) return null;
  let { a, b } = s;
  if (s.op === '×' && Number.isInteger(a) && !Number.isInteger(b)) [a, b] = [b, a];
  if (!q.parts.some((t) => t.includes('.')) || dpOf(a) < 1 || dpOf(a) > 2 || !Number.isInteger(b) || b < 2 || b > 100) return null;
  if (b === 10 || b === 100 || b === 1000) return null;
  const dp = dpOf(a), D = Math.round(a * 10 ** dp), unit = PLACES[dp];
  if (s.op === '×') {
    if (dp === 1 && a < 1 && b % 10 === 0 && b <= 90) return card('decimal-times', 'Tenths and tens cancel', `${show(a)} is ${D} tenths and ${b} is ${b / 10} tens.`, 'Tenths and tens cancel each other out (÷ 10 and × 10).', `So just do ${D} × ${b / 10} = ?`);
    return card('decimal-times', `Do it in ${unit}`, `${show(a)} is ${D} ${unit}.`, `Multiply the whole numbers: ${D} × ${b} = ? ${unit}.`, `Write that many ${unit} as a decimal: ?`);
  }
  return card('decimal-divide', `Do it in ${unit}`, `${show(a)} is ${D} ${unit}.`, `Share them: ${D} ÷ ${b} = ? ${unit}.`, `Write that many ${unit} as a decimal: ?`);
};

const decimalDoubleHalf: Helper = (q) => {
  const p = q.parts;
  let x: number | null = null, double = false;
  if (p.length === 4 && /^double$/i.test(p[0]) && p[2] === '=' && p[3] === '?') { x = num(p[1]); double = true; }
  else if (p.length === 5 && /^half$/i.test(p[0]) && p[1] === 'of' && p[3] === '=' && p[4] === '?') x = num(p[2]);
  else if (p.length === 4 && /^half of$/i.test(p[0]) && p[2] === '=' && p[3] === '?') x = num(p[1]);
  if (x === null || Number.isInteger(x) || dpOf(x) > 2) return null;
  const w = Math.floor(x), f = Math.round((x - w) * 100) / 100;
  if (double) {
    if (w === 0) return card('decimal-double', 'Double the tenths', `${show(f)} is ${Math.round(f * 10)} tenths.`, `Double it: ${Math.round(f * 10)} + ${Math.round(f * 10)} = ? tenths.`, 'Write that many tenths as a decimal: ?');
    return card('decimal-double', 'Double each part', `Split ${show(x)} into ${w} and ${show(f)}.`, `Double ${w} is ${w * 2} and double ${show(f)} is ${show(f * 2)}.`, `${w * 2} + ${show(f * 2)} = ?`);
  }
  if (w === 0) return card('decimal-half', 'Half the tenths', `${show(f)} is ${Math.round(f * 10)} tenths.`, `Share them in 2: ${Math.round(f * 10)} ÷ 2 = ? tenths.`, 'Write that many tenths as a decimal: ?');
  return card('decimal-half', 'Halve each part', `Split ${show(x)} into ${w} and ${show(f)}.`, `Half of ${w} is ${show(w / 2)} and half of ${show(f)} is ${show(f / 2)}.`, `${show(w / 2)} + ${show(f / 2)} = ?`);
};

// ---------------------------------------------------------------- money

const moneyCard: Helper = (q) => {
  const p = q.parts;
  if (!(p.length === 6 && p[3] === '=' && p[4] === '$' && p[5] === '?') && !(p.length === 4 && p[1] === '≈' && p[2] === '$' && p[3] === '?')) return null;
  if (p.length === 6 && (p[1] === '+' || p[1] === '−')) {
    const g = num(p[0]), c = num(p[2]);
    if (g === null || c === null) return null;
    const G = Math.round(g * 100), C = Math.round(c * 100);
    if (p[1] === '+') {
      const dG = Math.floor(G / 100), dC = Math.floor(C / 100), cG = G % 100, cC = C % 100;
      return card('money-add', 'Dollars, then cents', `Add the dollars first: $${dG} + $${dC} = $${dG + dC}.`,
        `Add the cents: ${cG}c + ${cC}c = ?c.${cG + cC >= 100 ? ' If that makes 100c or more, swap 100c for one more dollar.' : ''}`, 'Put the dollars and cents together: ?');
    }
    if (C % 100 === 0) return card('money-change', 'Count up from the price', `Count up from ${money(C)} to ${money(G)}.`, `${money(G)} − ${money(C)} = ?`);
    const next = Math.ceil(C / 100) * 100, j2 = G - next;
    if (j2 > 0) return card('money-change', 'Count up from the price', 'Change is how far you count up from the price to the money you gave.', `${money(C)} up to the next dollar, ${money(next)}: ${C % 100}c + ?c = 100c.`, `Then ${money(next)} up to ${money(G)} is ${money(j2)}. Add the two jumps: ?`);
    return card('money-change', 'Count up from the price', `Count up from ${money(C)} to ${money(G)}.`, `${C % 100}c + ?c = 100c. Write that change: ?`);
  }
  const x = num(p[0]);
  if (x === null) return null;
  const cents = Math.round(x * 100);
  const prompt = words(q);
  if (/nearest dollar/i.test(prompt)) return card('money-round', 'Look at the cents', `Look at the cents: ${cents % 100}c.`, '50c or more rounds up to the next dollar. Less than 50c stays at the dollars you have.', `Which whole dollar is ${p[0]} closest to? ?`);
  const m = /nearest (\d+)c/i.exec(prompt);
  if (m && Number(m[1]) === 10) return card('money-round', 'Look at the last digit', `Look at the last digit of the cents: ${cents % 10}.`, '1 to 4 rounds down to the 10c below. 5 to 9 rounds up to the next 10c. 0 stays.', `Which 10c is ${p[0]} closest to? ?`);
  if (m) {
    const k = Number(m[1]), lo = Math.floor(cents / k) * k;
    return card('money-round', 'Find the two nearest amounts', `The ${k}c amounts either side of ${p[0]} are ${money(lo)} and ${money(lo + k)}.`, `Which one is ${p[0]} closer to? ?`);
  }
  return null;
};

// ---------------------------------------------------------------- fraction sums

const fractionSum: Helper = (q) => {
  const p = q.parts;
  const simplest = /simplest/i.test(words(q));
  // Whole bonds: 1 = ?/5, 2/4 + ?/4 = 1, ? + 4/5 = 1, 1 − 4/5 = ?
  if (p.length === 5 && p[3] === '=' && (p[1] === '+' || p[1] === '−')) {
    const slots = [p[0], p[2], p[4]];
    const known = slots.map((t) => frac(t));
    const bottom = known.find((f) => f)?.[1] ?? slots.map((t) => /^\?\/(\d+)$/.exec(t)).find((m) => m)?.[1];
    const b = Number(bottom);
    const has1 = p[4] === '1' || p[0] === '1';
    if (bottom && has1 && slots.every((t, i) => t === '?' || t === '1' || /^\?\/\d+$/.test(t) || (known[i] && known[i]![1] === b))) {
      if (p[1] === '+' && p[4] === '1') {
        const k = known[0]?.[0] ?? known[1]?.[0];
        if (k === undefined) return null;
        return card('fraction-bonds', 'One whole is the bottom over the bottom', `1 whole is ${b}/${b}: all ${b} ${nameOf(b)}.`, `The bottoms are the same, so only the tops change.`, `${k} + ? = ${b}`);
      }
      if (p[1] === '−' && p[0] === '1' && known[1]) {
        const k = known[1][0];
        return card('fraction-bonds', 'Write 1 as the bottom over the bottom', `Write 1 as ${b}/${b}: all ${b} ${nameOf(b)}.`, 'The bottoms are the same, so the bottom stays and only the tops change.', `${b} − ${k} = ? ${nameOf(b)}`);
      }
    }
  }
  if (p.length === 5 && p[3] === '=' && p[4] === '?' && (p[1] === '+' || p[1] === '−')) {
    const f1 = frac(p[0]), f2 = frac(p[2]);
    if (f1 && f2 && f1[1] === f2[1]) {
      const add = p[1] === '+';
      return card('fraction-add-same', 'Same bottom: only the tops change', `Both are ${nameOf(f1[1])}: the bottom ${f1[1]} stays the same.`, `${add ? 'Add' : 'Take away'} just the tops.`, `${f1[0]} ${p[1]} ${f2[0]} = ? ${nameOf(f1[1])}`);
    }
    if (f1 && f2) {
      const fs = fractionSteps(p);
      if (fs) {
        const topOf = (f: [number, number]) => { const ch = fs.changes.find((c) => c.d === f[1] && c.n === f[0]); return ch ? ch.n * ch.by : f[0]; };
        const moves = fs.changes.map((c) => `${c.n}/${c.d}: × ${c.by} on the top and the bottom makes ${c.n * c.by}/${fs.bottom}.`);
        const steps = [`The bottoms are ${fs.a[1]} and ${fs.b[1]}. Make them the same: ${fs.bottom}.`, ...moves,
          `${fs.sign === '+' ? 'Add' : 'Take away'} just the tops; the bottom ${fs.bottom} stays.${simplest ? ' Then simplify if you can.' : ''}`,
          `${topOf(fs.a)} ${fs.sign} ${topOf(fs.b)} = ?`];
        return card('fraction-add-different', 'Change to the same bottom', ...steps.slice(0, 5));
      }
    }
  }
  if (p.length === 5 && p[3] === '=' && p[4] === '?' && p[1] === '×') {
    const f1 = frac(p[0]), f2 = frac(p[2]);
    if (!f1 || !f2) return null;
    return card('fraction-times', 'Top times top, bottom times bottom', 'Multiply the tops together. Multiply the bottoms together.',
      `Tops: ${f1[0]} × ${f2[0]}. Bottoms: ${f1[1]} × ${f2[1]}.${simplest ? ' Then simplify if you can.' : ''}`, `${f1[0]} × ${f2[0]} = ? over ${f1[1]} × ${f2[1]} = ?`);
  }
  if (p.length === 5 && p[3] === '=' && p[4] === '?' && p[1] === '÷') {
    const f2 = frac(p[2]), f1 = frac(p[0]);
    const w = num(p[0]);
    if (w !== null && Number.isInteger(w) && f2) {
      const [a, b] = f2;
      if (a === 1) return card('fraction-divide', 'How many fit in each whole?', `How many ${nameOf(b)} fit in ${w}? Each whole has ${b} of them.`, `${w} whole${w > 1 ? "s" : ""}: ${w} × ${b} = ?`);
      return card('fraction-divide', 'Count the small parts, then group', `Each whole has ${b} of the 1/${b} parts.`, `${w} wholes make ${w} × ${b} = ${w * b} of them.`, `Group them in ${a}s: ${w * b} ÷ ${a} = ?`);
    }
    const n = num(p[2]);
    if (f1 && n !== null && Number.isInteger(n) && n > 1) return card('fraction-divide', 'Cut each part smaller', `Dividing ${p[0]} by ${n} cuts each part into ${n} smaller parts.`, `The top stays ${f1[0]}.`, `The bottom gets ${n} times bigger: ${f1[1]} × ${n} = ?`);
  }
  return null;
};

// ---------------------------------------------------------------- equivalent fractions

const equivalent: Helper = (q) => {
  const p = q.parts;
  const ch = choicesOf(q);
  if (p.length === 4 && /^simplify$/i.test(p[0]) && p[2] === '=' && p[3] === '?') {
    const f = frac(p[1]);
    if (!f) return null;
    const g = gcd(f[0], f[1]);
    if (g < 2) return null;
    return card('simplify', 'Divide the top and bottom by the same number', `Find the biggest number that goes into both ${f[0]} and ${f[1]}.`, `${f[0]} and ${f[1]} are both in the ${g} times table.`, `Divide the top and the bottom by ${g}: ${f[0]} ÷ ${g} = ? and ${f[1]} ÷ ${g} = ?`);
  }
  if (p.length !== 3 || p[1] !== '=') return null;
  void ch;
  const slot = (t: string) => { const m = /^(\d+|\?)\/(\d+|\?)$/.exec(t); return m ? [m[1] === '?' ? null : Number(m[1]), m[2] === '?' ? null : Number(m[2])] as [number | null, number | null] : null; };
  let L = slot(p[0]), R = slot(p[2]);
  if (!L || !R) return null;
  if (L.includes(null)) [L, R] = [R, L];
  if (L.includes(null) || R.filter((x) => x === null).length !== 1) return null;
  const [a, b] = L as [number, number];
  const [c, d] = R;
  const how = (from: number, to: number) => (to >= from ? { op: '×', k: to / from } : { op: '÷', k: from / to });
  if (c === null && d !== null) {
    const { op, k } = how(b, d);
    if (!Number.isInteger(k)) return null;
    return card('equivalent-fractions', 'Do the same to the top and the bottom', `Look at the bottoms: ${b} → ${d}. That is ${op} ${k}.`, 'To keep the fraction equal, do the same to the top.', `${a} ${op} ${k} = ?`);
  }
  if (d === null && c !== null) {
    const { op, k } = how(a, c);
    if (!Number.isInteger(k)) return null;
    return card('equivalent-fractions', 'Do the same to the top and the bottom', `Look at the tops: ${a} → ${c}. That is ${op} ${k}.`, 'To keep the fraction equal, do the same to the bottom.', `${b} ${op} ${k} = ?`);
  }
  return null;
};

// ---------------------------------------------------------------- percent change, swapping, ratio

const percentChange: Helper = (q) => {
  const prompt = q.prompt ?? '';
  const m = /^(\d+)% (off|more than) \$(\d+(?:\.\d+)?)$/.exec(prompt);
  if (m) {
    const P = Number(m[1]), N = Number(m[3]);
    const { how, calc } = pctParts(P, N);
    const off = m[2] === 'off';
    return card('percent-change', off ? 'Find the discount, then take it off' : 'Find the extra, then add it on', `${off ? 'Find the discount' : 'Find the extra'} first: ${P}% of $${show(N)}.`, how,
      `${off ? 'Take it off' : 'Add it on'}: $${show(N)} ${off ? '−' : '+'} (${calc}) = ?`);
  }
  const p = q.parts;
  if (p.length === 7 && p[1] === '×' && p[3] === '=' && p[5] === '×' && p[6] === '?') {
    const A = pct(p[0]), B = pct(p[4]), n = num(p[2]);
    if (A !== null && B !== null && n !== null) {
      return card('percent-swap', 'A percent and a number can swap', 'A trick: the percent and the number can swap places and the answer stays the same.',
        `On the left the percent is ${A}% and the number is ${n}.`, `On the right the percent is ${B}%. Swap them over: what number goes in the gap? ?`);
    }
  }
  return null;
};

const ratio: Helper = (q) => {
  const p = q.parts;
  if (p.length === 7 && p[1] === ':' && p[3] === '=' && p[5] === ':') {
    const v = [p[0], p[2], p[4], p[6]].map((t) => (t === '?' ? null : num(t)));
    const at = v.indexOf(null);
    if (v.filter((x) => x === null).length !== 1) return null;
    // Pairs: (first of each side) and (second of each side).
    const [a, b, c, d] = v;
    const how = (from: number, to: number) => (to >= from ? { op: 'times', k: to / from } : { op: 'divided by', k: from / to });
    if (at === 3 && a! > 0) { const h = how(a!, c!); return card('equal-ratios', 'Do the same to both numbers', `Look at the first numbers: ${a} → ${c}. That is ${h.op} ${show(h.k)}.`, 'Keep the ratio equal: do the same to the second number.', `${b} ${h.op === 'times' ? '×' : '÷'} ${show(h.k)} = ?`); }
    if (at === 2 && b! > 0) { const h = how(b!, d!); return card('equal-ratios', 'Do the same to both numbers', `Look at the second numbers: ${b} → ${d}. That is ${h.op} ${show(h.k)}.`, 'Keep the ratio equal: do the same to the first number.', `${a} ${h.op === 'times' ? '×' : '÷'} ${show(h.k)} = ?`); }
    if (at === 1 && c! > 0) { const h = how(c!, a!); return card('equal-ratios', 'Do the same to both numbers', `Look at the first numbers: ${c} → ${a}. That is ${h.op} ${show(h.k)}.`, 'Keep the ratio equal: do the same to the second number on the other side.', `${d} ${h.op === 'times' ? '×' : '÷'} ${show(h.k)} = ?`); }
    if (at === 0 && d! > 0) { const h = how(d!, b!); return card('equal-ratios', 'Do the same to both numbers', `Look at the second numbers: ${d} → ${b}. That is ${h.op} ${show(h.k)}.`, 'Keep the ratio equal: do the same to the first number on the other side.', `${c} ${h.op === 'times' ? '×' : '÷'} ${show(h.k)} = ?`); }
    return null;
  }
  const prompt = q.prompt ?? '';
  const share = /^Share (\d+) in the ratio (\d+) : (\d+)\.?$/.exec(prompt);
  if (share) {
    const total = Number(share[1]), x = Number(share[2]), y = Number(share[3]);
    const small = /small/i.test(p[0] ?? '');
    const mine = small ? Math.min(x, y) : Math.max(x, y);
    return card('ratio-share', 'Count the parts, find one part', `Add the ratio numbers to count the equal parts: ${x} + ${y} = ${x + y}.`, `Find one part: ${total} ÷ ${x + y} = ?`, `The ${small ? 'smaller' : 'bigger'} part is ${mine} parts: ${mine} × (one part) = ?`);
  }
  const eq = /^(\d+) (\w+) to (\d+) (\w+)\. There are (\d+) (\w+)\.?$/.exec(prompt);
  if (eq) {
    const [n1, c1, n2, c2, T, ct] = [Number(eq[1]), eq[2], Number(eq[3]), eq[4], Number(eq[5]), eq[6]];
    const known = ct === c1 ? n1 : n2, other = ct === c1 ? n2 : n1, oc = ct === c1 ? c2 : c1;
    return card('ratio-groups', 'Count how many groups', `The ratio ${n1} ${c1} : ${n2} ${c2} is one group.`, `How many groups of ${known} ${ct} fit in ${T}? ${T} ÷ ${known} = ?`, `Each group has ${other} ${oc}: groups × ${other} = ?`);
  }
  return null;
};

export const FRACTIONS_HELPERS: Helper[] = [
  fractionOf,
  percentOf,
  conversions,
  fillIns,
  equivalent,
  fractionSum,
  shift,
  decimalOrder,
  decimalAddSub,
  decimalMulDiv,
  decimalDoubleHalf,
  moneyCard,
  percentChange,
  ratio,
];
