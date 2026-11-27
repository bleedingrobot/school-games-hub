/**
 * Year 6 ladder skills: Measurement and angles (docs/plans/ladder-y6/PLAN.md). Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 *
 * Fluency only: one typed number in about 8 seconds, friendly numbers (halves, quarters, times-table facts, multiples of 10).
 * Only the two-step area and volume types are in MEASURE_SLOW_KEYS.
 *
 * Types:
 *   metric-y6 : m6:small  m6:big  m6:mixed
 *   area-y6   : area6:rect  area6:tri  area6:box
 *   angles-y6 : ang6:line  ang6:point  ang6:opposite
 */
import { int, isInt, tidy, type Family, type Made } from '../banded';
import type { Figure } from '../figure';
import { oneKey, withMistakes, type Named } from './generatedKit';
import type { Y6Row } from './y6Row';

const METRIC_TAGS = ['MS.Y6.MEA.M.P3'];
const AREA_TAGS = ['MS.Y6.MEA.M.P4', 'MS.Y6.MEA.M.P5'];
const ANGLE_TAGS = ['MS.Y6.MEA.M.P7', 'MS.Y6.MEA.M.P8'];

/** A number as shown: 2.5, 0.25, 3500. */
const show = (n: number) => String(tidy(n));
/** At most two decimal places: nothing odder than 0.25 is shown or offered. */
const twoDp = (n: number) => Math.round(n * 100) / 100 === n;

/** A typed question: decimal pad when the answer isn't whole. Null when fewer than three named mistakes are left. */
function typed(base: { parts: string[]; spoken: string; answer: number; prompt?: string; figure?: Figure }, named: Named): Made | null {
  const answer = tidy(base.answer);
  return withMistakes({ ...base, answer, ...(Number.isInteger(answer) ? {} : { input: 'decimal' as const }) }, named, { ok: twoDp });
}

const SAY: Record<string, string> = { m: 'metres', cm: 'centimetres', L: 'litres', mL: 'millilitres', g: 'grams', kg: 'kilograms', 'cm²': 'square centimetres', 'm²': 'square metres' };

// ---------------------------------------------------------------- metric-y6

/** [big unit, small unit, small units in one big unit]. */
const UNITS: [string, string, number][] = [['kg', 'g', 1000], ['L', 'mL', 1000], ['m', 'cm', 100]];

/** "2.5 kg = ? g": a half-step or tenth-step number of the big unit, asked in the small one. */
const small = oneKey(
  'm6:small',
  'Big unit to small unit (2.5 kg in g)',
  METRIC_TAGS,
  2,
  (_k, r) => {
    const u = int(r, 0, 2);
    return u === 2 ? [u, int(r, 2, 30)] : [u, int(r, 1, 18)];
  },
  (_k, [u, k]) => {
    if (!isInt(u, 0, 2) || !isInt(k, u === 2 ? 2 : 1, u === 2 ? 30 : 18)) return null;
    const [big, little, per] = UNITS[u];
    const v = tidy(k / (u === 2 ? 10 : 2));
    const a = tidy(v * per);
    return typed(
      { parts: [`${show(v)} ${big}`, '=', '?', little], spoken: `${show(v)} ${SAY[big]} equals how many ${SAY[little]}?`, answer: a },
      { 'one zero too few': a / 10, 'one zero too many': a * 10, 'forgot to convert': v, 'two zeros too many': a * 100, 'used 100 for 1000': v * (per === 1000 ? 100 : 1000) },
    );
  },
);

/** "2500 g = ? kg": quarter-steps (or half-metres) of the big unit, asked in the big one. */
const big = oneKey(
  'm6:big',
  'Small unit to big unit (2500 g in kg)',
  METRIC_TAGS,
  2,
  (_k, r) => [int(r, 0, 2), int(r, 1, 12)],
  (_k, [u, k]) => {
    if (!isInt(u, 0, 2) || !isInt(k, 1, 12)) return null;
    const [bigU, little, per] = UNITS[u];
    const v = u === 2 ? k * 50 : k * 250;
    const a = tidy(v / per);
    return typed(
      { parts: [`${v} ${little}`, '=', '?', bigU], spoken: `${v} ${SAY[little]} equals how many ${SAY[bigU]}?`, answer: a },
      { 'one zero too many': a * 10, 'one zero too few': a / 10, 'two zeros too many': a * 100, 'forgot to convert': v, 'used 1000 for 100': (v / (per === 1000 ? 100 : 1000)) },
    );
  },
);

const SMALL_PARTS: number[][] = [[250, 500, 750], [250, 500, 750], [25, 50, 75]];

/** "10 kg 500 g = ? kg". */
const mixed = oneKey(
  'm6:mixed',
  'Mixed units to one unit (10 kg 500 g in kg)',
  METRIC_TAGS,
  3,
  (_k, r) => [int(r, 0, 2), int(r, 1, 12), int(r, 0, 2)],
  (_k, [u, x, i]) => {
    if (!isInt(u, 0, 2) || !isInt(x, 1, 12) || !isInt(i, 0, 2)) return null;
    const [bigU, little, per] = UNITS[u];
    const y = SMALL_PARTS[u][i];
    const a = tidy(x + y / per);
    return typed(
      { parts: [`${x} ${bigU} ${y} ${little}`, '=', '?', bigU], spoken: `${x} ${SAY[bigU]} ${y} ${SAY[little]} equals how many ${SAY[bigU]}?`, answer: a },
      {
        'forgot the small part': x,
        'added the two numbers': x + y,
        'ran the digits together': Number(`${x}${y}`),
        'small part ten times too big': x + y / (per / 10),
        'small part ten times too small': x + y / (per * 10),
        'ten times too big': a * 10,
      },
    );
  },
);

// ---------------------------------------------------------------- area-y6

const UNIT_SIZES = ['cm', 'm'];

/** "Area = ? cm²" for a rectangle with times-table sides. */
const rect = oneKey(
  'area6:rect',
  'Area of a rectangle (4 cm by 6 cm)',
  AREA_TAGS,
  3,
  (_k, r) => [int(r, 2, 10), int(r, 2, 10), int(r, 0, 1)],
  (_k, [w, h, u]) => {
    if (!isInt(w, 2, 10) || !isInt(h, 2, 10) || !isInt(u, 0, 1)) return null;
    const unit = UNIT_SIZES[u];
    return typed(
      {
        parts: ['Area', '=', '?', `${unit}²`],
        spoken: `A rectangle is ${w} ${SAY[unit]} by ${h} ${SAY[unit]}. What is its area in ${SAY[`${unit}²`]}?`,
        prompt: `A rectangle ${w} ${unit} by ${h} ${unit}`,
        figure: { kind: 'rectangle', width: `${w} ${unit}`, height: `${h} ${unit}`, inside: '?' },
        answer: w * h,
      },
      { 'added the sides': w + h, 'found the perimeter': 2 * (w + h), 'doubled the product': 2 * w * h, 'one row short': w * (h - 1), 'one row too many': w * (h + 1) },
    );
  },
);

/** "Area = ? cm²" for a right-angled triangle: base times height, halved. Base is even so the half is whole. */
const tri = oneKey(
  'area6:tri',
  'Area of a right-angled triangle (base 8 cm, height 5 cm)',
  AREA_TAGS,
  3,
  (_k, r) => [int(r, 1, 5) * 2, int(r, 2, 10), int(r, 0, 1)],
  (_k, [b, h, u]) => {
    if (!isInt(b, 2, 10) || b % 2 !== 0 || !isInt(h, 2, 10) || !isInt(u, 0, 1)) return null;
    const unit = UNIT_SIZES[u];
    return typed(
      {
        parts: ['Area', '=', '?', `${unit}²`],
        spoken: `A right-angled triangle has a base of ${b} ${SAY[unit]} and a height of ${h} ${SAY[unit]}. What is its area in ${SAY[`${unit}²`]}?`,
        prompt: `A right-angled triangle: base ${b} ${unit}, height ${h} ${unit}`,
        figure: { kind: 'triangle-area', base: `${b} ${unit}`, height: `${h} ${unit}`, inside: '?', right: true },
        answer: (b * h) / 2,
      },
      { 'forgot to halve': b * h, 'added them': b + h, 'doubled it': 2 * b * h, 'halved one and added': b / 2 + h, 'halved the height only': b * Math.floor(h / 2) },
    );
  },
);

/** "Volume = ? cm³" for a small box. */
const box = oneKey(
  'area6:box',
  'Volume of a box (4 by 3 by 2 cm)',
  AREA_TAGS,
  3,
  (_k, r) => {
    for (;;) {
      const p = [int(r, 1, 5), int(r, 1, 5), int(r, 1, 5)];
      if (p[0] * p[1] * p[2] <= 60 && p[0] * p[1] * p[2] > 1) return p;
    }
  },
  (_k, [l, w, h]) => {
    if (!isInt(l, 1, 5) || !isInt(w, 1, 5) || !isInt(h, 1, 5) || l * w * h > 60) return null;
    return typed(
      {
        parts: ['Volume', '=', '?', 'cm³'],
        spoken: `A box is ${l} centimetres long, ${w} centimetres wide and ${h} centimetres high. What is its volume in cubic centimetres?`,
        prompt: `A box: length ${l} cm, width ${w} cm, height ${h} cm`,
        figure: { kind: 'cuboid', length: `${l} cm`, width: `${w} cm`, height: `${h} cm` },
        answer: l * w * h,
      },
      { 'added the sides': l + w + h, 'only length times width': l * w, 'only width times height': w * h, 'only length times height': l * h, 'times two sides and added': l * w + h },
    );
  },
);

// ---------------------------------------------------------------- angles-y6

const deg = (n: number) => `${n}°`;
const tens = (r: () => number, lo: number, hi: number) => int(r, lo / 10, hi / 10) * 10;
const isTens = (n: number, lo: number, hi: number) => isInt(n, lo, hi) && n % 10 === 0;

/** "130° + ?° = 180°". */
const line = oneKey(
  'ang6:line',
  'Two angles on a straight line (130°)',
  ANGLE_TAGS,
  1,
  (_k, r) => {
    for (;;) {
      const a = tens(r, 20, 160);
      if (a !== 90) return [a];
    }
  },
  (_k, [a]) => {
    if (!isTens(a, 20, 160) || a === 90) return null;
    return typed(
      {
        parts: [deg(a), '+', '?°', '=', '180°'],
        spoken: `Angles on a straight line: ${a} degrees and what?`,
        prompt: 'Angles on a straight line',
        figure: { kind: 'crossing', angles: [deg(a), '?'], next: true },
        answer: 180 - a,
      },
      { 'used 360': 360 - a, 'used 90': 90 - a, 'added to 180': 180 + a, 'gave the angle itself': a, 'off by 10': 180 - a + 10 },
    );
  },
);

/** "90° + 90° + 100° + ?° = 360°", or "200° + ?° = 360°" (b and c are 0 for the one-angle form). */
const point = oneKey(
  'ang6:point',
  'Angles round a point (90°, 90°, 100°)',
  ANGLE_TAGS,
  3,
  (_k, r) => {
    if (int(r, 0, 1) === 0) {
      for (;;) {
        const a = tens(r, 100, 300);
        if (a !== 180) return [a, 0, 0];
      }
    }
    for (;;) {
      const a = tens(r, 60, 130);
      const b = tens(r, 60, 130);
      const c = tens(r, 60, 130);
      if (a + b + c >= 240 && a + b + c <= 300) return [a, b, c];
    }
  },
  (_k, [a, b, c]) => {
    if (b === 0 && c === 0) {
      if (!isTens(a, 100, 300) || a === 180) return null;
      return typed(
        {
          parts: [deg(a), '+', '?°', '=', '360°'],
          spoken: `Angles round a point: ${a} degrees and what?`,
          prompt: 'Angles round a point',
          figure: { kind: 'point', angles: [deg(a), '?'] },
          answer: 360 - a,
        },
        { 'used 180': 180 - a, 'used 90': 90 - a, 'gave the angle itself': a, 'added to 360': 360 + a, 'off by 10': 360 - a + 10, 'off by 10 the other way': 360 - a - 10 },
      );
    }
    if (!isTens(a, 60, 130) || !isTens(b, 60, 130) || !isTens(c, 60, 130) || a + b + c < 240 || a + b + c > 300) return null;
    const s = a + b + c;
    return typed(
      {
        parts: [deg(a), '+', deg(b), '+', deg(c), '+', '?°', '=', '360°'],
        spoken: `Angles round a point: ${a} degrees, ${b} degrees, ${c} degrees and what?`,
        prompt: 'Angles round a point',
        figure: { kind: 'point', angles: [deg(a), deg(b), deg(c), '?'] },
        answer: 360 - s,
      },
      { 'used 180': 180 - s, 'added them': s, 'left one angle out': 360 - (s - c), 'off by 10': 360 - s + 10, 'off by 10 the other way': 360 - s - 10 },
    );
  },
);

/** Two crossing lines: the angle vertically opposite (the same size), or the angle next to it on the line (180° take away). */
const opposite = oneKey(
  'ang6:opposite',
  'Angles at crossing lines (opposite 40°)',
  ANGLE_TAGS,
  2,
  (_k, r) => {
    for (;;) {
      const a = tens(r, 20, 160);
      if (a !== 90) return [int(r, 0, 1), a];
    }
  },
  (_k, [kind, a]) => {
    if (!isInt(kind, 0, 1) || !isTens(a, 20, 160) || a === 90) return null;
    if (kind === 0) {
      return typed(
        {
          parts: ['Opposite angle', '=', '?°'],
          spoken: `Two straight lines cross. One angle is ${a} degrees. What is the angle vertically opposite it?`,
          prompt: `Two lines cross: the angle vertically opposite ${deg(a)}`,
          figure: { kind: 'crossing', angles: [deg(a), '?'] },
          answer: a,
        },
        { 'gave the angle next to it': 180 - a, 'used 90': 90 - a, 'used 360': 360 - a, doubled: 2 * a, 'off by 10': a + 10, 'off by 10 the other way': a - 10 },
      );
    }
    return typed(
      {
        parts: ['Next angle', '=', '?°'],
        spoken: `Two straight lines cross. One angle is ${a} degrees. What is the angle next to it on the straight line?`,
        prompt: `Two lines cross: the angle next to ${deg(a)} on a straight line`,
        figure: { kind: 'crossing', angles: [deg(a), '?'], next: true },
        answer: 180 - a,
      },
      { 'gave the opposite angle': a, 'used 90': 90 - a, 'used 360': 360 - a, 'off by 10': 180 - a + 10, 'off by 10 the other way': 180 - a - 10 },
    );
  },
);

// ---------------------------------------------------------------- exports

export const MEASURE_FAMILIES: Record<string, Family> = {
  'm6:small': small,
  'm6:big': big,
  'm6:mixed': mixed,
  'area6:rect': rect,
  'area6:tri': tri,
  'area6:box': box,
  'ang6:line': line,
  'ang6:point': point,
  'ang6:opposite': opposite,
};

export const MEASURE_SKILL_KEYS: Record<string, readonly string[]> = {
  'metric-y6': ['m6:small', 'm6:big', 'm6:mixed'],
  'area-y6': ['area6:rect', 'area6:tri', 'area6:box'],
  'angles-y6': ['ang6:line', 'ang6:point', 'ang6:opposite'],
};

/** The two-step types: 12 seconds to count as quick. */
export const MEASURE_SLOW_KEYS: string[] = ['area6:tri', 'area6:box'];

export const MEASURE_LADDER: readonly Y6Row[] = [
  { id: 'metric-y6', label: 'Metric units: kg and g, m and cm, L and mL', tiny: 'Metric units', stage: 'measurement-geometry', after: 'decimal-order', tags: METRIC_TAGS },
  { id: 'area-y6', label: 'Area of rectangles and right-angled triangles, volume of boxes', tiny: 'Area and volume', stage: 'measurement-geometry', after: 'squares-cubes', tags: AREA_TAGS },
  { id: 'angles-y6', label: 'Angles on a line, at a point and vertically opposite', tiny: 'Angles line, point', stage: 'measurement-geometry', after: 'area-y6', tags: ANGLE_TAGS },
];
