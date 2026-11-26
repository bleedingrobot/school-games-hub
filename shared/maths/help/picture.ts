/**
 * Help that matches the question's picture (James, 26 Nov 2026: "give two types of help, the help that matches the image
 * most closely first, followed by other strategies"). The picture (shared/maths/pictures) shows the numbers one way, an
 * area box split into tens and ones, ten-frames, a number line; this card walks through the question using that picture,
 * with the question's own numbers. Like every card, it never gives the answer: the last step ends with "?".
 *
 * Returns null where the topic card already reads the picture (track patterns, clocks, towers, chance) or there is no
 * picture.
 */
import type { Picture } from '../pictures/types';
import { num, show, sum } from './read';
import type { HelpCard, HelpQuestion } from './types';

const card = (kind: string, title: string, ...steps: string[]): HelpCard => ({ kind, title, steps });

function frac(t: string | undefined): { n: number; d: number } | null {
  const m = /^(\d+)\/(\d+)$/.exec(t ?? '');
  return m && Number(m[2]) > 0 ? { n: Number(m[1]), d: Number(m[2]) } : null;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const isInt = (n: number) => Number.isInteger(Math.round(n * 1e6) / 1e6);

/** "3, 6, 9" for the first `count` multiples of `step`. */
function counting(step: number, count: number): string {
  return Array.from({ length: count }, (_, i) => show(step * (i + 1))).join(', ');
}

function splitBox(q: HelpQuestion, p: Extract<Picture, { kind: 'split-box' }>): HelpCard {
  const big = p.tens + p.ones;
  const intro = `Split ${big} into ${p.tens} and ${p.ones}, like the box.`;
  const parts = q.parts;
  if (parts.length === 7 && parts[5] === '+') {
    if (parts[6] === '?') return card('box', 'Use the box: tens and ones', intro, `The big part is ${p.by} × ${p.tens} = ${p.by * p.tens}.`, `The small part is ${p.by} × ${p.ones} = ?`);
    return card('box', 'Use the box: tens and ones', intro, `The small part is ${p.by} × ${p.ones} = ${p.by * p.ones}.`, `The big part is ${p.by} × ${p.tens} = ?`);
  }
  return card('box', 'Use the box: tens and ones', intro,
    `The big part: ${p.by} × ${p.tens} = ${p.by * p.tens}.`,
    `The small part: ${p.by} × ${p.ones} = ${p.by * p.ones}.`,
    `Add the two parts: ${p.by * p.tens} + ${p.by * p.ones} = ?`);
}

function array(p: Extract<Picture, { kind: 'array' }>): HelpCard | null {
  if (p.groups) return null; // Remainders: the topic card ("whole lots, then what is left") is the picture already.
  if (p.rows === 1) return card('array', 'Count the dots', `There is 1 row of ${p.cols} dot${p.cols === 1 ? '' : 's'}.`, 'Count them: ?');
  return card('array', 'Count the rows of dots', `There are ${p.rows} rows of ${p.cols} dot${p.cols === 1 ? '' : 's'}.`,
    `Count in ${p.cols}s, one row at a time: ${counting(p.cols, p.rows - 1)}, …`, `Keep going to the last row. How many dots? ?`);
}

function dotRows(q: HelpQuestion, p: Extract<Picture, { kind: 'dot-rows' }>): HelpCard | null {
  const parts = q.parts;
  // "15 ÷ 2 = ? r 1": all the dots, made into groups.
  if (parts[1] === '÷' && parts[4] === '?' && parts[5] === 'r') {
    const a = num(parts[0]);
    const b = num(parts[2]);
    if (a === null || b === null) return null;
    return card('dots', 'Ring the groups', `Ring groups of ${b} in the ${a} dots.`, 'Count the rings. Leave the dots that are left over.', `How many whole groups of ${b}? ?`);
  }
  if (p.rows.length === 2) {
    const n = p.rows[0];
    if (n > 5) {
      return card('dots', 'Use the fives in each row', `Each row is 5 and ${n - 5} more.`, `The two 5s make 10. The two ${n - 5}s make ${2 * (n - 5)}.`, `10 + ${2 * (n - 5)} = ?`);
    }
    return card('dots', 'Count both rows', `Two rows of ${n} dot${n === 1 ? '' : 's'}.`, `The top row is ${n}. Keep counting along the bottom row.`, `How many dots? ?`);
  }
  const n = p.rows[0];
  if (parts[0] === 'Half') {
    return card('dots', 'Split the row in two', `Share the ${n} dots into 2 equal groups.`, 'Take one dot for each group in turn until none are left.', 'How many in one group? ?');
  }
  const s = sum(q);
  if (!s || s.op !== '÷') return null;
  if (s.b !== null) {
    return card('dots', `Share into ${s.b} groups`, `Share the ${n} dots into ${s.b} equal groups.`, 'Give one dot to each group in turn until they are all used.', 'How many in each group? ?');
  }
  if (s.c !== null) {
    return card('dots', `Make groups of ${s.c}`, `Ring groups of ${s.c} in the ${n} dots.`, 'Keep going until every dot is in a group.', 'How many groups? ?');
  }
  return null;
}

function frames(q: HelpQuestion, p: Extract<Picture, { kind: 'frames' }>): HelpCard | null {
  const s = sum(q);
  if (!s) return null;
  const size = p.size;
  if (s.op === '+' && s.c === null && s.a !== null && s.b !== null) {
    const [a, b] = [s.a, s.b];
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    if (small === 0) return null;
    if (a + b <= size) return card('frames', 'Count the counters', `${a} counters, then ${b} more.`, `Start at ${big} and count on the ${small} other counters.`, 'How many counters? ?');
    if (big === 10) return card('frames', 'A full ten-frame', 'One frame is full: that is 10.', `The other frame has ${small}.`, `10 and ${small} make ?`);
    const fill = 10 - big;
    return card('frames', 'Fill the ten-frame first', `Move ${fill} of the ${small} counters to fill the frame with ${big}.`, `Now one frame is full (10) and ${small - fill} are left.`, `10 + ${small - fill} = ?`);
  }
  if (s.op === '+' && s.c !== null) {
    const known = s.a ?? s.b!;
    return card('frames', 'Count the empty spaces', `${known} counters are in.`,
      s.c <= size ? `Count the empty spaces up to ${s.c}.` : `Fill the frame up to 10, then count on to ${s.c}.`,
      `How many counters do you add to make ${s.c}? ?`);
  }
  if (s.op === '−' && s.a !== null) {
    if (s.b !== null) return card('frames', 'Take them off the frame', `${s.a} counters are in the frame.`, `Take away ${s.b}: cross them off from the end.`, 'How many are left? ?');
    if (s.c !== null) return card('frames', 'Take them off the frame', `${s.a} counters are in the frame.`, `Cross off counters until ${s.c} are left.`, 'How many did you cross off? ?');
  }
  return null;
}

function numberLine(q: HelpQuestion, p: Extract<Picture, { kind: 'number-line' }>): HelpCard | null {
  const parts = q.parts;
  const prompt = q.prompt ?? '';
  if (/likely|chance word|number fits/i.test(prompt) || /^Count (back|on)\./i.test(prompt)) return null;
  const which = /^Which is the (\w+)\?/.exec(prompt);
  if (which) {
    const small = /small|least|low/i.test(which[1]);
    return card('line', 'Put them on the line', 'Find each number on the line.', 'Further left is smaller. Further right is bigger.',
      `Which one is furthest ${small ? 'left' : 'right'}? ?`);
  }
  const mark = p.marks?.[0];
  if (parts[0] === 'Round' && mark) {
    const mid = (p.from + p.to) / 2;
    return card('line', 'Find it on the line', `${show(mark.at)} is between ${show(p.from)} and ${show(p.to)}.`,
      `The middle of the line is ${show(mid)}. Halfway rounds up.`, `Which end is ${show(mark.at)} nearer? ?`);
  }
  if (parts.length === 3 && parts[1] === '=' && mark) {
    return card('line', 'Count the tenths on the line', `The line from ${show(p.from)} to ${show(p.to)} is cut into 10 tenths.`,
      `Count the jumps from ${show(p.from)} to the mark.`, `${parts[0]} = ${parts[2]}`);
  }
  const s = sum(q);
  if (!s || !mark) return null;
  const known = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (known.some((n) => n < 0) || (s.op === '−' && s.c === null && s.a !== null && s.b !== null && isInt(s.a) && isInt(s.b) && s.a < s.b)) {
    if (s.c !== null || s.a === null || s.b === null) return null;
    const right = (s.op === '+') === (s.b > 0);
    const how = s.op === '+' ? (s.b > 0 ? 'Adding moves right.' : 'Adding a negative moves left.') : s.b > 0 ? 'Taking away moves left.' : 'Taking away a negative moves right.';
    return card('line', 'Jump along the line', `Start at ${show(s.a)} on the line.`, `${how} Jump ${show(Math.abs(s.b))} to the ${right ? 'right' : 'left'}.`, 'Where do you land? ?');
  }
  if (s.op === '+' && s.c !== null) {
    const k = s.a ?? s.b!;
    const next = Math.ceil(k);
    if (next >= s.c) return card('line', 'Jump along the line', `${show(k)} is marked on the line.`, `Count the tenths from ${show(k)} up to ${show(s.c)}.`, `${show(k)} + ? = ${show(s.c)}`);
    return card('line', 'Jump to the whole number, then on', `${show(k)} is marked on the line.`,
      `Jump to the next whole number: ${show(k)} to ${show(next)} is ${show(next - k)}.`, `Then jump on to ${show(s.c)}: that is ${show(s.c - next)} more.`,
      `Add the jumps: ${show(next - k)} + ${show(s.c - next)} = ?`);
  }
  if (s.op === '−' && s.a !== null && s.b !== null) {
    const w = Math.floor(s.b);
    const bit = Math.round((s.b - w) * 1e6) / 1e6;
    const steps = [`Start at ${show(s.a)} on the line.`];
    if (w > 0) steps.push(`Jump back the whole part first: ${show(s.a)} − ${w} = ${show(s.a - w)}.`);
    steps.push(`Then jump back ${show(bit)}: ${show(s.a - w)} − ${show(bit)} = ?`);
    return card('line', 'Jump back along the line', ...steps);
  }
  return null;
}

function thermometer(q: HelpQuestion, p: Extract<Picture, { kind: 'thermometer' }>): HelpCard | null {
  const parts = q.parts;
  const b = num(parts[2]?.replace(/°$/, ''));
  if (b === null) return null;
  const up = parts[1] === '+';
  const end = up ? p.start + b : p.start - b;
  const steps = [`Find ${show(p.start)}° on the thermometer.`];
  if ((p.start < 0 && end > 0) || (p.start > 0 && end < 0)) {
    steps.push(`Go ${up ? 'up' : 'down'} to 0° first: that is ${show(Math.abs(p.start))} marks.`, `Then go ${up ? 'up' : 'down'} the other ${show(b - Math.abs(p.start))}.`);
  } else steps.push(`Go ${up ? 'up' : 'down'} ${show(b)} marks.`);
  steps.push('Where do you stop? ?°');
  return card('thermometer', 'Count the marks on the thermometer', ...steps);
}

function hundred(q: HelpQuestion, p: Extract<Picture, { kind: 'hundred' }>): HelpCard | null {
  const parts = q.parts;
  if (parts.length === 3 && parts[1] === '=') {
    return card('hundred', 'Read the hundred square', 'Each small square is one hundredth. Each column of 10 is one tenth.',
      `Count the shaded squares: full columns of 10 first, then the single squares.`, `${parts[0]} = ${parts[2]}`);
  }
  const s = sum(q);
  if (!s) return null;
  const decimal = s.c === 1 || s.a === 1;
  return card('hundred', 'Count the empty squares', `${p.shaded} squares are shaded out of 100.${decimal ? ' Each square is 0.01.' : ''}`,
    'Count the empty squares: the empty columns of 10 first, then the single squares.',
    decimal ? 'How many empty squares? Write that many hundredths as a decimal: ?' : 'How many squares are empty? ?');
}

function bars(q: HelpQuestion, p: Extract<Picture, { kind: 'bars' }>): HelpCard | null {
  const parts = q.parts;
  const bar = p.bars[0];
  const prompt = q.prompt ?? '';
  // "50% of 30", "2/3 of 30", "1/2 of ? = 25"
  const pct = /^(\d+)%$/.exec(parts[0] ?? '');
  const f = frac(parts[0]);
  if ((pct || f) && parts[1] === 'of') {
    const name = parts[0];
    if (parts[2] === '?') {
      const v = num(parts[4]);
      if (v === null) return null;
      const steps = [`The shaded part is ${name} of the bar, and it is ${show(v)}.`];
      if (bar.shaded === 1) steps.push(`All ${bar.parts} parts are the same size.`, `${bar.parts} × ${show(v)} = ?`);
      else {
        const one = v / bar.shaded;
        steps.push(`So one part is ${show(v)} ÷ ${bar.shaded}${isInt(one) ? ` = ${show(one)}` : ''}.`, `The whole bar is ${bar.parts} parts: ${bar.parts} × ${isInt(one) ? show(one) : '(one part)'} = ?`);
      }
      return card('bars', 'Use the bar', ...steps);
    }
    const N = num(parts[2]);
    if (N === null) return null;
    const one = N / bar.parts;
    const intro = `The bar is ${show(N)}, cut into ${bar.parts} equal parts.`;
    // Always end on how many parts the answer is: the top number (James, 26 Nov 2026).
    const howMany = f ? `The top number is ${bar.shaded}` : `${name} is ${bar.shaded} of the ${bar.parts} parts`;
    if (bar.shaded === 1) return card('bars', 'Use the bar', intro, `One part is ${show(N)} ÷ ${bar.parts}.`, `${howMany}, so the answer is just 1 part: ?`);
    return card('bars', 'Use the bar', intro, `One part is ${show(N)} ÷ ${bar.parts}${isInt(one) ? ` = ${show(one)}` : ''}.`,
      `${howMany}, so the answer is ${bar.shaded} parts.`, `${bar.shaded} × ${isInt(one) ? show(one) : '(one part)'} = ?`);
  }
  if (pct && parts[1] === '=') {
    return card('bars', 'Use the bar', `The bar is cut into ${bar.parts} equal parts.`, 'Count the shaded parts, and all the parts.', `${parts[0]} = ?`);
  }
  // Ratio sharing.
  const share = /^Share (\d+) in the ratio (\d+) : (\d+)/.exec(prompt);
  if (share) {
    const total = Number(share[1]);
    const n = bar.parts;
    const one = total / n;
    return card('bars', 'Use the bar', `The bar has ${n} equal boxes: ${share[2]} for the first share and ${share[3]} for the second.`,
      `Each box is ${total} ÷ ${n}${isInt(one) ? ` = ${show(one)}` : ''}.`, 'Count the boxes for the share you want, and times by one box: ?');
  }
  if (/ to \d+ /.test(prompt)) return null;
  // "? + 3/5 = 1", "1 − 1/4 = ?"
  if (parts.length === 5 && (parts[4] === '1' || (parts[0] === '1' && parts[1] === '−'))) {
    return card('bars', 'Use the bar', `The bar is cut into ${bar.parts} parts. ${bar.shaded} are shaded.`, `One whole is all ${bar.parts} parts.`, `How many parts are not shaded? ?/${bar.parts}`);
  }
  // "6/7 − 2/7 = ?", "1/8 + 3/4 = ?"
  if (p.bars.length === 2 && p.bars[0].shade) {
    const [a, b] = p.bars;
    const add = parts[1] === '+';
    if (a.parts === b.parts) {
      return card('bars', 'Use the bars', `Both bars are cut into ${a.parts} parts.`,
        add ? `Put the shaded parts together: ${a.shaded} and ${b.shaded}.` : `Take ${b.shaded} parts away from the ${a.shaded}.`,
        `How many ${a.parts}ths? ?/${a.parts}`);
    }
    const l = (a.parts * b.parts) / gcd(a.parts, b.parts);
    const x = (a.shaded * l) / a.parts;
    const y = (b.shaded * l) / b.parts;
    return card('bars', 'Make the parts the same size', `The bars are cut into ${a.parts} and ${b.parts} parts: different sizes.`,
      `Cut both into ${l} parts: ${[a, b].map((t, i) => (t.parts === l ? `${t.shaded}/${t.parts} stays` : `${t.shaded}/${t.parts} becomes ${i ? y : x}/${l}`)).join(', ')}.`,
      `${add ? 'Add' : 'Take away'} the tops: ${x} ${add ? '+' : '−'} ${y} = ?`);
  }
  // Equivalent fractions.
  const q2 = [...parts];
  if (q2[0] === 'Simplify') q2.shift();
  const g = frac(q2[0]);
  if (!g) return null;
  const right = q2[2] ?? '';
  const over = /^\?\/(\d+)$/.exec(right);
  if (over && p.bars[1]) {
    const m = Number(over[1]);
    return card('bars', 'Use the bars', `The top bar is cut into ${g.d} parts, with ${g.n} shaded.`,
      `The bottom bar is cut into ${m}: each top part is ${m / g.d} bottom parts.`, `${g.n} × ${m / g.d} = ?`);
  }
  const top = /^(\d+)\/\?$/.exec(right);
  if (top && isInt(Number(top[1]) / g.n)) {
    const k = Number(top[1]) / g.n;
    return card('bars', 'Use the bar', `The bar is cut into ${g.d} parts, with ${g.n} shaded.`,
      `To make ${top[1]} shaded parts, cut every part into ${k}.`, `How many parts now? ${g.d} × ${k} = ?`);
  }
  if (parts[0] === 'Simplify') {
    return card('bars', 'Use the bar', `The bar is cut into ${g.d} parts, with ${g.n} shaded.`,
      'Join the parts into bigger equal groups, so the shaded parts fill whole groups.', `What fraction is shaded now? ${g.n}/${g.d} = ?`);
  }
  return null;
}

function wholes(q: HelpQuestion, p: Extract<Picture, { kind: 'wholes' }>): HelpCard | null {
  const parts = q.parts;
  if (parts[1] === '÷') {
    if (p.shaded === 0) return card('wholes', 'Count the parts', `Each circle is one whole, cut into ${p.parts} parts.`, `There are ${p.count} circles.`, `How many parts in all? ${p.count} × ${p.parts} = ?`);
    const g = frac(parts[0]);
    const k = num(parts[2]);
    if (!g || k === null || g.n !== 1) return null;
    return card('wholes', 'Cut the part smaller', `The shaded part is 1/${g.d} of the circle.`, `Cut it into ${k} equal pieces. Cut every part the same way.`,
      `Now the circle has ${g.d} × ${k} pieces, so each piece is 1/?`);
  }
  const m = /^(\d+) (\d+)\/(\d+)$/.exec(parts[0] ?? '');
  if (m) {
    const w = Number(m[1]);
    return card('wholes', 'Count the parts in the circles', `Each circle is one whole, cut into ${p.parts} parts.`,
      `${w} full circle${w > 1 ? 's' : ''}: ${w} × ${p.parts} = ${w * p.parts} parts.`, `Add the ${m[2]} parts of the last circle: ${w * p.parts} + ${m[2]} = ?`);
  }
  return card('wholes', 'Fill the circles', `Each circle uses ${p.parts} parts.`, `How many full circles do ${p.shaded} parts fill? ${p.shaded} ÷ ${p.parts}.`,
    'Count the full circles, then the parts left over: ?');
}

function place(q: HelpQuestion, p: Extract<Picture, { kind: 'place' }>): HelpCard | null {
  const parts = q.parts;
  if (parts[0] === 'In') {
    const digit = parts[3];
    return card('place', 'Read the chart', `Find the ${digit} in the chart.`, 'Read the heading above it.', `So the ${digit} is worth ?`);
  }
  return card('place', 'Read the chart', `Each digit of ${parts[0]} sits under its heading: ${p.headings.join(', ')}.`,
    'Cross off the parts already written.', `Which column is left, and what is its digit worth? ?`);
}

function balance(p: Extract<Picture, { kind: 'balance' }>): HelpCard {
  return card('balance', 'Keep it balanced', `The two sides balance: ${p.left} weighs the same as ${p.right}.`,
    'Whatever you take off or share out on one side, do the same to the other side.', 'Keep going until the letter is on its own. What is it? ?');
}

function unitLadder(q: HelpQuestion, p: Extract<Picture, { kind: 'unit-ladder' }>): HelpCard | null {
  const [from, to] = p.highlight;
  const i = p.units.indexOf(from);
  const j = p.units.indexOf(to);
  if (i < 0 || j < 0 || i === j) return null;
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  const factor = p.links.slice(lo, hi).reduce((acc, l) => acc * Number(l.replace(/\D/g, '')), 1);
  const down = j > i;
  return card('ladder', 'Use the unit ladder', `Find ${from} and ${to} on the ladder.`,
    `Going down the ladder is ×, going up is ÷. ${from} to ${to} is ${down ? '×' : '÷'} ${factor}.`, `${q.parts[0]} ${down ? '×' : '÷'} ${factor} = ?`);
}

/** The card that walks through the question using its picture, or null. */
export function pictureCard(q: HelpQuestion, picture: Picture | null): HelpCard | null {
  if (!picture) return null;
  switch (picture.kind) {
    case 'split-box': return splitBox(q, picture);
    case 'array': return array(picture);
    case 'dot-rows': return dotRows(q, picture);
    case 'frames': return frames(q, picture);
    case 'number-line': return numberLine(q, picture);
    case 'thermometer': return thermometer(q, picture);
    case 'hundred': return hundred(q, picture);
    case 'bars': return bars(q, picture);
    case 'wholes': return wholes(q, picture);
    case 'place': return place(q, picture);
    case 'balance': return balance(picture);
    case 'unit-ladder': return unitLadder(q, picture);
    default: return null;
  }
}

/**
 * Topic cards that already say what the picture card says. With a picture card first, these are left out, so the second
 * card is always another way.
 */
export const SAME_AS_PICTURE = new Set([
  'Split the big number',
  'Make a ten',
  'Count up to the total',
  'Look next door',
  'Count the tenths',
  'Count up to the next whole number',
  'Furthest below zero is smallest',
  'Closest to zero is biggest',
  'Ten and some ones',
]);
