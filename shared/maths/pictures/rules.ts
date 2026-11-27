/**
 * The picture rules (docs/plans/help-me/PLAN.md H8). Each rule reads what the question shows and returns a picture, or
 * null when the question isn't its kind. Most specific first; the first rule that answers wins (index.ts).
 *
 * A picture only ever shows what the question already says. It never fills in the '?', never marks the answer on a line,
 * and never shades the amount being asked for. The counting aids (ten-frames of both addends, an array of a times fact,
 * circles for a mixed number) are the exception James agreed to: the pupil still has to count.
 */
import { num, show, solve, sum } from '../help/read';
import { parseLin } from '../help/algebra';
import type { BalanceSide, Picture, PictureRule } from './types';

// ---------- small readers ----------

function frac(t: string | undefined): { n: number; d: number } | null {
  const m = /^(\d+)\/(\d+)$/.exec(t ?? '');
  return m && Number(m[2]) > 0 ? { n: Number(m[1]), d: Number(m[2]) } : null;
}

/** A whole number as shown ("12", "63 283"); null for anything else. */
function whole(t: string | undefined): number | null {
  const n = num(t);
  return n !== null && Number.isInteger(n) ? n : null;
}

/** How many places after the point a plain number is shown with (0 for a whole number); null if it isn't a plain number. */
function places(t: string | undefined): number | null {
  if (num(t) === null) return null;
  const m = /\.(\d+)$/.exec((t ?? '').trim());
  return m ? m[1].length : 0;
}

function range(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

// ---------- figures the server doesn't send ----------

/** "An angle of 200°": draw it (the "which kind" question with a picture already has its own figure). */
const angleSize: PictureRule = (q) => {
  if (!/kind of angle/i.test(q.prompt ?? '')) return null;
  const m = /^An angle of (\d+)°$/.exec(q.parts[0] ?? '');
  if (!m) return null;
  const degrees = Number(m[1]);
  return degrees >= 1 && degrees <= 359 ? { kind: 'figure', figure: { kind: 'angle', degrees } } : null;
};

/** "You face south. You make a quarter turn clockwise.": the compass with the start arrow (never where the turn ends). */
const compass: PictureRule = (q) => {
  if (!/facing/i.test(q.prompt ?? '')) return null;
  const m = /^(?:You )?face (north|south|east|west)[,.]?$/i.exec(q.parts[0] ?? '');
  return m ? { kind: 'figure', figure: { kind: 'compass', from: m[1].toLowerCase() } } : null;
};

/** "Which point sits on the y-axis?": a grid with all four choices as labelled points. */
const axisGrid: PictureRule = (q) => {
  const labels = q.choiceLabels;
  if (!labels || labels.length < 2 || !/axis/i.test(q.prompt ?? '')) return null;
  const points: { x: number; y: number; label: string }[] = [];
  for (const l of labels) {
    const m = /^\((\d+), (\d+)\)$/.exec(l);
    if (!m) return null;
    points.push({ x: Number(m[1]), y: Number(m[2]), label: l });
  }
  const top = Math.max(...points.flatMap((p) => [p.x, p.y]));
  if (top > 10) return null;
  return { kind: 'figure', figure: { kind: 'grid', size: Math.max(4, top), points } };
};

// ---------- time ----------

function clockTime(t: string | undefined): { hour: number; minute: number; label: string } | null {
  const m = /^(\d{1,2}):(\d{2}) (am|pm)$/i.exec(t ?? '');
  if (!m) return null;
  const hour = Number(m[1]) % 12 || 12;
  return { hour, minute: Number(m[2]), label: t! };
}

/** "7:15 pm to 8:00 pm = ? min": both clock faces (the minutes between are the answer, never drawn). */
const elapsed: PictureRule = (q) => {
  if (q.parts.length < 4 || q.parts[1] !== 'to') return null;
  const start = clockTime(q.parts[0]);
  const end = clockTime(q.parts[2]);
  return start && end ? { kind: 'clocks', start, end } : null;
};

const clock24: PictureRule = (q) => (/same time in (12|24)-hour time/i.test(q.prompt ?? '') ? { kind: 'clock-24' } : null);

// ---------- data and chance ----------

/** "The numbers 15, 16, 2: Range / Mean": a tower for each number. */
const towers: PictureRule = (q) => {
  const m = /^The numbers ((?:\d+, )*\d+)$/.exec(q.prompt ?? '');
  if (!m || !/^(range|mean)$/i.test(q.parts[0] ?? '')) return null;
  const values = m[1].split(', ').map(Number);
  if (values.length < 2 || values.length > 12) return null;
  return /^range$/i.test(q.parts[0]) ? { kind: 'towers', values, mark: 'range' } : { kind: 'towers', values };
};

/** Chance: a 0 to 1 line. The words go on only for "how likely", where they can't give the answer away. */
const chance: PictureRule = (q) => {
  const p = q.prompt ?? '';
  const base = { kind: 'number-line' as const, from: 0, to: 1, step: 0.25, labels: [0, 1] };
  const words = [{ at: 0, label: 'impossible' }, { at: 0.25, label: 'unlikely' }, { at: 0.5, label: 'even chance' }, { at: 0.75, label: 'likely' }, { at: 1, label: 'certain' }];
  if (/^How likely is it/i.test(p)) return { ...base, words };
  // "Likely is a chance of ?": the other words on the line (the one asked about is for the pupil to place).
  if (/^Which number fits/i.test(p)) {
    const asked = (q.parts[0] ?? '').replace(/ is a chance of$/i, '').toLowerCase();
    return { ...base, words: words.filter((w) => w.label !== asked) };
  }
  // "A chance of 1 means ?": the numbers on the line, no words.
  return /^Which chance word fits/i.test(p) ? { ...base, labels: [0, 0.25, 0.5, 0.75, 1] } : null;
};

// ---------- temperature and negative numbers ----------

function degrees(t: string | undefined): number | null {
  return t && t.endsWith('°') ? whole(t.slice(0, -1)) : null;
}

/** "−2° + 7° = ?°": a thermometer with the starting temperature marked. */
const thermometer: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[3] !== '=' || !/^\?°?$/.test(p[4]) || (p[1] !== '+' && p[1] !== '−')) return null;
  const a = degrees(p[0]);
  const b = degrees(p[2]);
  if (a === null || b === null) return null;
  const end = p[1] === '+' ? a + b : a - b;
  const from = Math.floor((Math.min(a, end, 0) - 1) / 5) * 5;
  const to = Math.ceil((Math.max(a, end, 0) + 1) / 5) * 5;
  return to - from <= 60 ? { kind: 'thermometer', from, to, start: a } : null;
};

/** A line through zero with a tick for every whole number (or every 5 when it's long), the 5s labelled when it's wide. */
function zeroLine(lo: number, hi: number, marks: { at: number; label: string }[] = []): Picture | null {
  lo = Math.floor(Math.min(lo, 0)) - 1;
  hi = Math.ceil(Math.max(hi, 0)) + 1;
  const long = hi - lo > 24;
  if (hi - lo > 80) return null;
  if (long) {
    lo = Math.floor(lo / 5) * 5;
    hi = Math.ceil(hi / 5) * 5;
  }
  // More than 12 wide, the numbers 1 apart print on top of each other: label only the 5s (0 is one of them).
  // Past 40 wide, even the 5s crowd (−25 to 25): label every 10.
  const labels = hi - lo > 40 ? range(lo, hi, 1).filter((v) => v % 10 === 0) : hi - lo > 12 ? range(lo, hi, 1).filter((v) => v % 5 === 0) : range(lo, hi, 1);
  return { kind: 'number-line', from: lo, to: hi, step: long ? 5 : 1, labels, marks };
}

/** "Which is the smallest? −10, −5, −8, 5": the line through zero, nothing marked. */
const intCompare: PictureRule = (q) => {
  const m = /^Which is the \w+\? (.+)$/.exec(q.prompt ?? '');
  if (!m) return null;
  const nums = m[1].split(', ').map((t) => whole(t));
  if (nums.length < 2 || nums.some((n) => n === null)) return null;
  const v = nums as number[];
  return zeroLine(Math.min(...v), Math.max(...v));
};

/** A one-step sum with a negative in it, or a take-away that goes below zero: the line through zero, the start marked. */
const intSum: PictureRule = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '+' && s.op !== '−')) return null;
  const known = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (known.some((n) => !Number.isInteger(n))) return null;
  const below = (s.c === null && s.op === '−' && s.a! < s.b!) || known.some((n) => n < 0) || solve(s) < 0;
  if (!below) return null;
  const all = [...known, solve(s)];
  const start = s.a ?? s.b!;
  return zeroLine(Math.min(...all), Math.max(...all), [{ at: start, label: show(start) }]);
};

/** "Count back. 5, 0, −5, ?": the line with the shown numbers on it. */
const countLine: PictureRule = (q) => {
  if (!/^Count (back|on)\.$/i.test(q.prompt ?? '')) return null;
  const p = q.parts;
  if (p.length < 3 || p[p.length - 1] !== '?') return null;
  const v = p.slice(0, -1).map((t) => whole(t.replace(/,$/, '')));
  if (v.some((n) => n === null)) return null;
  const nums = v as number[];
  const d = Math.abs(nums[1] - nums[0]);
  if (!d) return null;
  const from = Math.min(...nums) - 2 * d;
  const to = Math.max(...nums) + 2 * d;
  return { kind: 'number-line', from, to, step: d, labels: nums };
};

// ---------- tracks ----------

/** "0, ?, 20, 30": a number track with the gap as '?', and a jump arrow over each gap. */
const track: PictureRule = (q) => {
  const p = q.parts;
  if (p.length < 3 || p.length > 8 || !/missing|comes next/i.test(q.prompt ?? '')) return null;
  const cells = p.map((t) => t.replace(/,$/, ''));
  if (!cells.every((c) => c === '?' || /^\d+$/.test(c)) || cells.filter((c) => c === '?').length !== 1) return null;
  // Which way the jumps go, from the first two numbers side by side.
  const v = cells.map((c) => (c === '?' ? null : Number(c)));
  const i = v.findIndex((x, k) => x !== null && v[k + 1] != null);
  if (i < 0 || cells.length > 10 || v[i] === v[i + 1]) return { kind: 'track', cells };
  return { kind: 'track', cells, arcs: v[i + 1]! > v[i]! ? '+' : '−' };
};

// ---------- place value, rounding, units ----------

const PLACE_HEADINGS = ['Millions', '100 000s', '10 000s', '1000s', '100s', '10s', '1s'];

function placeChart(n: string | undefined): Picture | null {
  const digits = (n ?? '').replace(/\s/g, '');
  if (!/^\d{4,7}$/.test(digits)) return null;
  return { kind: 'place', headings: PLACE_HEADINGS.slice(7 - digits.length), digits: digits.split('') };
}

/** "In 219 170, the 9 is worth ?" and "90 806 = 90 000 + ? + 6": the number in a place-value chart. */
const place: PictureRule = (q) => {
  const p = q.parts;
  if (p[0] === 'In' && p[2] === 'the' && p[p.length - 1] === '?') return placeChart(p[1].replace(/,$/, ''));
  if (p[1] === '=' && p.includes('?') && p[3] === '+' && !p.includes('×')) {
    const full = whole(p[0]);
    const first = whole(p[2]);
    return full !== null && first !== null && full >= 1000 && /^[1-9]0*$/.test(String(first)) ? placeChart(p[0]) : null;
  }
  return null;
};

const DEC_HEADINGS = ['1000s', '100s', '10s', '1s', 'tenths', 'hundredths', 'thousandths'];

/**
 * "1.1 × 10 = ?", "58 ÷ 100 = ?", "0.013 × 1000 = ?": the number in a place-value chart, with empty columns for the digits
 * to move into. Only the question's number is written in it, never the answer.
 */
const decimalPlace: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 5 || (p[1] !== '×' && p[1] !== '÷') || p[3] !== '=' || p[4] !== '?') return null;
  const text = (p[0] ?? '').trim();
  const k = whole(p[2]);
  const dp = places(text);
  if (!/^\d+(\.\d+)?$/.test(text) || dp === null || dp > 3 || (k !== 10 && k !== 100 && k !== 1000)) return null;
  const n = Number(text);
  // Whole-number answers (7 × 10, 70 ÷ 10) are times-table facts, not place value with decimals.
  if (dp === 0 && (p[1] === '×' || n % k === 0)) return null;
  return decimalChart(text, show(p[1] === '×' ? n * k : n / k).replace(/\s/g, ''));
};

/** The number `text` in a place-value chart, with room for the columns of `other` (where its digits go). */
function decimalChart(text: string, other: string): Picture | null {
  const [w, d = ''] = text.split('.');
  // Places counted from the 1s (0), 10s (1), tenths (−1): the number's own, and room for where its digits go.
  const span = (t: string) => {
    const [a, b = ''] = t.split('.');
    return { hi: a.replace(/^0+(?=\d)/, '').length - 1, lo: -b.length };
  };
  const hi = Math.max(span(text).hi, span(other).hi, 0);
  const lo = Math.min(span(text).lo, span(other).lo);
  const top = 3 - hi;
  const bottom = 3 - lo;
  if (top < 0 || bottom > 6 || bottom - top > 5) return null;
  const headings = DEC_HEADINGS.slice(top, bottom + 1);
  const digits = headings.map((_, c) => {
    const place = hi - c;
    return place >= 0 ? (w[w.length - 1 - place] ?? '') : (d[-place - 1] ?? '');
  });
  return { kind: 'place', headings, digits };
}

/** "9.4 × ? = 940": the 9.4 in a chart wide enough to reach the column the 9 moves to (the answer is never written). */
const timesMissing: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[1] !== '×' || p[3] !== '=') return null;
  const [known, c] = p[0] === '?' ? [p[2], p[4]] : p[2] === '?' ? [p[0], p[4]] : [undefined, undefined];
  const text = (known ?? '').trim();
  const dp = places(text);
  if (!/^\d+\.\d+$/.test(text) || dp === null || dp > 3 || num(c) === null || p.filter((t) => t === '?').length !== 1) return null;
  const k = Math.round((num(c)! / Number(text)) * 1e6) / 1e6;
  if (k !== 10 && k !== 100 && k !== 1000) return null;
  return decimalChart(text, (c ?? '').replace(/\s/g, ''));
};

/** "Round 99 to the nearest 10": the line between the two tens (or hundreds, thousands) with the number marked. */
const rounding: PictureRule = (q) => {
  const p = q.parts;
  const m = /^to the nearest ([\d ]+)$/.exec(p[2] ?? '');
  const n = whole(p[1]);
  if (p[0] !== 'Round' || !m || n === null) return null;
  const unit = whole(m[1]);
  if (!unit || unit < 10) return null;
  const lo = Math.floor(n / unit) * unit;
  // The middle is labelled too (the card talks about it); a number on it needs no second label.
  const mid = lo + unit / 2;
  return { kind: 'number-line', from: lo, to: lo + unit, step: unit / 10, labels: [lo, mid, lo + unit], marks: [{ at: n, label: n === mid ? '' : show(n) }] };
};

/** Metric ladders, big to small, with the × between each step and the next. */
const LADDERS: { units: string[]; links: string[] }[] = [
  { units: ['km', 'm', 'cm', 'mm'], links: ['× 1000', '× 100', '× 10'] },
  { units: ['kg', 'g'], links: ['× 1000'] },
  { units: ['L', 'mL'], links: ['× 1000'] },
];

/** "6 km = ? m", "8.5 kg = ? g": the ladder from one unit to the other, nothing else (a short picture), both lit. */
const unitLadder: PictureRule = (q) => {
  const p = q.parts;
  const m = /^[\d., ]+ ([a-zA-Z]+)$/.exec(p[0] ?? '');
  if (!m || p[1] !== '=' || p[2] !== '?' || p.length !== 4) return null;
  const ladder = LADDERS.find((l) => l.units.includes(m[1]) && l.units.includes(p[3]));
  if (!ladder || m[1] === p[3]) return null;
  const i = ladder.units.indexOf(m[1]);
  const j = ladder.units.indexOf(p[3]);
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  const links = ladder.links.slice(lo, hi);
  // Going up (m to km) the arrows point up and divide.
  return i > j
    ? { kind: 'unit-ladder', units: ladder.units.slice(lo, hi + 1), links: links.map((l) => l.replace('×', '÷')), highlight: [m[1], p[3]], direction: 'up' }
    : { kind: 'unit-ladder', units: ladder.units.slice(lo, hi + 1), links, highlight: [m[1], p[3]], direction: 'down' };
};

// ---------- fractions, decimals, percentages ----------

/** 25% and 75% with fractions to pick from: the square is drawn in 4 blocks (a hundred square is read in rows for the rest). */
function quarters(q: { choiceLabels?: readonly string[] }, n: number): boolean {
  const labels = q.choiceLabels ?? [];
  return (n === 25 || n === 75) && labels.length > 0 && labels.every((l) => l.includes('/'));
}

/** A bar for a percentage the pupil can see in quarters, fifths or tenths. */
function percentBar(p: number): { parts: number; shaded: number } | null {
  if (p <= 0 || p > 100) return null;
  if (p === 50) return { parts: 2, shaded: 1 };
  if (p % 25 === 0) return { parts: 4, shaded: p / 25 };
  if (p % 10 === 0) return { parts: 10, shaded: p / 10 };
  return null;
}

/** "50% of 30 = ?": a bar in quarters or tenths, with the amount over the whole; "75% = ?": a hundred square. */
const percent: PictureRule = (q) => {
  const p = q.parts;
  const m = /^(\d+)%$/.exec(p[0] ?? '');
  if (!m) return null;
  // "75% = ?": a hundred square, out of 100 (a bar in quarters would be the answer fraction).
  const pc = Number(m[1]);
  if (p[1] === '=' && p[2] === '?' && p.length === 3) return pc >= 1 && pc <= 100 ? { kind: 'hundred', shaded: pc, ...(quarters(q, pc) ? { quarters: true } : {}) } : null;
  const bar = percentBar(Number(m[1]));
  if (!bar) return null;
  if (p[1] === 'of' && whole(p[2]) !== null && p[3] === '=') return { kind: 'bars', bars: [{ ...bar, label: p[2] }] };
  return null;
};

/** "1/3 of 21 = ?", "2/3 of 30 = ?", "1/2 of ? = 25": a bar cut in equal parts with the fraction shaded. */
const fractionOf: PictureRule = (q) => {
  const p = q.parts;
  const f = frac(p[0]);
  if (!f || p[1] !== 'of' || p[3] !== '=' || p.length !== 5 || f.n > f.d || f.d > 12) return null;
  if (p[4] === '?' && whole(p[2]) !== null) return { kind: 'bars', bars: [{ parts: f.d, shaded: f.n, label: p[2] }] };
  if (p[2] === '?' && whole(p[4]) !== null) return { kind: 'bars', bars: [{ parts: f.d, shaded: f.n, label: `shaded part = ${p[4]}` }] };
  return null;
};

/** The first tenths (or hundredths) number as a count, and how it was written: "0.9", "6/10", "35/100", "0.25". */
function tenthsOf(t: string | undefined): { tenths: number } | null {
  const f = frac(t);
  if (f && f.d === 10 && f.n <= 9) return { tenths: f.n };
  if (places(t) === 1) return { tenths: Math.round(num(t)! * 10) };
  return null;
}

/** "0.9 = ?", "6/10 = ?", "3.1 = ?/10": the line from the whole number below to the next one, in tenths. */
const tenths: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 3 || p[1] !== '=' || !(p[2] === '?' || p[2] === '?/10')) return null;
  const t = tenthsOf(p[0]);
  if (!t) return null;
  const from = Math.floor(t.tenths / 10);
  return { kind: 'number-line', from, to: from + 1, step: 0.1, labels: [from, from + 1], marks: [{ at: tidy(t.tenths / 10), label: p[0] }] };
};

/** "35/100 = ?", "0.25 = ?": a hundred square with that many squares shaded. */
const hundredths: PictureRule = (q) => {
  const p = q.parts;
  if (/power of 10/i.test(q.prompt ?? '')) return null; // the square says what fraction, not what power
  if (p.length !== 3 || p[1] !== '=' || !(p[2] === '?' || p[2] === '?/100')) return null;
  const f = frac(p[0]);
  if (f && f.d === 100 && f.n >= 1 && f.n <= 100) return { kind: 'hundred', shaded: f.n };
  if (places(p[0]) === 2 && num(p[0])! > 0 && num(p[0])! < 1) {
    const n = Math.round(num(p[0])! * 100);
    return { kind: 'hundred', shaded: n, ...(quarters(q, n) ? { quarters: true } : {}) };
  }
  return null;
};

/** Bonds to 100 ("? + 40 = 100") and to 1 in hundredths ("0.53 + ? = 1"): the known part shaded. */
const hundredBond: PictureRule = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '+' && s.op !== '−')) return null;
  const p = q.parts;
  const [ta, tb, tc] = p[3] === '=' ? [p[0], p[2], p[4]] : [p[2], p[4], p[0]];
  let known: number | null = null;
  if (s.op === '+' && s.c !== null && (s.a === null) !== (s.b === null)) {
    const k = s.a ?? s.b!;
    const kt = s.a !== null ? ta : tb;
    if (s.c === 100 && Number.isInteger(k)) known = k;
    else if (s.c === 1 && tc === '1' && places(kt) === 2) known = Math.round(k * 100);
  } else if (s.op === '−' && s.c === null && s.a !== null && s.b !== null) {
    if (s.a === 100 && Number.isInteger(s.b)) known = s.b;
    else if (s.a === 1 && places(tb) === 2) known = Math.round(s.b * 100);
  }
  return known !== null && known >= 1 && known <= 100 ? { kind: 'hundred', shaded: known } : null;
};

/** "2.3 + ? = 3", "8.4 + ? = 10", "10 − 0.8 = ?", "1.1 − 0.5 = ?": a line up to the whole, the decimals marked. */
const decimalBond: PictureRule = (q) => {
  const s = sum(q);
  if (!s) return null;
  if (s.op === '+' && s.c !== null && Number.isInteger(s.c) && (s.a === null) !== (s.b === null)) {
    const k = s.a ?? s.b!;
    if (Number.isInteger(k) || k < 0 || k >= s.c) return null;
    const from = Math.floor(k);
    return { kind: 'number-line', from, to: s.c, step: s.c - from <= 1 ? 0.1 : 1, labels: [from, s.c], marks: [{ at: k, label: show(k) }] };
  }
  if (s.op === '−' && s.c === null && s.a !== null && s.b !== null && Number.isInteger(s.a) && !Number.isInteger(s.b) && s.b > 0 && s.b < s.a) {
    // "9 − 0.6": the last whole, 8 to 9, in tenths (the start needs no second label).
    if (s.b < 1) return { kind: 'number-line', from: s.a - 1, to: s.a, step: 0.1, labels: [s.a - 1, s.a], marks: [{ at: s.a, label: '' }] };
    // "10 − 9.9": close to the start, the line is the last whole with the gap between 9.9 and 10 (count it up).
    const oneDp = places(String(s.b)) === 1;
    if (oneDp && s.a - s.b <= 1) return { kind: 'number-line', from: s.a - 1, to: s.a, step: 0.1, labels: [s.a - 1, s.a], marks: [{ at: s.b, label: show(s.b) }] };
    // "10 − 5.2": jump back the whole part (to 5), then the tenths on the line from 4 to 5.
    if (oneDp) {
      const to = s.a - Math.floor(s.b);
      return { kind: 'number-line', from: to - 1, to, step: 0.1, labels: [to - 1, to], marks: [{ at: to, label: '' }] };
    }
    return { kind: 'number-line', from: 0, to: s.a, step: 1, labels: [0], marks: [{ at: s.a, label: show(s.a) }] };
  }
  // "1.1 − 0.5": both on a line in tenths, either side of the whole between them (count up from one to the other).
  // Only when the tenths can't be taken away ("3.8 − 0.6" is ones then tenths, no line).
  const tenth = (n: number) => Math.round(n * 10) % 10;
  if (s.op === '−' && s.c === null && s.a !== null && s.b !== null && !Number.isInteger(s.a) && !Number.isInteger(s.b) && s.b > 0 && Math.ceil(s.b) <= Math.floor(s.a) && tenth(s.a) < tenth(s.b)) {
    const from = Math.floor(s.b);
    const to = Math.ceil(s.a);
    if (to - from > 5 || places(String(s.a)) !== 1 || places(String(s.b)) !== 1) return null;
    return { kind: 'number-line', from, to, step: 0.1, labels: range(from, to, 1), marks: [{ at: s.b, label: show(s.b) }, { at: s.a, label: show(s.a) }] };
  }
  return null;
};

/** "?/5 + 3/5 = 1", "1 − 1/4 = ?": a bar with the known fraction shaded (the missing part stays empty). "1 = ?/5": the whole bar, one part shaded. */
const fractionBond: PictureRule = (q) => {
  const p = q.parts;
  const whole = p.length === 3 && p[0] === '1' && p[1] === '=' ? /^\?\/(\d+)$/.exec(p[2]) : null;
  if (whole) {
    const d = Number(whole[1]);
    return d >= 2 && d <= 12 ? { kind: 'bars', bars: [{ parts: d, shaded: 1, label: '1' }] } : null;
  }
  if (p.length !== 5 || p[3] !== '=') return null;
  const miss = (t: string) => t === '?' || /^\?\/\d+$/.test(t);
  let known: { n: number; d: number } | null = null;
  if (p[1] === '+' && p[4] === '1') known = miss(p[0]) ? frac(p[2]) : miss(p[2]) ? frac(p[0]) : null;
  else if (p[1] === '−' && p[0] === '1' && p[4] === '?') known = frac(p[2]);
  return known && known.n >= 1 && known.n < known.d && known.d <= 12 ? { kind: 'bars', bars: [{ parts: known.d, shaded: known.n }] } : null;
};

/** "6/7 − 2/7 = ?", "1/8 + 3/4 = ?": the two fractions, one bar each. */
const fractionAdd: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[3] !== '=' || p[4] !== '?' || (p[1] !== '+' && p[1] !== '−')) return null;
  const a = frac(p[0]);
  const b = frac(p[2]);
  if (!a || !b || a.n > a.d || b.n > b.d || a.d > 12 || b.d > 12) return null;
  return { kind: 'bars', bars: [{ parts: a.d, shaded: a.n, shade: 'a' }, { parts: b.d, shaded: b.n, shade: 'b' }] };
};

/** "9 ÷ 1/6 = ?" and "1/2 ÷ 5 = ?": whole circles cut into the fraction. */
const fractionDivide: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 5 || p[1] !== '÷' || p[3] !== '=' || p[4] !== '?') return null;
  const w = whole(p[0]);
  const f = frac(p[2]);
  if (w !== null && f && f.n === 1 && w >= 1 && w <= 12 && f.d <= 12) return { kind: 'wholes', count: w, parts: f.d, shaded: 0 };
  const g = frac(p[0]);
  if (g && g.n <= g.d && g.d <= 12 && whole(p[2]) !== null) return { kind: 'wholes', count: 1, parts: g.d, shaded: g.n };
  return null;
};

/** "3 2/3 = ?/3", "42/10 = ? 2/10", "21/10 = ?": whole circles cut into parts, shaded as the number is written. */
const mixed: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 3 || p[1] !== '=' || !/^\?/.test(p[2])) return null;
  let parts: number;
  let shaded: number;
  let loose = false;
  const m = /^(\d+) (\d+)\/(\d+)$/.exec(p[0]);
  const f = frac(p[0]);
  if (m) {
    parts = Number(m[3]);
    shaded = Number(m[1]) * parts + Number(m[2]);
  } else if (f && f.n > f.d) {
    parts = f.d;
    shaded = f.n;
    loose = true; // improper fraction: loose slices, the pupil makes the full circles
  } else return null;
  const count = Math.ceil(shaded / parts);
  return parts >= 2 && parts <= 12 && count <= 6 ? { kind: 'wholes', count, parts, shaded, ...(loose ? { packed: false } : {}) } : null;
};

/** "4/5 = ?" as a decimal: the fraction bar, and a bar in tenths under it (nothing shaded) to show why the bottom becomes 10. */
const fractionToTenths: PictureRule = (q) => {
  const p = q.parts;
  if (p.length !== 3 || p[1] !== '=' || p[2] !== '?') return null;
  const f = frac(p[0]);
  if (!f || (f.d !== 2 && f.d !== 5) || f.n < 1 || f.n >= f.d) return null;
  const labels = q.choiceLabels ?? (q.choices ?? []).map(String);
  const decimal = /decimal/i.test(q.prompt ?? '') || (labels.length > 0 && labels.every((l) => /^\d*\.\d+$/.test(l)));
  return decimal ? { kind: 'bars', bars: [{ parts: f.d, shaded: f.n }, { parts: 10, shaded: 0 }] } : null;
};

/** "1/6 = ?/30", "1/3 = 4/?", "Simplify 6/8 = ?": the fraction as a bar (and the matching bar, unshaded, when its parts are known). */
const equivalent: PictureRule = (q) => {
  const p = [...q.parts];
  if (p[0] === 'Simplify') p.shift();
  if (p[1] !== '=' || p.length < 3 || p.length > 4) return null;
  const f = frac(p[0]);
  if (!f || f.n > f.d || f.d > 30 || f.n < 1) return null;
  const right = p[2];
  if (!/^(\?|\?\/\d+|\d+\/\?|\d+\/\d+)$/.test(right)) return null;
  const bars: { parts: number; shaded: number }[] = [{ parts: f.d, shaded: f.n }];
  const other = /^\?\/(\d+)$/.exec(right);
  if (other && Number(other[1]) <= 36) bars.push({ parts: Number(other[1]), shaded: 0 });
  return { kind: 'bars', bars };
};

// ---------- ratio and algebra ----------

/** "Share 24 in the ratio 1 : 3" and "7 red to 3 blue": one bar of equal boxes, the first share shaded. */
const ratio: PictureRule = (q) => {
  const p = q.prompt ?? '';
  const share = /^Share (\d+) in the ratio (\d+) : (\d+)/.exec(p);
  if (share) {
    const a = Number(share[2]);
    const b = Number(share[3]);
    if (a + b > 20) return null;
    // The share asked for is shaded: the bigger or smaller one, in its place on the bar.
    const big = /^bigger/i.test(q.parts[0] ?? '');
    const small = /^smaller/i.test(q.parts[0] ?? '');
    const second = (big && b > a) || (small && b < a);
    return { kind: 'bars', bars: [second ? { parts: a + b, shaded: b, start: a, label: share[1] } : { parts: a + b, shaded: a, label: share[1] }] };
  }
  const to = /^(\d+) [a-z]+ to (\d+) [a-z]+\./i.exec(p);
  if (to) {
    const a = Number(to[1]);
    const b = Number(to[2]);
    return a + b <= 20 ? { kind: 'bars', bars: [{ parts: a + b, shaded: a, label: '1 group' }] } : null;
  }
  return null;
};

/** "If 2a + 3 = 19": a balance. */
const balance: PictureRule = (q) => {
  const m = /^If (.+?) = (.+)$/.exec(q.prompt ?? '');
  if (!m || q.parts.length !== 3 || q.parts[1] !== '=' || q.parts[2] !== '?') return null;
  const leftBlocks = balanceLeft(m[1]);
  const rightBlocks = balanceNumber(m[2]);
  return leftBlocks && rightBlocks ? { kind: 'balance', left: m[1], right: m[2], leftBlocks, rightBlocks } : { kind: 'balance', left: m[1], right: m[2] };
};

/** A number on a pan: unit squares when small enough to count (up to 30), else one labelled block. */
function balanceNumber(t: string): BalanceSide | null {
  const n = whole(t);
  if (n === null || n < 0) return null;
  return n <= 30 ? { units: n } : { block: t };
}

/** The left pan of "p + 11", "n − 2", "9m", "s ÷ 9", "6s + 2": the letter's box(es), then the squares (dashed when taken away). */
function balanceLeft(t: string): BalanceSide | null {
  const div = /^([a-z]) ÷ (\d+)$/.exec(t);
  if (div) return { letter: t };
  const e = parseLin(t);
  if (!e || e.coef > 12 || !Number.isInteger(e.k)) return null;
  const side: BalanceSide = { letter: e.letter, letters: e.coef };
  if (e.op === '+') {
    if (e.k > 30) return null;
    side.units = e.k;
  } else if (e.op === '−') {
    if (e.k > 30) return null;
    side.gone = e.k;
  }
  return side;
}

/** "10⁻³ = ?" (write it as a decimal): the place-value strip with the 1 in the ones. */
const placeStrip: PictureRule = (q) => {
  const m = /^10⁻([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(q.parts[0] ?? '');
  if (!m || q.parts.length !== 3 || q.parts[1] !== '=' || q.parts[2] !== '?') return null;
  if (!/decimal/i.test(q.prompt ?? '')) return null;
  const places = Number([...m[1]].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''));
  return places >= 1 && places <= 6 ? { kind: 'place-strip', places } : null;
};

// ---------- counting ----------

/** "31 ÷ 9 = 3 r ?" (the groups made, the left-overs not drawn) and "15 ÷ 2 = ? r 1" (all the dots, in rows of 2). */
const remainders: PictureRule = (q) => {
  const p = q.parts;
  if (p[1] !== '÷' || p[3] !== '=') return null;
  const a = whole(p[0]);
  const b = whole(p[2]);
  if (a === null || b === null || b < 2) return null;
  const done = /^(\d+) r$/.exec(p[4] ?? '');
  if (done && p[5] === '?') {
    const rows = Number(done[1]);
    return rows >= 1 && rows <= 12 && b <= 12 ? { kind: 'array', rows, cols: b, groups: true } : null;
  }
  // Rows the size of a group, the left-overs as a short last row in the other colour.
  if (p[4] === '?' && p[5] === 'r' && a >= b && b <= 12 && Math.floor(a / b) <= 12) return { kind: 'array', rows: Math.floor(a / b), cols: b, extra: a % b };
  return null;
};

/** Doubles and halves: two matching rows of dots, or a two-row array to share. */
const doubleHalf: PictureRule = (q) => {
  const p = q.parts;
  if (p.length === 4 && p[0] === 'Double' && p[2] === '=' && p[3] === '?') {
    const n = whole(p[1]);
    return n !== null && n >= 1 && n <= 20 ? { kind: 'dot-rows', rows: [n, n], fives: true } : null;
  }
  if (p.length === 5 && p[0] === 'Half' && p[1] === 'of' && p[3] === '=' && p[4] === '?') {
    const n = whole(p[2]);
    // Two equal rows: the picture shows the sharing (same as 10 ÷ 2).
    return n !== null && n >= 2 && n <= 20 && n % 2 === 0 ? { kind: 'array', rows: 2, cols: n / 2, groups: true } : null;
  }
  const s = sum(q);
  if (s && s.op === '+' && s.c === null && s.a === s.b && Number.isInteger(s.a!) && s.a! >= 1 && s.a! <= 20) return { kind: 'dot-rows', rows: [s.a!, s.a!], fives: true };
  return null;
};

/**
 * "16 ÷ 4 = ?", "9 ÷ 9 = ?", "12 ÷ ? = 3": an array with each row ringed as a group (teachers asked for an array, not
 * dots in fives). The known number k is either how many rows (16 ÷ 4: 4 equal rows) or how many in a row (9 ÷ 9: rows of
 * 9), whichever keeps the array wide rather than tall; the pupil counts the other.
 */
const divideArray: PictureRule = (q) => {
  const s = sum(q);
  if (!s || s.op !== '÷' || s.a === null || (s.b === null) === (s.c === null)) return null;
  const a = s.a;
  const k = (s.b ?? s.c)!;
  if (!Number.isInteger(a) || !Number.isInteger(k) || a < 1 || a > 60 || k < 1 || a % k) return null;
  const u = a / k;
  const [rows, cols] = k <= u ? [k, u] : [u, k];
  // Past 20, only arrays that fit on the screen (at most 12 across).
  return a <= 20 || cols <= 12 ? { kind: 'array', rows, cols, groups: true } : null;
};

/** "7 × 8" is too big, but "3 × 4 = ?" and the 2 times table: rows of dots. */
const smallArray: PictureRule = (q) => {
  const s = sum(q);
  if (!s || s.op !== '×' || s.c !== null || s.a === null || s.b === null) return null;
  const { a, b } = s;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > 10 || b > 10 || a * b > 20) return null;
  // "10 × 1": one row of 10, not a tall column.
  return b === 1 ? { kind: 'array', rows: 1, cols: a } : { kind: 'array', rows: a, cols: b };
};

/** "11 × 7 = ?", "5 × 11 = ?", "35 × 2 = 60 + ?": an area box with the two-digit number split into tens and ones. */
const splitBox: PictureRule = (q) => {
  const p = q.parts;
  let a: number | null;
  let b: number | null;
  if (p.length === 7 && p[1] === '×' && p[3] === '=' && p[5] === '+' && (p[6] === '?' || p[4] === '?')) {
    a = whole(p[0]);
    b = whole(p[2]);
  } else {
    const s = sum(q);
    if (!s || s.op !== '×' || s.c !== null) return null;
    a = s.a;
    b = s.b;
  }
  if (a === null || b === null) return null;
  const [big, small] = a >= b ? [a, b] : [b, a];
  if (!Number.isInteger(big) || !Number.isInteger(small) || big < 11 || big > 99 || small < 2 || small > 9) return null;
  // The parts are values, not digits: 23 splits into 20 and 3 (James, 26 Nov 2026), drawn in proportion.
  if (big % 10 === 0) return null;
  return { kind: 'split-box', tens: big - (big % 10), ones: big % 10, by: small };
};

/** "3 + 4 = ?", "? + 15 = 20", "10 − 3 = ?", "10 + 3 = ?": five- or ten-frames, filled with what the question gives. */
const frames: PictureRule = (q) => {
  const s = sum(q);
  if (!s || (s.op !== '+' && s.op !== '−')) return null;
  const given = [s.a, s.b, s.c].filter((n): n is number => n !== null);
  if (given.some((n) => !Number.isInteger(n) || n < 0 || n > 20)) return null;
  // "13 + ? = 0" goes down, not up: the line through zero (intSum) shows it, not counters.
  if (s.op === '+' && s.c !== null && s.c < (s.a ?? s.b!)) return null;
  let counts: number[];
  if (s.op === '+') {
    if (s.c === null) counts = s.b === 10 && s.a !== 10 ? [s.b, s.a!] : [s.a!, s.b!];
    else if (s.a === null) counts = [s.b!];
    else counts = [s.a];
  } else {
    if (s.a === null || (s.b !== null && s.b > s.a)) return null;
    counts = [s.a];
  }
  counts = counts.filter((n) => n > 0);
  if (!counts.length) counts = [0];
  const total = counts.reduce((x, y) => x + y, 0);
  if (total > 20) return null;
  const size = Math.max(...given) <= 5 ? 5 : 10;
  // "4 + ? = 11": draw the room up to the total, so a second empty frame shows.
  if (s.op === '+' && s.c !== null && s.c > size) return { kind: 'frames', size, counts, frames: Math.ceil(s.c / size) };
  return { kind: 'frames', size, counts };
};

/** Most specific first. */
export const PICTURE_RULES: PictureRule[] = [
  angleSize,
  compass,
  axisGrid,
  elapsed,
  clock24,
  towers,
  chance,
  thermometer,
  intCompare,
  countLine,
  track,
  place,
  decimalPlace,
  timesMissing,
  rounding,
  unitLadder,
  percent,
  fractionOf,
  ratio,
  balance,
  placeStrip,
  tenths,
  hundredths,
  hundredBond,
  decimalBond,
  fractionBond,
  fractionAdd,
  fractionDivide,
  mixed,
  fractionToTenths,
  equivalent,
  remainders,
  splitBox,
  intSum,
  doubleHalf,
  divideArray,
  smallArray,
  frames,
];
