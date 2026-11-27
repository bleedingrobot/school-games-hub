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
    if (b === 2) return card('fraction-of', 'Half is the double backwards', 'A half is 1 of 2 equal groups.', `Think of the doubles: what number added to itself makes ${show(N)}?`, top);
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
    return card('percent-of', P === 10 ? '10% is divide by 10' : P === 1 ? '1% is divide by 100' : P === 50 ? '50% is half' : P === 25 ? '25% is a quarter' : 'Find 10% (or a quarter), then build', how, `${calc[0].toUpperCase()}${calc.slice(1)} = ?`);
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
    `How many ${PLACES[d.dp]} is ${t}? Look at the digit${d.dp > 1 ? 's' : ''} after the point.`,
  ];
  if (simplify) steps.push(`Write that many ${PLACES[d.dp]} over ${bottom}, then divide top and bottom by ${g}: ?`);
  else steps.push(`Write that many ${PLACES[d.dp]} as a fraction: ?`);
  return card('dec-to-fraction', 'Say the decimal in tenths or hundredths', ...steps);
}

/** A fraction with 10, 100 or 1000 on the bottom as a decimal. */
function tenthFracToDec(a: number, b: number): HelpCard | null {
  const dp = b === 10 ? 1 : b === 100 ? 2 : b === 1000 ? 3 : 0;
  if (!dp) return null;
  return card('frac-to-decimal', 'Put the top in the right places', `Bottom number (denominator) ${b} means ${PLACES[dp]}: ${dp} place${dp > 1 ? 's' : ''} after the point.`,
    `Top number (numerator) ${a} fills ${dp === 1 ? 'that place' : `those ${dp} places`}${a < b / 10 ? ' (put a 0 in front)' : ''}.`, 'Write it with the point: ?');
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
  // The percents a Year 5 pupil should just know come first: 10%, 25%, 50%, 75%.
  if (P === 75) return card('pct-to-fraction', 'Use a percent you know', '25% is 25 out of 100. 4 lots of 25 make 100.', '75 is 3 lots of 25, so 75% is 3 lots of 25%.', 'Say 25% as a fraction. 3 lots of it make ?/?');
  if (P === 10 || P === 25 || P === 50) return card('pct-to-fraction', 'Use a percent you know', `${P}% is ${P} out of 100.`, `How many lots of ${P} make 100?`, `So ${P}% is 1 out of that many equal parts: 1/?`);
  return card('pct-to-fraction', 'Percent means out of 100', '% means "out of 100", so a percent is a fraction with 100 on the bottom.', `${P}% is ${P}/100. What is the biggest number that goes into both ${P} and 100?`, 'Divide the top and the bottom by that number. Write the new fraction: ?');
}

const fractionToPct = (a: number, b: number): HelpCard | null =>
  100 % b === 0 ? card('fraction-to-pct', 'Find one part out of 100', '% means "out of 100".', `The bar has ${b} equal parts. 100 ÷ ${b} = ? So 1 part is that many out of 100.`,
    `${a === 1 ? '1 part is' : `${a} parts are`} shaded: ${a} × that number = ?`) : null;

const decToPct = (t: string, pick: boolean): HelpCard =>
  card('dec-to-pct', 'Times 100 for percent', 'Percent means out of 100, so 1 whole is 100%.', pick ? '× 100 moves each digit two places left. Then pick the choice with that percent.' : '× 100 moves each digit two places left.', `${t} × 100 = ?`);

const pctToDec = (P: number): HelpCard =>
  card('pct-to-decimal', 'Percent is hundredths', `% means out of 100, so ${show(P)}% is ${show(P)} hundredths.`, 'The first place after the point is tenths, the second is hundredths.', `Write ${show(P)} hundredths in those places: ?`);

function mixedImproper(a: number, b: number): HelpCard {
  // A times fact you know that is just too big, one lot of b over: the wholes are one less (34/8: 5 × 8 = 40, 40 − 8 = 32).
  const m = [2, 5, 10].find((x) => x * b > a && (x - 1) * b <= a);
  if (m) return card('mixed-number', 'Use a times fact', `Each whole uses ${b} parts.`, `A fact you know: ${m} × ${b} = ${m * b}. That is more than ${a}.`,
    `One ${b} less: ${m * b} − ${b} = ${(m - 1) * b}, which fits in ${a}. So how many wholes? ${m} − 1 = ?`);
  return card('mixed-number', 'Count in lots of the bottom number', `Each whole uses ${b} parts.`, `Count in ${b}s up to ${a}, but don't go past it.`, `How many ${b}s did you count? ?`);
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
      if (/power of 10/i.test(prompt)) return null;
      return decToFrac(p[0], ch);
    }
    const f = frac(p[0]);
    if (f) {
      const mixed = ch && ch.some((c) => c.includes(' '));
      if (mixed || (ch === null && f[0] > f[1] && /mixed/i.test(prompt))) return mixedImproper(f[0], f[1]);
      if (ch && ch.some((c) => c.includes('/')) && !/decimal/i.test(prompt)) {
        // Choice bottoms in the starting bottom's times table: if they all use one multiplier, name it.
        const ks = new Set<number>();
        for (const c of ch) {
          const g = frac(c);
          if (g && g[1] > f[1] && g[1] % f[1] === 0) ks.add(g[1] / f[1]);
        }
        if (ks.size === 1) {
          return card('equivalent-fractions', 'Match the bottom first', `Look at the bar: ${f[1]} parts, ${f[0]} shaded.`,
            `Look at the bottoms of the choices. Which one is bigger than ${f[1]} and in the ${f[1]} times table?`, `How many times bigger than ${f[1]} is that bottom? Do the same to the top: ${f[0]} × (that number) = ? Which choice matches?`);
        }
        return card('equivalent-fractions', 'Do the same to the top and the bottom',
          'Equal fractions come from multiplying (or dividing) the top and the bottom by the same number.',
          `Check each choice: how many times bigger is its bottom than ${f[1]}? And its top than ${f[0]}?`, 'Which choice has both multiplied by the same number? ?');
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
    if (L === '1') {
      const nm = nameOf(b), single = one(1, nm);
      return card('fraction-bonds', 'Count the parts in the whole', `The whole is cut into ${nm}.`, `Each ${single} is 1/${b}.`, `How many ${nm} fill the whole? ?`);
    }
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
  if (m && f && Number(m[2]) === f[1]) return mixedImproper(f[0], f[1]);
  return null;
};

// ---------------------------------------------------------------- times and divide by 10, 100, 1000, and decimal order

type Part = { digit: number; exp: number };
const PLACE_NAMES: Record<number, { one: string; many: string }> = {
  3: { one: 'thousand', many: 'thousands' }, 2: { one: 'hundred', many: 'hundreds' }, 1: { one: 'ten', many: 'tens' }, 0: { one: 'one', many: 'ones' },
  [-1]: { one: 'tenth', many: 'tenths' }, [-2]: { one: 'hundredth', many: 'hundredths' }, [-3]: { one: 'thousandth', many: 'thousandths' },
  [-4]: { one: 'ten-thousandth', many: 'ten-thousandths' }, [-5]: { one: 'hundred-thousandth', many: 'hundred-thousandths' },
};
const placeName = (e: number) => PLACE_NAMES[e] ?? { one: 'place', many: 'place' };
/** The non-zero digits of a plain number with their place values, biggest place first (null when too long to name). */
function placeParts(x: string): Part[] | null {
  if (!/^\d+(\.\d+)?$/.test(x)) return null;
  const [i, f = ''] = x.split('.');
  const out: Part[] = [];
  [...i].forEach((c, n) => { if (c !== '0') out.push({ digit: Number(c), exp: i.length - 1 - n }); });
  [...f].forEach((c, n) => { if (c !== '0') out.push({ digit: Number(c), exp: -(n + 1) }); });
  return out.length && out.length <= 3 && out.every((d) => d.exp <= 3 && d.exp >= -5) ? out : null;
}

const shift: Helper = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '×' && s.op !== '÷')) return null;
  const isPow = (n: number | null) => n === 10 || n === 100 || n === 1000;
  const placesOf = (n: number) => Math.log10(n);
  const pl = (k: number) => `${k} place${k > 1 ? 's' : ''}`;
  if (s.c === null && s.a !== null && isPow(s.b)) {
    const k = placesOf(s.b!), x = show(s.a);
    if (s.op === '×' && !q.parts[0].includes('.')) return null;
    // A times-table fact like 60 ÷ 10 gets the basic facts' "take off the zero" card instead.
    if (s.op === '÷' && s.b === 10 && Number.isInteger(s.a) && s.a % 10 === 0 && s.a <= 120) return null;
    const left = s.op === '×', dir = left ? 'left' : 'right';
    const parts = placeParts(x);
    const title = `${left ? 'Times' : 'Divide by'} ${s.b}: each digit moves ${pl(k)} ${dir}`;
    const rule = `${left ? '×' : '÷'} ${s.b} makes every digit ${s.b} times ${left ? 'bigger' : 'smaller'}.`;
    const kind = left ? 'times-decimals' : 'divide-decimals';
    if (!parts) return card(kind, title, rule, `Each digit moves ${pl(k)} to the ${dir}.`, 'Write the new number: ?');
    const say = (d: Part) => `${d.digit} ${d.digit === 1 ? placeName(d.exp).one : placeName(d.exp).many}`;
    const verb = (d: Part) => (d.digit === 1 ? 'moves' : 'move');
    const lo = parts[parts.length - 1], hi = parts[0];
    const landing = (d: Part) => placeName(d.exp + (left ? k : -k)).many;
    let move: string;
    if (k === 1 && parts.length > 1) move = `${rule} The ${say(lo)} ${verb(lo)} into the ${landing(lo)} place. Where does the ${say(hi)} go?`;
    else move = `${rule} Each digit moves ${pl(k)} ${dir}. Which place ${lo.digit === 1 ? 'does' : 'do'} the ${say(lo)} move into?`;
    return card(kind, title, `${x} is ${parts.map(say).join(parts.length > 2 ? ', ' : ' and ')}.`, move, 'Write the new number: ?');
  }
  if (s.a === null && s.b !== null && isPow(s.b) && s.c !== null) {
    return card('times-decimals', 'Do the opposite', `The opposite of ${s.op} ${s.b} is ${s.op === '×' ? '÷' : '×'} ${s.b}.`, `${show(s.c)} ${s.op === '×' ? '÷' : '×'} ${s.b} = ?`);
  }
  if (s.b === null && s.a !== null && s.c !== null && s.op === '×' && (q.parts[0].includes('.') || q.parts[4].includes('.'))) {
    const from = placeParts(show(s.a)), to = placeParts(show(s.c));
    if (from && to && from[0].digit === to[0].digit && to[0].exp - from[0].exp >= 1 && to[0].exp - from[0].exp <= 3) {
      const d = from[0].digit, path = [];
      for (let e = from[0].exp; e <= to[0].exp; e++) path.push(placeName(e).many);
      return card('times-decimals', `Count how far the ${d} moved`, `In ${show(s.a)} the ${d} is in the ${placeName(from[0].exp).many} place. In ${show(s.c)} the ${d} is in the ${placeName(to[0].exp).many} place.`,
        `Count the places the ${d} moved to the left: ${path.join(' → ')}.`, `1 place left is × 10, 2 places is × 100, 3 places is × 1000. ${show(s.a)} × ? = ${show(s.c)}. Which one is it?`);
    }
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
        if (b < 1 && a > 1) return card('take-from-whole', 'Break off one whole', `Break one whole off ${a}: ${a} is ${a - 1} and 1.`, `1 − ${show(b)} = ? (what makes 1 with ${show(b)}?)`, `Put your answer to step 2 back with the ${a - 1}: ?`);
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
    return card('count-up', 'Count up from the smaller number', `Count up from ${show(b)} to ${show(a)} in two jumps.`, `First jump to ${ceilB}: ${bt} tenths + ? tenths = 10 tenths. Write that jump as a decimal.`, `Then ${ceilB} → ${show(a)} is ${show(j2)}. Add the two jumps: ? + ${show(j2)} = ?`);
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
  const tn = Math.round(f * 10), tenths = tn === 1 ? 'tenth' : 'tenths';
  // The part after the point in tenths, or in hundredths when it has two places.
  const hun = dpOf(f) === 2, unit = hun ? 'hundredths' : 'tenths', un = `${Math.round(f * (hun ? 100 : 10))} ${unit}`;
  if (double) {
    if (w === 0) return card('decimal-double', 'Double the tenths', `${show(f)} is ${tn} ${tenths}.`, `Double it: ${tn} + ${tn} = ? tenths.`, 'Write that many tenths as a decimal: ?');
    return card('decimal-double', 'Double each part', `Split ${show(x)} into ${w} and ${show(f)}.`, `Double ${w} is ${w * 2}. Double ${show(f)}: ${un} + ${un} = ? ${unit}.`, `Put the two doubles together: ${w * 2} + that = ?`);
  }
  if (w === 0) return card('decimal-half', 'Half the tenths', `${show(f)} is ${tn} ${tenths}.`, `Share them in 2: ${tn} ÷ 2 = ? tenths.`, 'Write that many tenths as a decimal: ?');
  return card('decimal-half', 'Halve each part', `Split ${show(x)} into ${w} and ${show(f)}.`, `Half of ${w} is ${show(w / 2)}. Half of ${show(f)}: ${un} shared in 2 = ? ${unit}.`, `Put the two halves together: ${show(w / 2)} + that = ?`);
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
    return card('simplify', 'Divide the top and bottom by the same number', `Find the biggest number that goes into both ${f[0]} and ${f[1]}. Think of the times tables they are both in.`,
      `Divide the top and the bottom by that number: ${f[0]} ÷ (that number) and ${f[1]} ÷ (that number).`, 'Write the new fraction: ?');
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
    // When the multiplier would be the answer, the pupil finds it.
    if (op === '÷' || a === 1) {
      return card('equivalent-fractions', 'Do the same to the top and the bottom', `Look at the bottoms: ${b} → ${d}. How many times ${op === '÷' ? 'smaller is' : 'bigger is'} ${d} than ${b}?`,
        'To keep the fraction equal, do the same to the top.', `${a} ${op} (that number) = ?`);
    }
    return card('equivalent-fractions', 'Do the same to the top and the bottom', `Look at the bottoms: ${b} → ${d}. That is ${op} ${k}.`, 'To keep the fraction equal, do the same to the top.', `${a} ${op} ${k} = ?`);
  }
  if (d === null && c !== null) {
    const { op, k } = how(a, c);
    if (!Number.isInteger(k)) return null;
    if (op === '÷' || b === 1) {
      return card('equivalent-fractions', 'Do the same to the top and the bottom', `Look at the tops: ${a} → ${c}. How many times ${op === '÷' ? 'smaller is' : 'bigger is'} ${c} than ${a}?`,
        'To keep the fraction equal, do the same to the bottom.', `${b} ${op} (that number) = ?`);
    }
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
      const ex = [[20, 5, 1], [50, 2, 1], [40, 10, 4], [30, 10, 3]].find(([x, y]) => ![A, B, n].includes(x) && ![A, B, n].includes(y))!;
      const swap = card('percent-swap', 'Try a small swap', `Try ${ex[0]}% × ${ex[1]} = ${ex[2]}, and ${ex[1]}% × ${ex[0]} = ${ex[2]}. The same!`, 'The percent and the number trade places.',
        `Left side: ${A}% × ${n}. The percent is ${A} and the number is ${n}.`, `Right side: the percent is ${B}. Which number is left over for the gap? ?`);
      // Check it the long way, only when both steps stay easy: 1% of 10, 20, 50 or 100, and 10%, 25% or 50% on the right.
      const lots = ({ 10: 10, 25: 4, 50: 2 } as Record<number, number>)[B];
      if (lots && [10, 20, 50, 100].includes(n)) {
        const one = show(n / 100), v = show((A * n) / 100);
        swap.also = card('percent-check', 'Check it', `Left side: 1% of ${n} is ${one}, so ${A}% of ${n} is ${A} × ${one} = ${v}.`,
          `The right side must be ${v} too: ${B}% of the gap is ${v}.`, `${B}% is 1 of ${lots} equal parts, so the gap is ${lots} lots of ${v}: ${v} × ${lots} = ?`);
      }
      return swap;
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
    return card('ratio-groups', 'Count how many groups', `The bar is one group: ${n1} ${c1} and ${n2} ${c2}.`, `How many groups of ${known} ${ct} fit in ${T}? ${T} ÷ ${known} = ?`, `Each of those groups has ${other} ${oc}: that many groups × ${other} = ?`);
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
