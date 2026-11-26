/**
 * Help for the early facts (to 20, doubles and halves, ten and a number), counting patterns, and the times tables with
 * division (docs/plans/help-me/PLAN.md H3). Tricks: count on from the bigger number, make a ten, near doubles, pairs to
 * 10; ×2 double, ×5 half of ×10, ×9 ten lots take one, a fact you already know and one more lot.
 */
import { num, show, solve, sum, type Sum } from './read';
import type { HelpCard, HelpContext, HelpQuestion, Helper } from './types';

const card = (kind: string, title: string, ...steps: string[]): HelpCard => ({ kind, title, steps });

// ---------------------------------------------------------------- adding and taking away to 20

function addTo20(s: Sum): HelpCard | null {
  if (s.op !== '+' && s.op !== '−') return null;
  const nums = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 20)) return null;
  const { a, b, c } = s;
  if (s.op === '+' && c === null) {
    const big = Math.max(a!, b!), small = Math.min(a!, b!);
    if (small === 0) return card('facts', 'Adding 0', `Adding 0 changes nothing.`, `${a} + ${b} = ?`);
    if (big === 10) return card('ten-and', 'Ten and some ones', `10 + ${small} is 1 ten and ${small} ones.`, `Say it as a teen number: 1 ten and ${small} ones is ?`);
    if (a === b) return card('doubles', 'A double', `${a} + ${a} is double ${a}.`, ...doubleSteps(a!));
    if (big - small === 1) return card('near-doubles', 'Near double', `${small} + ${small} = ${small * 2}.`, `${big} is one more than ${small}, so add one more.`, `${small * 2} + 1 = ?`);
    if (big + small <= 10) return card('count-on', 'Count on from the bigger number', `Put ${big} in your head.`, `Count on ${small}: ${countOn(big, small)}`);
    if (big < 10) {
      const fill = 10 - big;
      return card('make-ten', 'Make a ten', `${big} + ${fill} = 10.`, `Split ${small} into ${fill} and ${small - fill}.`, `10 + ${small - fill} = ?`);
    }
    return card('facts', 'Add the ones', `${big} is 1 ten and ${big - 10} ones.`, `Add the ones: ${big - 10} + ${small} = ${big - 10 + small}.`, `1 ten and ${big - 10 + small} ones is ?`);
  }
  if (s.op === '−' && c === null) {
    if (b === 0) return card('facts', 'Taking away 0', 'Taking away 0 leaves it the same.', `${a} − 0 = ?`);
    if (b === 10 && a! >= 10) return card('ten-and', 'Take the ten away', `${a} is 1 ten and ${a! - 10} ones.`, `Take the ten away and the ones are left: ?`);
    if (a === 10) return card('pairs-10', 'Pairs that make 10', `${b} and what make 10?`, 'Pairs to 10: 1+9, 2+8, 3+7, 4+6, 5+5.', `${b} + ? = 10`);
    if (a === 20) return card('pairs-20', 'Count up to 20', `Count up from ${b} to 20.`, b! < 10 ? `${b} → 10 is ${10 - b!}, then 10 more to 20.` : `${b} → 20: how many jumps?`, `${b} + ? = 20`);
    if (a! === b! * 2) return card('doubles', 'Use a double', `Double ${b} is ${a}.`, `So ${a} − ${b} = ?`);
    if (a! > 10 && b! < 10 && a! - b! < 10) {
      const toTen = a! - 10;
      return card('make-ten', 'Take away to 10 first', `${a} − ${toTen} = 10.`, `${b} is ${toTen} and ${b! - toTen}. Take ${b! - toTen} more.`, `10 − ${b! - toTen} = ?`);
    }
    if (a! - b! <= 3) return card('count-up', 'Count up', `${a} and ${b} are close together.`, `Count up from ${b} to ${a}: ${countOn(b!, a! - b!)}`, `How many did you count? ?`);
    if (a! > 10 && b! < 10) return card('facts', 'Take from the ones', `${a} is 1 ten and ${a! - 10} ones.`, `${a! - 10} − ${b} = ${a! - 10 - b!}. The ten stays.`, `1 ten and ${a! - 10 - b!} ones is ?`);
    return card('count-back', 'Count back', `Start at ${a}.`, `Count back ${b}: ${countBack(a!, b!)}`);
  }
  // A missing number: think of it as adding on.
  if (s.op === '+') {
    const known = a ?? b!;
    if (c === 10) return card('pairs-10', 'Pairs that make 10', `${known} and what make 10?`, 'Pairs to 10: 1+9, 2+8, 3+7, 4+6, 5+5.', `${known} + ? = 10`);
    return card('count-up', 'Count up to the total', `Start at ${known}.`, `Count up to ${c}. ${known < 10 && c! > 10 ? `${known} → 10 is ${10 - known}, then on to ${c}.` : ''}`.trim(), `How many did you count on? ?`);
  }
  if (a === null) return card('count-up', 'Add it back on', `Something take away ${b} leaves ${c}.`, `So it was ${c} + ${b} = ?`);
  return card('count-up', 'How far apart?', `From ${c} up to ${a}.`, `${a} − ${c} = ?`);
}

function countOn(from: number, n: number): string {
  const said = Array.from({ length: Math.min(n, 4) }, (_, i) => from + 1 + i);
  return n <= 3 ? `${said.slice(0, -1).concat([]).join(', ')}${n > 1 ? ', ' : ''}?` : `${said.slice(0, 2).join(', ')}, … ?`;
}
function countBack(from: number, n: number): string {
  const said = Array.from({ length: Math.min(n, 3) }, (_, i) => from - 1 - i);
  return n <= 3 ? `${said.slice(0, -1).join(', ')}${n > 1 ? ', ' : ''}?` : `${said.slice(0, 2).join(', ')}, … ?`;
}

function doubleSteps(n: number): string[] {
  if (n <= 5) return [`Show ${n} ${n === 1 ? 'finger' : 'fingers'} on each hand.`, 'Count them all: ?'];
  if (n <= 10) return [`Double 5 is 10. Double ${n - 5} is ${(n - 5) * 2}.`, `10 + ${(n - 5) * 2} = ?`];
  const tens = Math.floor(n / 10) * 10, ones = n - tens;
  // A whole number of tens: double the tens like ones, so no step says the answer.
  if (ones === 0) return [`${n} is ${tens / 10} tens.`, `Double ${tens / 10} tens is how many tens? ?`];
  return [`Double ${tens} is ${tens * 2}. Double ${ones} is ${ones * 2}.`, `${tens * 2} + ${ones * 2} = ?`];
}

function halfSteps(n: number): string[] {
  if (n <= 10) return [`Share ${n} into two equal groups.`, `What doubles to make ${n}? ?`];
  const tens = n >= 20 && n % 20 !== 10 ? Math.floor(n / 20) * 20 : 10;
  const rest = n - tens;
  if (rest === 0 || n % 20 === 0) return [`${n} is ${n / 10} tens.`, `Half of ${n / 10} tens is how many tens? ?`];
  return [`Half of ${tens} is ${tens / 2}. Half of ${rest} is ${rest / 2}.`, `${tens / 2} + ${rest / 2} = ?`];
}

const doublesWords: Helper = (q) => {
  // "Half of 12 = ?" may come as ['Half', 'of', '12', '=', '?'].
  const p = q.parts.length === 5 && /^half$/i.test(q.parts[0]) && q.parts[1] === 'of' ? ['Half of', ...q.parts.slice(2)] : q.parts;
  if (p.length === 4 && /^double$/i.test(p[0]) && p[2] === '=' && p[3] === '?') {
    const n = num(p[1]);
    if (n !== null && Number.isInteger(n)) return card('doubles', 'Doubling', ...doubleSteps(n));
  }
  if (p.length === 4 && /^half of$/i.test(p[0]) && p[2] === '=' && p[3] === '?') {
    const n = num(p[1]);
    if (n !== null && Number.isInteger(n) && n % 2 === 0) return card('halves', 'Halving', ...halfSteps(n));
  }
  return null;
};

// ---------------------------------------------------------------- times tables and division

/** The easiest factor to use a trick on first. */
const EASY = [0, 1, 10, 2, 5, 11, 9, 4, 3, 8, 6, 12, 7];

/** Times `n` by the table `t`, as the trick for that table. */
function trick(n: number, t: number): { title: string; steps: string[] } {
  switch (t) {
    case 0: return { title: 'Times 0', steps: [`${n} lots of nothing is nothing.`, `${n} × 0 = ?`] };
    case 1: return { title: 'Times 1', steps: ['Times 1 means just one lot: the number stays the same.', `${n} × 1 = ?`] };
    case 2: return { title: 'Times 2 is a double', steps: [`2 × ${n} is double ${n}: ${n} + ${n}.`, `${n} + ${n} = ?`] };
    case 10: return { title: 'Times 10', steps: [`${n} tens.`, `The ${n} moves to the tens and a 0 goes in the ones: ?`] };
    case 5: return { title: 'Half of times 10', steps: [`10 × ${n} = ${10 * n}.`, `5 is half of 10, so take half of ${10 * n}.`, `Half of ${10 * n} = ?`] };
    case 9: return { title: 'Times 10, take away one lot', steps: [`10 × ${n} = ${10 * n}.`, `9 lots is one lot less.`, `${10 * n} − ${n} = ?`] };
    case 11: return n <= 9
      ? { title: 'Times 11', steps: [`10 × ${n} = ${10 * n}, and one more ${n}.`, `Up to 9 × 11 the digit comes twice.`, `${10 * n} + ${n} = ?`] }
      : { title: 'Times 10 and one more lot', steps: [`10 × ${n} = ${10 * n}.`, `One more lot of ${n}.`, `${10 * n} + ${n} = ?`] };
    case 4: return { title: 'Double, then double again', steps: [`Double ${n} = ${2 * n}.`, `Double ${2 * n} = ?`] };
    case 8: return { title: 'Double three times', steps: [`Double ${n} = ${2 * n}.`, `Double ${2 * n} = ${4 * n}.`, `Double ${4 * n} = ?`] };
    case 3: return { title: 'Double, then one more lot', steps: [`Double ${n} = ${2 * n}.`, `One more ${n}.`, `${2 * n} + ${n} = ?`] };
    case 6: return { title: 'Times 5 and one more lot', steps: [`5 × ${n} = ${5 * n} (half of ${10 * n}).`, `One more ${n}.`, `${5 * n} + ${n} = ?`] };
    case 12: return { title: 'Times 10 and times 2', steps: [`10 × ${n} = ${10 * n}.`, `2 × ${n} = ${2 * n}.`, `${10 * n} + ${2 * n} = ?`] };
    case 7: return { title: 'Times 5 and times 2', steps: [`5 × ${n} = ${5 * n}.`, `2 × ${n} = ${2 * n}.`, `${5 * n} + ${2 * n} = ?`] };
    default: return { title: 'Count in lots', steps: [`Count in ${t}s, ${n} times.`, `${n} × ${t} = ?`] };
  }
}

const isKnown = (ctx: HelpContext, x: number, y: number) =>
  !!ctx.known && (ctx.known(`mul:${x}x${y}`) || ctx.known(`mul:${y}x${x}`));

/** A fact next door that the pupil already has secure: 6 × 7 for 6 × 8. */
function nearFact(a: number, b: number, ctx: HelpContext): HelpCard | null {
  if (!ctx.known) return null;
  for (const [n, t] of [[a, b], [b, a]] as const) {
    if (t - 1 >= 2 && isKnown(ctx, n, t - 1)) {
      const x = n * (t - 1);
      return card('known-fact', 'Use a fact you know', `You know ${n} × ${t - 1} = ${x}.`, `${n} × ${t} is one more ${n}.`, `${x} + ${n} = ?`);
    }
    if (t + 1 <= 12 && isKnown(ctx, n, t + 1)) {
      const x = n * (t + 1);
      return card('known-fact', 'Use a fact you know', `You know ${n} × ${t + 1} = ${x}.`, `${n} × ${t} is one ${n} less.`, `${x} − ${n} = ?`);
    }
  }
  return null;
}

function times(a: number, b: number, ctx: HelpContext): HelpCard {
  const near = Math.min(a, b) > 2 && Math.max(a, b) !== 10 ? nearFact(a, b, ctx) : null;
  if (near) return near;
  const t = EASY.find((x) => x === a || x === b)!;
  const n = t === a ? b : a;
  const { title, steps } = trick(n, t);
  const turned = t === a && a !== b && t > 1 ? [`Turn it round: ${a} × ${b} is the same as ${b} × ${a}.`] : [];
  return card('tables', title, ...(turned.length + steps.length <= 4 ? turned : []), ...steps);
}

/** Which number times `t` makes `c`, with the table's own help. */
function missingFactor(t: number, c: number): HelpCard {
  if (t === 2) return card('tables', 'Halve it', `What doubles to make ${c}?`, `Half of ${c} = ?`);
  if (t === 10) return card('tables', 'Take off the zero', `${c} is how many tens?`, `${c} ÷ 10 = ?`);
  if (t === 5) return card('tables', 'Double, then ÷ 10', `Double ${c} = ${2 * c}.`, `${2 * c} is how many tens? ?`);
  if (t === 1) return card('tables', 'Times 1', `One lot of anything is itself.`, `${c} ÷ 1 = ?`);
  const five = 5 * t;
  const from = c >= five
    ? c === five
      ? `10 × ${t} = ${10 * t}, and half of that is ${five}. So it is half of 10 lots.`
      : `Start at 5 × ${t} = ${five}. Count on in ${t}s to ${c}: ${countBy(five, t, c)}.`
    : `Count in ${t}s to ${c}: ${countBy(0, t, c)}.`;
  return card('tables', `Think of the ${t} times table`, `Which number times ${t} makes ${c}?`, from, `How many ${t}s is that? ?`);
}

function countBy(from: number, step: number, to: number): string {
  const out: number[] = [];
  for (let v = from + step; v <= to && out.length < 8; v += step) out.push(v);
  return out.join(', ');
}

function tables(s: Sum, ctx: HelpContext): HelpCard | null {
  const nums = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
  if (s.op === '×') {
    if (s.c === null) return s.a! <= 12 && s.b! <= 12 ? times(s.a!, s.b!, ctx) : null;
    const t = s.a ?? s.b!;
    return t <= 12 && s.c <= 144 ? missingFactor(t, s.c) : null;
  }
  if (s.op === '÷') {
    // a ÷ b = ?  (b × ? = a)   a ÷ ? = c  (c × ? = a)   ? ÷ b = c  (b × c = ?)
    if (s.a === null) return s.b! <= 12 && s.c! <= 12 ? card('tables', 'Times it back', `Something shared by ${s.b} gives ${s.c}.`, `So it is ${s.c} × ${s.b}.`, ...times(s.c!, s.b!, ctx).steps.slice(-1)) : null;
    const by = s.b ?? s.c!;
    if (by === 0 || by > 12 || s.a > 144 || s.a % by !== 0) return null;
    if (by === 2 && s.c === null && s.a <= 40) return card('halves', 'Dividing by 2 is halving', ...halfSteps(s.a));
    const fact = missingFactor(by, s.a);
    return card('tables', fact.title, `Think of the times fact: ${by} × ? = ${s.a}.`, ...fact.steps.filter((step) => !step.startsWith('Which number')));
  }
  return null;
}

// ---------------------------------------------------------------- counting patterns

/** "What is missing? 0, ?, 20, 30", "What comes next? 2, 6, 10, ?", "Count back. 5, 0, −5, ?". */
const pattern: Helper = (q) => {
  const items = q.parts.map((p) => p.replace(/,$/, '').trim()).filter((p) => p !== '');
  if (items.length < 3 || items.filter((p) => p === '?').length !== 1) return null;
  const vals = items.map((p) => (p === '?' ? null : num(p)));
  if (vals.some((v, i) => v === null && items[i] !== '?')) return null;
  const at = items.indexOf('?');
  const pairs: number[] = [];
  for (let i = 0; i + 1 < vals.length; i++) if (vals[i] !== null && vals[i + 1] !== null) pairs.push(vals[i + 1]! - vals[i]!);
  if (!pairs.length) return null;
  const step = Math.round(pairs[0] * 1e6) / 1e6;
  if (pairs.some((d) => Math.abs(d - step) > 1e-9) || step === 0) return null;
  const up = step > 0;
  const by = show(Math.abs(step));
  const known = at > 0 ? vals[at - 1]! : vals[at + 1]!;
  const fromBefore = at > 0;
  const i0 = vals.findIndex((v) => v !== null), i1 = vals.findIndex((v, i) => i > i0 && v !== null);
  const gap = i1 - i0 === 1 ? `a jump of ${by}` : `${show(Math.abs(vals[i1]! - vals[i0]!))} in ${i1 - i0} jumps of ${by}`;
  return card('pattern', up ? `It goes up by ${by}` : `It goes down by ${by}`,
    `${show(vals[i0]!)} to ${show(vals[i1]!)} is ${gap}. Check the others: the same.`,
    fromBefore
      ? `${show(known)} ${up ? '+' : '−'} ${by} = ?`
      : `The one before ${show(known)}: ${show(known)} ${up ? '−' : '+'} ${by} = ?`);
};

// ---------------------------------------------------------------- the helpers in this file, in order

export const BASIC_HELPERS: Helper[] = [
  doublesWords,
  (q, ctx) => {
    const s = sum(q);
    if (!s) return null;
    // Doubles and halves written as sums: "6 + 6 = ?", "12 ÷ 2 = ?".
    return addTo20(s) ?? tables(s, ctx);
  },
  pattern,
];

/** For tests: the missing number of a sum on screen (never shown to a pupil). */
export const answerOf = (q: HelpQuestion) => {
  const s = sum(q);
  return s ? solve(s) : null;
};
