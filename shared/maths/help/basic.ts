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
    if (a === b && a !== 0) return card('doubles', 'A double', `${a} + ${a} is double ${a}.`, ...doubleSteps(a!));
    if (big === 10) return card('ten-and', 'Ten and some ones', `10 + ${small} is 1 ten and ${small} ones.`, `Say it as a teen number: 1 ten and ${small} ones is ?`);
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
    if (b === 10 && a! >= 10) {
      // Never print the ones or "10 ones": that is the answer.
      if (a === 10) return card('ten-and', 'Take the ten away', '10 is 1 ten.', 'Take that 1 ten away.', 'How many are left? ?');
      if (a! % 10 === 0) return card('ten-and', 'Take the ten away', `${a} is ${a! / 10} tens.`, 'Take 1 ten away.', 'How many tens are left? Say it as a number: ?');
      return card('ten-and', 'Take the ten away', `${a} is 1 ten and some ones.`, 'Take the 1 ten away.', 'How many are left? ?');
    }
    if (a === 10) return card('pairs-10', 'Pairs that make 10', `${b} and what make 10?`, fingers(b!), `${b} + ? = 10`);
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
    if (known === 0) {
      const [x, y] = [7, 3, 5, 9].filter((n) => n !== c);
      return card('pairs-10', 'Adding zero', `Adding 0 never changes a number: 0 + ${x} = ${x}, 0 + ${y} = ${y}.`, `So in ${a === null ? `? + 0 = ${c}` : `0 + ? = ${c}`}, what must ? be? ?`);
    }
    if (c === 10 && known === 10) return card('pairs-10', 'Already ten', 'You already have 10.', 'How many more do you need to make 10? ?');
    if (c === 10) return card('pairs-10', 'Pairs that make 10', `${known} and what make 10?`, fingers(known), `${known} + ? = 10`);
    // Make a ten first, then the rest: 4 + ? = 11 is 4 + ? = 10, then 1 more.
    // The frames card already fills the ten, so this one takes away instead: 4 + ? = 11 is 11 − 4.
    if (known < 10 && c! > 10) {
      const toTen = c! - 10, rest = known - toTen;
      const same = `${known} + ? = ${c} is the same as ${c} − ${known}.`;
      if (known === 1) return card('take-away', 'Take it away', same, `What is 1 less than ${c}? ?`);
      if (rest <= 0) return card('take-away', 'Take it away', same, `${c} − ${known} = ?`);
      return card('take-away', 'Take it away', same, `Take ${known} away from ${c}: ${c} − ${toTen} = 10, then 10 − ${rest} = ?`);
    }
    return card('count-up', 'Count up to the total', `Start at ${known}.`, `Count up to ${c}. ${known < 10 && c! > 10 ? `${known} → 10 is ${10 - known}, then on to ${c}.` : ''}`.trim(), `How many did you count on? ?`);
  }
  if (a === null) return card('count-up', 'Add it back on', `Something take away ${b} leaves ${c}.`, `So it was ${c} + ${b} = ?`);
  return card('count-up', 'How far apart?', `From ${c} up to ${a}.`, `${a} − ${c} = ?`);
}

const fingers = (n: number) => `Hold up ${n} ${n === 1 ? 'finger' : 'fingers'}. How many more fingers make 10?`;

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
  if (n === 10) return ['10 is 1 ten.', 'Double 1 ten is how many tens? ?'];
  // From 10 + 10, so it is a different route from the fives split on the dots card.
  if (n <= 10) return ['10 + 10 = 20.', `${n} is ${10 - n === 1 ? 'one' : 10 - n} less than 10, so take ${10 - n === 1 ? 'one' : 10 - n} off each 10.`, `20 − ${(10 - n) * 2} = ?`];
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
const EASY = [0, 1, 10, 2, 5, 11, 9, 4, 3, 8, 6, 7, 12];

/** Times `n` by the table `t`, as the trick for that table. */
function trick(n: number, t: number): { title: string; steps: string[] } {
  switch (t) {
    case 0: return { title: 'Times 0', steps: [`${n} lots of nothing is nothing.`, `${n} × 0 = ?`] };
    case 1: return { title: 'Times 1', steps: ['Times 1 means just one lot.', `How many is 1 lot of ${n}? ?`] };
    case 2: return { title: 'Times 2 is a double', steps: [`2 × ${n} is double ${n}: ${n} + ${n}.`, `${n} + ${n} = ?`] };
    case 10: return n < 10
      ? { title: 'Times 10', steps: [`${n} × 10 is ${n} tens.`, `Put the ${n} in the tens place. What goes in the ones place?`, 'Read the number: ?'] }
      : n === 10
        ? { title: 'Times 10', steps: ['10 × 10 is 10 tens.', '10 tens make 1 hundred.', 'Write 1 hundred as a number: ?'] }
        : { title: 'Times 10', steps: [`${n} × 10 is ${n} tens.`, '10 tens make 1 hundred. How many tens are left over?', 'Write the hundreds and tens as a number: ?'] };
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

/**
 * "Use a fact you know" for `lots` lots of `n`, built from the facts every pupil has (2, 5 and 10 lots), never naming the
 * answer (James, 27 Nov 2026: "Help should also offer known fact help"). Null for 0, 1, 2 and 10 lots: those are the facts.
 */
export function knownFactSteps(lots: number, n: number, unit = ''): string[] | null {
  const u = (v: number) => `${show(v)}${unit}`;
  const t2 = 2 * n, t5 = 5 * n, t10 = 10 * n;
  switch (lots) {
    case 3: return [`You know 2 × ${u(n)} = ${u(t2)}.`, `3 lots is one more ${u(n)}.`, `${u(t2)} + ${u(n)} = ?`];
    case 4: return [`You know 5 × ${u(n)} = ${u(t5)}.`, `4 lots is one ${u(n)} less.`, `${u(t5)} − ${u(n)} = ?`];
    case 5: return [`You know 10 × ${u(n)} = ${u(t10)}.`, '5 lots is half of 10 lots.', `Half of ${u(t10)} = ?`];
    case 6: return [`You know 5 × ${u(n)} = ${u(t5)}.`, `6 lots is one more ${u(n)}.`, `${u(t5)} + ${u(n)} = ?`];
    case 7: return [`You know 5 × ${u(n)} = ${u(t5)} and 2 × ${u(n)} = ${u(t2)}.`, '5 lots and 2 lots make 7 lots.', `${u(t5)} + ${u(t2)} = ?`];
    case 8: return [`You know 10 × ${u(n)} = ${u(t10)} and 2 × ${u(n)} = ${u(t2)}.`, '8 lots is 2 lots less than 10 lots.', `${u(t10)} − ${u(t2)} = ?`];
    case 9: return [`You know 10 × ${u(n)} = ${u(t10)}.`, `9 lots is one ${u(n)} less.`, `${u(t10)} − ${u(n)} = ?`];
    case 11: return [`You know 10 × ${u(n)} = ${u(t10)}.`, `11 lots is one more ${u(n)}.`, `${u(t10)} + ${u(n)} = ?`];
    case 12: return [`You know 10 × ${u(n)} = ${u(t10)} and 2 × ${u(n)} = ${u(t2)}.`, '10 lots and 2 lots make 12 lots.', `${u(t10)} + ${u(t2)} = ?`];
    default: return null;
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
  const made = card('tables', title, ...(turned.length + steps.length <= 4 ? turned : []), ...steps);
  // Doubling tricks (4 and 8 lots) also get a fact they know: 8 × 7 from 10 × 7 and 2 × 7.
  const fact = [4, 8].includes(t) && n > 2 && n !== 5 && n !== 10 ? knownFactSteps(t, n) : null;
  return fact ? { ...made, also: card('known-fact', 'Use a fact you know', ...fact) } : made;
}

/**
 * Which number times `t` makes `c`: a fact they know or halving first (James, 26 Nov 2026: "start with a known fact or
 * doubling or halving first"); counting in `t`s is its own card, shown last (countingCard).
 */
function missingFactor(t: number, c: number, ctx: HelpContext = {}): HelpCard {
  // n things in groups of n (or n × ? = n): the answer is 1, so no route from another fact makes sense.
  if (c === t) return card('tables', 'One group', `${c} things are put into groups of ${c}.`, 'How many groups can you make? ?');
  if (t === 2) return card('tables', 'Halve it', ...halfSteps(c));
  if (t === 10) return card('tables', 'Take off the zero', `${c} ÷ 10 asks: how many tens are in ${c}?`, `Cover the last 0 of ${c}.`, 'What number is left? ?');
  if (t === 5) {
    // The 5 times table is known: one lot less than the answer.
    const k = c / 5 - 1;
    return card('tables', 'Use a fact you know', `You know 5 × ${k} = ${5 * k}.`, `${c} is one more 5.`, `${k} + 1 = ?`);
  }
  if (t === 1) return card('tables', 'Lots of 1', 'One lot of anything is itself.', `How many lots of 1 make ${c}? ?`);
  const n = c / t;
  if (t === 4 && c % 2 === 0 && n !== c / 2) return { ...card('halves', 'Halve, then halve again', `Sharing by 4 is halving twice.`, `Half of ${c} = ${c / 2}.`, `Half of ${c / 2} = ?`), ...(n > 2 ? { also: fromFact(t, c, ctx) } : {}) };
  if (t === 8 && c % 4 === 0 && n !== c / 4) {
    return { ...card('halves', 'Halve three times', `Sharing by 8 is halving three times.`, `Half of ${c} = ${c / 2}. Half of ${c / 2} = ${c / 4}.`, `Half of ${c / 4} = ?`), ...(n > 2 ? { also: fromFact(t, c, ctx) } : {}) };
  }
  return fromFact(t, c, ctx);
}

/** Which number times `t` makes `c`, from a fact they know (or 1, 2, 5 or 10 lots) and the lots between. */
function fromFact(t: number, c: number, ctx: HelpContext): HelpCard {
  const n = c / t;
  // Start from a fact they know (or an easy one: 2, 5 or 10 lots) that isn't the answer, and count the lots between.
  const anchors = [1, 2, 5, 10, ...(ctx.known ? Array.from({ length: 12 }, (_, i) => i + 1).filter((k) => isKnown(ctx, k, t)) : [])]
    .filter((k) => k !== n && k <= 12);
  const k = anchors.reduce((best, x) => (Math.abs(c - x * t) < Math.abs(c - best * t) ? x : best), anchors[0]);
  const from = k * t;
  const lots = Math.abs(c - from) / t;
  const known = ctx.known && isKnown(ctx, k, t) && ![1, 2, 5, 10].includes(k);
  return card('tables', known ? 'Use a fact you know' : 'Start from a fact you know',
    `You know ${k} × ${t} = ${from}.`,
    `${c} is ${Math.abs(c - from)} ${c > from ? 'more' : 'less'}: that is ${lots} ${c > from ? 'more' : 'fewer'} ${t}${lots === 1 ? '' : 's'}.`,
    `${k} ${c > from ? '+' : '−'} ${lots} = ?`);
}

/**
 * Counting in lots, the last kind of help on a times or sharing question (James, 26 Nov 2026: "skip counting should be the
 * last type of help"). Null when the question isn't one, or the counting would be too long to be any help.
 */
export function countingCard(q: HelpQuestion): HelpCard | null {
  const s = sum(q);
  if (!s || (s.op !== '×' && s.op !== '÷')) return null;
  const nums = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (nums.some((n) => !Number.isInteger(n) || n < 1)) return null;
  let t: number;
  let c: number;
  if (s.op === '×') {
    if (s.c === null) {
      const big = Math.max(s.a!, s.b!);
      const small = Math.min(s.a!, s.b!);
      if (small < 2 || small > 12 || big > 12) return null;
      // Count in the table they know (2, 5 or 10) when there is one; two lots is just a double, no count needed.
      const easy = [10, 5, 2].filter((x) => x === s.a || x === s.b);
      const step = easy.length ? easy[0] : big;
      const lots = s.a === step ? s.b! : s.a!;
      if (lots < 3) return null;
      return card('skip-count', `Count in ${step}s`, `Count in ${step}s, ${lots} times.`, `${countBy(0, step, step * Math.min(lots - 1, 3))}, …`, `Keep going: ${lots} lots of ${step} is ?`);
    }
    t = s.a ?? s.b!;
    c = s.c;
  } else {
    if (s.a === null) return null;
    t = s.b ?? s.c!;
    c = s.a;
  }
  if (t < 2 || t > 12 || c % t !== 0 || c / t > 12 || c / t < 2) return null;
  const five = 5 * t;
  const fromFive = c >= five + 2 * t;
  // Show the start only, never the whole list or the lot that lands on the answer.
  const lots = c / t;
  return card('skip-count', `Count in ${t}s`,
    fromFive
      ? `Start at 5 × ${t} = ${five}. Count on in ${t}s: ${countBy(five, t, five + t * Math.min(lots - 6, 2))}, ... Keep going until you land on ${c}.`
      : `Count in ${t}s: ${countBy(0, t, t * Math.min(lots - 1, 3))}, ... Keep going until you land on ${c}.`,
    fromFive ? `5 and how many more ${t}s? ?` : `How many ${t}s did you say? ?`);
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
    return t <= 12 && s.c <= 144 ? missingFactor(t, s.c, ctx) : null;
  }
  if (s.op === '÷') {
    // a ÷ b = ?  (b × ? = a)   a ÷ ? = c  (c × ? = a)   ? ÷ b = c  (b × c = ?)
    if (s.a === null) return s.b! <= 12 && s.c! <= 12 ? card('tables', 'Times it back', `Something shared by ${s.b} gives ${s.c}.`, `So it is ${s.c} × ${s.b}.`, ...times(s.c!, s.b!, ctx).steps.slice(-1)) : null;
    const by = s.b ?? s.c!;
    if (by === 0 || by > 12 || s.a > 144 || s.a % by !== 0) return null;
    // Edge cases first: nothing to share, n ÷ n, and n ÷ 1 (shared or grouped, not a route from a bigger fact).
    if (s.a === 0) return card('tables', 'Nothing to share', '0 things shared into equal groups.', 'How many things does each group get? ?');
    if (s.a === by && s.b !== null) return card('tables', 'Share it out', `${s.a} things are shared into ${s.a} equal groups.`, 'Every group gets the same, and none are left over.', 'How many things are in each group? ?');
    if (s.a === by) return card('tables', 'One group', `${s.a} things are shared into some equal groups.`, `Each group gets ${s.a}.`, 'How many groups are there? ?');
    if (by === 1) return s.b !== null
      ? card('tables', 'Share it out', `${s.a} things are shared into 1 group.`, 'How many things are in that group? ?')
      : card('tables', 'Share it out', `${s.a} things are shared out so every group gets 1.`, 'How many groups are there? ?');
    if (by === 2 && s.c === null && s.a <= 40) return card('halves', 'Dividing by 2 is halving', ...halfSteps(s.a));
    const fact = missingFactor(by, s.a, ctx);
    if (by === 10) return fact;
    const made = card('tables', fact.title, `Think of the times fact: ${by} × ? = ${s.a}.`, ...fact.steps.filter((step) => !step.startsWith('Which number')));
    return fact.also ? { ...made, also: fact.also } : made;
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
  // The pupil finds the jump: no size in the title or the steps.
  const known = at > 0 ? vals[at - 1]! : vals[at + 1]!;
  const fromBefore = at > 0;
  const next: number[] = [];
  for (let i = 0; i + 1 < vals.length; i++) if (vals[i] !== null && vals[i + 1] !== null) next.push(i);
  const [i0, i1] = [next[0], next[0] + 1];
  const far = up ? 'up' : 'down';
  const first = `Look at ${show(vals[i0]!)} and ${show(vals[i1]!)} side by side. How far ${far} is it?`;
  const second = next.length > 1 ? `Check ${show(vals[next[1]]!)} and ${show(vals[next[1] + 1]!)}. Is it the same jump?` : null;
  return card('pattern', 'Find the jump', first, ...(second ? [second] : []),
    fromBefore
      ? `${show(known)} ${up ? '+' : '−'} that jump = ?`
      : `The jump before ${show(known)}: ${show(known)} ${up ? '−' : '+'} that jump = ?`);
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
