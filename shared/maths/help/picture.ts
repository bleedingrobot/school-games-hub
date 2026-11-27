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
import { parseLin } from './algebra';
import { ringCard } from './measure';
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

function array(q: HelpQuestion, p: Extract<Picture, { kind: 'array' }>): HelpCard | null {
  const s = sum(q);
  if (q.parts[0] === 'Half' && p.groups) {
    // "Half of 6 = ?": 2 equal rows. Kept as an array-divide card so it still goes first.
    return card('array-divide', 'Use the array', `The ${p.rows * p.cols} dots are in 2 equal rows.`, 'Each row is one equal group.', 'How many dots in each row? ?');
  }
  if (s && s.op === '÷' && s.a !== null) {
    // "16 ÷ 4 = ?": 4 equal rows, count one row; "9 ÷ 9 = ?": rows of 9, count the rows. Not counting in lots, so it goes first.
    const k = (s.b ?? s.c)!;
    if (p.rows === k) {
      if (k === 1 && s.b === null) {
        // "12 ÷ ? = 1": one dot in each group, so count the groups (not "1 row").
        return card('array-divide', 'Use the array', `The ${s.a} dots are in a row.`, 'Each group gets 1 dot.', 'How many groups can you make? ?');
      }
      if (k === 1) {
        const intro = s.b === 1 ? `Share the ${s.a} dots into 1 group: they all go in 1 row.` : `All ${s.a} dots make just 1 group: 1 row.`;
        return card('array-divide', 'Use the array', intro, 'How many dots are in the row? ?');
      }
      return card('array-divide', 'Use the array', `The ${s.a} dots are in ${k} equal rows.`, 'Each row is one equal group.', 'How many dots in each row? ?');
    }
    return card('array-divide', 'Use the array', `The ${s.a} dots are in rows of ${k}.`, `Each row is one group of ${k}.`, 'How many rows? ?');
  }
  if (q.parts[1] === '÷' && q.parts[5] === 'r') {
    // "29 ÷ 8 = ? r 5": rows of 8, the short last row is the left-over.
    const a = num(q.parts[0]);
    return card('array-divide', 'Count the full rows', `The ${a === null ? '' : `${show(a)} `}dots are in rows of ${p.cols}.`,
      p.extra ? 'The short last row is the left-over.' : 'No dots are left over.', `How many full rows of ${p.cols}? ?`);
  }
  if (p.groups) return null; // Remainders: the topic card ("whole lots, then what is left") is the picture already.
  if (p.rows === 1) return card('array', 'Count the dots', `There is 1 row of ${p.cols} dot${p.cols === 1 ? '' : 's'}.`, 'Count them: ?');
  return card('array', 'Count the rows of dots', `There are ${p.rows} rows of ${p.cols} dot${p.cols === 1 ? '' : 's'}.`,
    `Count in ${p.cols}s, one row at a time: ${counting(p.cols, p.rows - 1)}, …`, `Keep going to the last row. How many dots? ?`);
}

function dotRows(_q: HelpQuestion, p: Extract<Picture, { kind: 'dot-rows' }>): HelpCard | null {
  if (p.rows.length === 2) {
    const n = p.rows[0];
    if (n === 10) return card('dots', 'Use the tens', 'Each row is 10 dots: two 5s.', 'Two rows of 10 is 2 tens.', '2 tens make ?');
    if (n > 5) {
      return card('dots', 'Use the fives in each row', `Each row is 5 and ${n - 5} more.`, `The two 5s make 10. The two ${n - 5}s make ${2 * (n - 5)}.`, `10 + ${2 * (n - 5)} = ?`);
    }
    return card('dots', 'Count both rows', `Two rows of ${n} dot${n === 1 ? '' : 's'}.`, `The top row is ${n}. Keep counting along the bottom row.`, `How many dots? ?`);
  }
  return null;
}

const counters = (n: number) => (n === 1 ? '1 counter is' : `${n} counters are`);

function frames(q: HelpQuestion, p: Extract<Picture, { kind: 'frames' }>): HelpCard | null {
  const s = sum(q);
  if (!s) return null;
  const size = p.size;
  if (s.op === '+' && s.c === null && s.a !== null && s.b !== null) {
    const [a, b] = [s.a, s.b];
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    if (small === 0) return null;
    if (a + b <= size) return card('frames', 'Count the counters', `${a} counter${a === 1 ? '' : 's'}, then ${b} more.`, `Start at ${big} and count on the ${small} other counters.`, 'How many counters? ?');
    if (big === 10) return card('frames', 'A full ten-frame', 'One frame is full: that is 10.', `The other frame has ${small}.`, `10 and ${small} make ?`);
    const fill = 10 - big;
    return card('frames', 'Fill the ten-frame first', `Move ${fill} of the ${small} counters to fill the frame with ${big}.`, `Now one frame is full (10) and ${small - fill} are left.`, `10 + ${small - fill} = ?`);
  }
  if (s.op === '+' && s.c !== null) {
    const known = s.a ?? s.b!;
    if (s.c > 10 && known < 10) {
      return card('frames', 'Fill the frame, then count on', `${counters(known)} in the first frame.`,
        `Fill the first frame: ${known} and how many more make 10?`, `Then count on to ${s.c}. Add the two jumps: ?`);
    }
    if (s.c > 10 && known === 10) {
      return card('frames', 'Fill the second frame', 'One frame is full: 10 counters.', `Fill the second frame until the total is ${s.c}.`, 'How many counters do you add? ?');
    }
    return card('frames', 'Count the empty spaces', `${counters(known)} in.`, `Count the empty spaces up to ${s.c}.`,
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
  if (/likely|chance word|number fits/i.test(prompt)) return null;
  const count = /^Count (back|on)\./i.exec(prompt);
  if (count) {
    // "Count back. 5, 0, −5, ?": a tick for every jump, only the shown numbers labelled.
    const shown = parts.slice(0, -1).map((t) => t.replace(/,$/, ''));
    const back = count[1].toLowerCase() === 'back';
    return card('line', 'Use the line', `${shown.join(', ')} are on the line. Each tick is one jump.`,
      `Count ${back ? 'back' : 'on'}: go one more tick to the ${back ? 'left' : 'right'} of ${shown[shown.length - 1]}.`, 'Which number is on that tick? ?');
  }
  const which = /^Which is the (\w+)\?/.exec(prompt);
  if (which) {
    const small = /small|least|low/i.test(which[1]);
    const list = prompt.slice(which[0].length).trim().split(', ').filter(Boolean);
    const vals = list.map(num);
    const both = vals.some((v) => v !== null && v < 0) && vals.some((v) => v !== null && v > 0);
    const names = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : 'each number';
    return card('line', 'Put them on the line', `Find ${names} on the line.`,
      ...(both ? ['Any number below 0 is smaller than any number above 0.'] : []),
      `Further ${small ? 'left' : 'right'} is ${small ? 'smaller' : 'bigger'}. Which one is furthest ${small ? 'left' : 'right'}? ?`);
  }
  const mark = p.marks?.[0];
  if (parts[0] === 'Round' && mark) {
    const mid = (p.from + p.to) / 2;
    const between = `${show(mark.at)} is between ${show(p.from)} and ${show(p.to)}.`;
    if (Math.abs(mark.at - mid) < 1e-9) {
      return card('line', 'Find it on the line', between, 'It sits exactly on the middle mark, so it is not nearer to either end.',
        'Exactly halfway: do you round up or down? Pick that end: ?');
    }
    return card('line', 'Find it on the line', between, `The middle mark is ${show(mid)}.`, `Which end is ${show(mark.at)} nearer? ?`);
  }
  if (parts.length === 3 && parts[1] === '=' && mark) {
    const cut = `The line from ${show(p.from)} to ${show(p.to)} is cut into 10 tenths.`;
    if (p.from > 0) {
      // "2.1 = ?/10": the wholes are tenths too.
      return card('line', 'Count the tenths on the line', cut, `${show(p.from)} whole${p.from === 1 ? ' is' : 's are'} already ${show(p.from)} × 10 = ${show(p.from * 10)} tenths.`,
        `Count the jumps from ${show(p.from)} to the mark, then add them to ${show(p.from * 10)}: ?`);
    }
    const last = frac(parts[0]) ? 'Write that many tenths as a decimal: ?' : parts[2] === '?/10' ? 'How many tenths is that? ?/10' : 'Write that many tenths as a fraction: ?';
    return card('line', 'Count the tenths on the line', cut, `Count the jumps from ${show(p.from)} to the mark.`, last);
  }
  const s = sum(q);
  if (!s || !mark) return null;
  const known = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (s.op === '+' && s.c !== null && known.every(isInt) && (known.some((n) => n < 0) || s.c < (s.a ?? s.b!))) {
    // "13 + ? = 0": from the start to the total; going left means adding a number below zero.
    const k = (s.a ?? s.b)!;
    const left = s.c < k;
    const pick = (q.choiceLabels ?? []).length > 0;
    const far = `How far is it from ${show(k)} to ${show(s.c)}?`;
    return card('line', 'Jump along the line', `Start at ${show(k)} on the line and find ${show(s.c)}.`,
      left ? `${show(s.c)} is to the left, so the number you add is below 0.` : `${show(s.c)} is to the right, so the number you add is above 0.`,
      left ? (pick ? `${far} Then pick the choice with that size and a minus sign.` : `${far} Write it with a minus sign: ?`) : `${far} ?`);
  }
  if (known.some((n) => n < 0) || (s.op === '−' && s.c === null && s.a !== null && s.b !== null && isInt(s.a) && isInt(s.b) && s.a < s.b)) {
    if (s.c !== null || s.a === null || s.b === null) return null;
    const right = (s.op === '+') === (s.b > 0);
    const how = s.op === '+' ? (s.b > 0 ? 'Adding moves right.' : 'Adding a negative moves left.') : s.b > 0 ? 'Taking away moves left.' : 'Taking away a negative moves right.';
    return card('line', 'Jump along the line', `Start at ${show(s.a)} on the line.`, `${how} Jump ${show(Math.abs(s.b))} to the ${right ? 'right' : 'left'}.`,
      `${show(s.a)} ${s.op} ${s.b < 0 ? `(${show(s.b)})` : show(s.b)} = ?`);
  }
  const tenthsIn = (n: number) => Math.round((n - Math.floor(n)) * 10);
  const tenthWord = (t: number) => `${t} tenth${t === 1 ? '' : 's'}`;
  if (s.op === '+' && s.c !== null) {
    const k = s.a ?? s.b!;
    const next = Math.ceil(k);
    const t = tenthsIn(k);
    if (next >= s.c && isInt(k * 10)) {
      // "1.1 + ? = 2": fill up 10 tenths (a bond to 10), then write it as a decimal.
      const whole = Math.floor(k);
      return card('line', 'Make 10 tenths', `${show(k)} is marked on the line. Each little jump is 1 tenth.`,
        `${show(k)} is ${whole ? `${whole} and ` : ''}${tenthWord(t)}. To reach ${show(s.c)} you fill up 10 tenths: ${tenthWord(t)} + ? tenths = 10 tenths.`,
        'Write that many tenths as a decimal: ?');
    }
    if (next >= s.c) return card('line', 'Jump along the line', `${show(k)} is marked on the line.`, `Count the tenths from ${show(k)} up to ${show(s.c)}.`, 'How many tenths is that? Write it as a decimal: ?');
    return card('line', 'Jump to the whole number, then on', `${show(k)} is marked on the line.`,
      `Jump to the next whole number: ${show(k)} to ${show(next)} is ${show(next - k)}.`, `Then jump on from ${show(next)} to ${show(s.c)}: ${show(s.c)} − ${show(next)} = ?`,
      `Add the two jumps: ${show(next - k)} + your answer to step 3 = ?`);
  }
  if (s.op === '−' && s.a !== null && s.b !== null) {
    if (p.marks && p.marks.length === 2) {
      // "1.1 − 0.5": count up from the smaller number, in tenths.
      const mid = Math.ceil(s.b);
      return card('line', 'Count up along the line', `${show(s.b)} and ${show(s.a)} are marked. Each little jump is 1 tenth.`,
        `Count the tenths from ${show(s.b)} up to ${show(mid)}, then on to ${show(s.a)}.`, 'How many tenths in all? Write that many tenths as a decimal: ?');
    }
    if (isInt(s.a) && s.b > 0 && s.b < 1 && isInt(s.b * 10)) {
      // "9 − 0.6": the line is the last whole, 8 to 9, in tenths.
      return card('line', 'Jump back along the line', `The line from ${show(p.from)} to ${show(p.to)} is cut into 10 tenths.`,
        `Start at ${show(s.a)}, the right-hand end.`, `Jump back ${tenthWord(tenthsIn(s.b))}. Where do you land? ?`);
    }
    const w = Math.floor(s.b);
    const bit = Math.round((s.b - w) * 1e6) / 1e6;
    if (mark && isInt(s.a) && isInt(bit * 10) && Math.abs(p.to - p.from - 1) < 1e-9 && p.step === 0.1) {
      if (Math.abs(mark.at - s.b) < 1e-9) {
        // "10 − 9.9": the answer is the gap between 9.9 and 10.
        return card('line', `How far to ${show(s.a)}?`, `${show(s.b)} is marked on the line. ${show(s.a)} is the right-hand end.`,
          `The answer is the gap between ${show(s.b)} and ${show(s.a)}.`, `Count the tenths from ${show(s.b)} up to ${show(s.a)}, then write that many tenths as a decimal: ?`);
      }
      if (w > 0 && Math.abs(mark.at - p.to) < 1e-9) {
        // "10 − 5.2": whole part first, then the tenths on the zoomed line.
        return card('line', 'Jump back along the line', `Start at ${show(s.a)}.`, `Jump back the whole part first: ${show(s.a)} − ${w} = ${show(s.a - w)}.`,
          `The line shows ${show(p.from)} to ${show(p.to)} in tenths. Start at ${show(p.to)}, the right-hand end, and jump back ${tenthWord(tenthsIn(bit))}: ${show(p.to)} − ${show(bit)} = ?`);
      }
    }
    const steps = [`Start at ${show(s.a)} on the line.`];
    if (w > 0) steps.push(`Jump back the whole part first: ${show(s.a)} − ${w} = ${show(s.a - w)}.`);
    steps.push(isInt(bit * 10) ? `Then jump back ${tenthWord(tenthsIn(bit))} from ${show(s.a - w)}. Where do you land? ?` : `Then jump back ${show(bit)}: ${show(s.a - w)} − ${show(bit)} = ?`);
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
  const deg = (n: number) => `${show(n)} degree${n === 1 ? '' : 's'}`;
  const steps = [`Find ${show(p.start)}° on the thermometer.`];
  if ((p.start < 0 && end > 0) || (p.start > 0 && end < 0)) {
    // Up to 0° first, then the rest: the pupil works out the rest.
    const to0 = Math.abs(p.start);
    steps.push(`Going ${up ? 'up' : 'down'} to 0° is ${deg(to0)}.`,
      `You go ${up ? 'up' : 'down'} ${show(b)}° in all, so ${show(b)} − ${show(to0)} = ? more degrees ${up ? 'above' : 'below'} 0°.`);
  } else if (p.to - p.from <= 30) {
    // The thermometer has a small mark for every 1° up to 30° (QuestionPicture Thermometer).
    steps.push(`Each small mark is 1°. Go ${up ? 'up' : 'down'} ${show(b)} mark${b === 1 ? '' : 's'}.`);
  } else steps.push(`Go ${up ? 'up' : 'down'} ${deg(b)}.`);
  steps.push('Where do you stop? ?°');
  return card('thermometer', 'Use the thermometer', ...steps);
}

function hundred(q: HelpQuestion, p: Extract<Picture, { kind: 'hundred' }>): HelpCard | null {
  const parts = q.parts;
  const n = Math.round(p.shaded);
  const squares = (k: number) => `${k} square${k === 1 ? ' is' : 's are'}`;
  // The square is shaded row by row from the top (QuestionPicture Hundred), so read it in rows of 10.
  if (parts.length === 3 && parts[1] === '=') {
    const rows = Math.floor(n / 10);
    const ones = n % 10;
    const read = rows ? `${rows} full row${rows === 1 ? '' : 's'} of 10 and ${ones ? `${ones} single square${ones === 1 ? '' : 's'}` : 'no single squares'}` : `no full rows, just ${ones} single square${ones === 1 ? '' : 's'}`;
    const labels = q.choiceLabels ?? [];
    if (labels.length && labels.every((l) => l.endsWith('%'))) {
      return card('hundred', 'Read the hundred square', 'Each small square is 1 out of 100.',
        'Count the shaded squares: the full rows of 10 first, then the single squares.', 'Percent means out of 100. How many out of 100 are shaded? ?%');
    }
    if (labels.length && labels.every((l) => l.includes('/'))) {
      // "75% = ?", "0.75 = ?" with fraction choices: equal parts of the square, counted.
      const g = gcd(n, 100);
      const each = g % 10 === 0 ? ` (${g / 10} row${g === 10 ? '' : 's'} each)` : '';
      return card('hundred', 'Read the hundred square', `${squares(n)} shaded out of 100: that is ${n}/100.`,
        p.quarters ? `The thick lines cut the square into equal parts of ${g} squares.` : `Cut the square into equal groups of ${g} squares${each}.`,
        `How many groups of ${g} are shaded, and how many in all? ?/?`);
    }
    if (/decimal/i.test(q.prompt ?? '')) {
      const f = frac(parts[0]);
      if (!f) {
        return card('hundred', 'Read the hundred square', 'Each small square is one hundredth. Each row of 10 is one tenth.',
          'Count the shaded rows of 10, then the single squares.', 'Rows go in the tenths place, single squares in the hundredths place: 0.??');
      }
      return card('hundred', 'Read the hundred square',
        'Bottom number (denominator) 100: each square is 1 hundredth. Each row of 10 is 1 tenth.',
        `Top number (numerator) ${n}: ${read} ${n === 1 ? 'is' : 'are'} shaded.`,
        'Write the full rows (tenths) and the single squares (hundredths) as a decimal: ?');
    }
    return card('hundred', 'Read the hundred square', 'Each small square is one hundredth. Each row of 10 is one tenth.',
      'Count the shaded squares: full rows of 10 first, then the single squares.', 'How many hundredths are shaded? ?');
  }
  const s = sum(q);
  if (!s) return null;
  if (s.c === 1 || s.a === 1) {
    return card('hundred', 'What is left of 100', `${squares(n)} shaded out of 100. Each square is 0.01.`,
      s.a === 1 ? `1 whole is 100 squares, so the white squares are 100 − ${n} = ?` : `The white squares are what is left of the 100: 100 − ${n} = ?`,
      'Write that many hundredths as a decimal: ?');
  }
  return card('hundred', 'Count the empty squares', `${squares(n)} shaded out of 100.`,
    'Count the empty squares: the empty rows of 10 first, then the single squares.', 'How many squares are empty? ?');
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
    const intro = `The bar is ${show(N)}, cut into ${bar.parts} equal parts.`;
    // Always end on how many parts the answer is: the top number (James, 26 Nov 2026). The share is left for the pupil.
    const howMany = f ? `The top number is ${bar.shaded}` : `${name} is ${bar.shaded} of the ${bar.parts} parts`;
    if (bar.shaded === 1) return card('bars', 'Use the bar', intro, `One part is ${show(N)} ÷ ${bar.parts}.`, `${howMany}: take just 1 part. ${show(N)} ÷ ${bar.parts} = ?`);
    return card('bars', 'Use the bar', intro, `One part is ${show(N)} ÷ ${bar.parts} = ?`,
      `${howMany}: take ${bar.shaded} of those parts.`, `${bar.shaded} × (one part) = ?`);
  }
  // Ratio sharing.
  const share = /^Share (\d+) in the ratio (\d+) : (\d+)/.exec(prompt);
  if (share) {
    const total = Number(share[1]);
    const n = bar.parts;
    const which = /^(bigger|smaller)/i.exec(parts[0] ?? '');
    const intro = `The bar is ${total}, cut into ${n} equal boxes: ${share[2]} for the first share and ${share[3]} for the second.`;
    if (!which) return card('bars', 'Use the bar', intro, `One box is ${total} ÷ ${n} = ?`, 'Count the boxes for the share you want, and times by one box: ?');
    return card('bars', 'Use the bar', intro, `The ${which[1].toLowerCase()} share is the ${bar.shaded} shaded boxes. One box is ${total} ÷ ${n} = ?`,
      `${bar.shaded} boxes: ${bar.shaded} × (one box) = ?`);
  }
  if (/ to \d+ /.test(prompt)) return null;
  // "1 = ?/5": the whole bar, one part shaded.
  if (parts.length === 3 && parts[0] === '1' && parts[1] === '=') {
    return card('bars', 'Use the bar', `The bar is 1 whole. One part is shaded: it is 1/${bar.parts}.`, 'Count all the parts in the whole bar.',
      `How many 1/${bar.parts} parts fill the whole bar? ?`);
  }
  // "? + 3/5 = 1", "1 − 1/4 = ?"
  if (parts.length === 5 && (parts[4] === '1' || (parts[0] === '1' && parts[1] === '−'))) {
    return card('bars', 'Use the bar', `The bar is cut into ${bar.parts} parts. ${bar.shaded === 1 ? '1 is' : `${bar.shaded} are`} shaded.`, `One whole is all ${bar.parts} parts.`, `How many parts are not shaded? ?/${bar.parts}`);
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
  if (right === '?' && p.bars.length === 2 && p.bars[1].parts === 10 && p.bars[1].shaded === 0) {
    // "4/5 = ?" as a decimal: the tenths bar under the fraction bar.
    const k = 10 / g.d;
    return card('bars', 'Use the bars', `The top bar is cut into ${g.d} parts, with ${g.n} shaded.`,
      `The bottom bar is cut into 10 parts: each top part is ${k} bottom parts.`, `Shade the same amount of the bottom bar: ${g.n} × ${k} = ? tenths.`,
      'Write that many tenths as a decimal: ?');
  }
  const over = /^\?\/(\d+)$/.exec(right);
  if (over && p.bars[1]) {
    const m = Number(over[1]);
    const intro = `The top bar is cut into ${g.d} parts, with ${g.n} shaded.`;
    if (m < g.d && isInt(g.d / m)) {
      // "12/16 = ?/4": join the top parts into groups, one group for each bottom part (whole numbers, no decimals).
      return card('bars', 'Use the bars', intro, `The bottom bar is cut into ${m}. Join the top parts into groups so the ${g.d} parts make ${m} groups. How many parts in each group?`,
        `Put the ${g.n} shaded parts into groups that size. How many groups? ${g.n} ÷ (parts in a group) = ?`);
    }
    return card('bars', 'Use the bars', intro, `The bottom bar is cut into ${m}. How many bottom parts is each top part?`, `${g.n} × (that number) = ?`);
  }
  const top = /^(\d+)\/\?$/.exec(right);
  if (top && Number(top[1]) < g.n && isInt(g.n / Number(top[1]))) {
    // "2/4 = 1/?": the shaded parts make fewer, bigger groups.
    const t = Number(top[1]);
    if (p.bars[1]?.fill) {
      // The 25/30 bar in groups, and the 5/? bar under it with its 5 parts as long as the 25.
      return card('bars', 'Use the bars', `The top bar is cut into ${g.d} parts, with ${g.n} shaded.`,
        `The bottom bar shades the same amount with just ${t} part${t === 1 ? '' : 's'}, so the ${g.n} parts make ${t === 1 ? '1 group' : `${t} equal groups`}. How many parts in ${t === 1 ? 'that' : 'each'} group?`,
        `How many groups that size make all ${g.d} parts? ${g.d} ÷ (parts in a group) = ?`);
    }
    return card('bars', 'Use the bar', `The bar is cut into ${g.d} parts, with ${g.n} shaded.`,
      `We want the ${g.n} shaded parts to make ${t} equal group${t === 1 ? '' : 's'}. How many parts go in each group?`,
      `How many groups that size make all ${g.d} parts? ${g.d} ÷ (parts in a group) = ?`);
  }
  if (top && isInt(Number(top[1]) / g.n)) {
    const k = Number(top[1]) / g.n;
    return card('bars', 'Use the bar', `The bar is cut into ${g.d} parts, with ${g.n} shaded.`,
      `To make ${top[1]} shaded parts, cut every part into ${k}.`, `How many parts now? ${g.d} × ${k} = ?`);
  }
  if (parts[0] === 'Simplify') {
    return card('bars', 'Use the bar', `The bar is cut into ${g.d} parts, with ${g.n} shaded.`,
      `Join the parts into the biggest equal groups that fit the ${g.n} shaded parts and all ${g.d} parts exactly. How many parts in a group?`,
      'Count the groups: shaded groups over all the groups = ?/?');
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
      `${w} full circle${w > 1 ? 's' : ''}: ${w} × ${p.parts} = ${w * p.parts} parts.`, `Add the ${m[2]} part${m[2] === '1' ? '' : 's'} of the last circle: ${w * p.parts} + ${m[2]} = ?`);
  }
  if (p.packed === false) {
    // Loose slices: the pupil makes the full circles.
    const pick = (q.choiceLabels ?? []).length > 0;
    return card('wholes', 'Make full circles', `Each circle holds ${p.parts} parts.`, `The picture shows ${p.shaded} parts.`,
      ...(pick ? [`The parts left over after the full circles go on top of ${p.parts}.`] : []),
      `How many full circles of ${p.parts} can you make? ${p.shaded} ÷ ${p.parts} = ?`);
  }
  return card('wholes', 'Fill the circles', `Each circle uses ${p.parts} parts.`, `How many full circles do ${p.shaded} parts fill? ${p.shaded} ÷ ${p.parts}.`,
    'Write the number of full circles, then the parts left over in the last circle, as a mixed number: ?');
}

function place(q: HelpQuestion): HelpCard | null {
  const parts = q.parts;
  if (parts[0] === 'In') {
    const digit = parts[3];
    return card('place', 'Read the chart', `Find the ${digit} in the chart.`, 'Read the heading above it.', `So the ${digit} is worth ?`);
  }
  if (parts[1] === '×' && parts.includes('?') && parts[3] === '=') {
    // "9.4 × ? = 940": slide the digits left, count the columns.
    const known = parts[0] === '?' ? parts[2] : parts[0];
    const lead = /[1-9]/.exec(known)?.[0] ?? '';
    return card('place', 'Slide the digits along the chart', `Each digit of ${known} sits in its column.`,
      `Slide the digits left until the ${lead} is where it is in ${parts[4]}.`,
      `How many columns did the ${lead} slide? Then × 10, × 100 or × 1000: ?`);
  }
  if ((parts[1] === '×' || parts[1] === '÷') && parts[4] === '?') {
    // "1.1 × 10 = ?": the digits slide along the chart; the empty columns are where they go.
    const k = num(parts[2]);
    if (k === null) return null;
    const shift = Math.round(Math.log10(k));
    const times = parts[1] === '×';
    return card('place', 'Slide the digits along the chart', `Each digit of ${parts[0]} sits in its column.`,
      `${parts[1]} ${parts[2]}: move every digit ${shift} column${shift === 1 ? '' : 's'} to the ${times ? 'left, to bigger places' : 'right, to smaller places'}.`,
      'Read the number in its new columns (put 0 in any gap up to the 1s): ?');
  }
  return card('place', 'Read the chart', `Each digit of ${parts[0]} sits under its heading.`,
    'Cross off the parts already written.', 'Which column is left? What is its digit worth? ?');
}

function balance(p: Extract<Picture, { kind: 'balance' }>): HelpCard {
  const intro = `The two pans balance: ${p.left} weighs the same as ${p.right}.`;
  const r = num(p.right);
  const div = /^([a-z]) ÷ (\d+)$/.exec(p.left);
  const e = parseLin(p.left);
  const steps = (...rest: string[]) => card('balance', 'Keep it balanced', intro, ...rest);
  if (r !== null && div) {
    return steps(`${div[1]} is shared into ${div[2]}. Make each pan ${div[2]} times bigger.`, `${show(r)} × ${div[2]} = ?`);
  }
  if (r !== null && e) {
    const v = e.letter;
    const k = show(e.k);
    // Said as squares when the picture draws them.
    const drawn = !!(p.leftBlocks?.units || p.leftBlocks?.gone);
    const ks = drawn ? `${k} square${e.k === 1 ? '' : 's'}` : k;
    if (e.coef === 1 && e.op === '+') return steps(`To get ${v} on its own, take ${ks} off the left pan. Take ${ks} off the other pan too.`, `${show(r)} − ${k} = ?`);
    if (e.coef === 1 && e.op === '−') return steps(`${v} has ${k} taken away (the dashed ${e.k === 1 ? 'square' : 'squares'}). Put ${ks} back on the left pan, and ${ks} on the other pan too.`, `${show(r)} + ${k} = ?`);
    if (e.coef > 1 && !e.op) return steps(`${e.coef}${v} is ${e.coef} equal boxes of ${v}. Share each pan into ${e.coef} equal parts.`, `One part of the ${show(r)} pan: ${show(r)} ÷ ${e.coef} = ?`);
    if (e.coef > 1 && e.op) {
      const back = e.op === '+' ? `Take ${ks} off both pans: ${show(r)} − ${k} = ?` : `Put ${ks} back on both pans: ${show(r)} + ${k} = ?`;
      return steps(back, `Now share the ${e.coef}${v} pan into ${e.coef} equal parts: that number ÷ ${e.coef} = ?`);
    }
  }
  return steps('Whatever you take off or share out on one pan, do the same to the other pan.', 'Keep going until the letter is on its own. What is it? ?');
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
  const places = Math.round(Math.log10(factor));
  // "50 g ÷ 1000": fewer digits than places to move, so the empty places are 0s.
  const amount = /^\d+$/.exec((q.parts[0] ?? '').split(' ')[0] ?? '')?.[0];
  const short = !down && amount && amount.length < places ? ` ${amount} has only ${amount.length} digit${amount.length === 1 ? '' : 's'}, so fill the empty places with 0s.` : '';
  const main = card('ladder', 'Use the unit ladder', `Going down the ladder is ×, going up is ÷. ${from} to ${to} is ${down ? '×' : '÷'} ${factor}.`,
    `${down ? '×' : '÷'} ${factor} moves each digit ${places} place${places === 1 ? '' : 's'} to the ${down ? 'left' : 'right'}.${short}`, `${q.parts[0]} ${down ? '×' : '÷'} ${factor} = ?`);
  // A half of the big unit: halve the whole factor.
  if (down && /^0?\.5 /.test(q.parts[0] ?? '')) main.also = card('half-whole', 'Half of the whole', '0.5 is a half.', `1 ${from} = ${factor} ${to}.`, `Half of ${factor} = ?`);
  return main;
}

/** The card that walks through the question using its picture, or null. */
export function pictureCard(q: HelpQuestion, picture: Picture | null): HelpCard | null {
  if (!picture) return null;
  switch (picture.kind) {
    case 'split-box': return splitBox(q, picture);
    case 'array': return array(q, picture);
    case 'dot-rows': return dotRows(q, picture);
    case 'frames': return frames(q, picture);
    case 'number-line': return numberLine(q, picture);
    case 'thermometer': return thermometer(q, picture);
    case 'hundred': return hundred(q, picture);
    case 'bars': return bars(q, picture);
    case 'wholes': return wholes(q, picture);
    case 'place': return place(q);
    case 'balance': return balance(picture);
    case 'place-strip': return card('place-strip', 'Move the 1 one place right for each ÷ 10', 'The 1 starts in the ones.',
      `${q.parts[0]} is ÷ 10, ${picture.places} time${picture.places === 1 ? '' : 's'}: move the 1 one place right each time.`, 'Where does the 1 end up? Write the number: ?');
    case 'unit-ladder': return unitLadder(q, picture);
    case 'clock-24': return ringCard(q);
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
  'Count the tenths',
  'Count up to the next whole number',
  'Furthest below zero is smallest',
  'Closest to zero is biggest',
  'Ten and some ones',
  'Count the parts, find one part',
  'Make the bottom 10',
  'Groups of 1',
]);
