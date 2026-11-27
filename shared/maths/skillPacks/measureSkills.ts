/**
 * Measurement and geometry facts, Year 7 and 8 (docs/plans/ladder-7-8/PLAN.md section 3e, card Y7).
 *
 * Every question is one number to type, answerable in about 8 seconds (12 for the two-step types in MEASURE_SLOW_KEYS). Angle
 * and shape questions come with a small picture (shared/maths/figure.ts): the parts and prompt say everything, the picture is
 * extra and its '?' label is the thing asked. All answers are typed (never below zero); decimals use the decimal pad.
 *
 * Types:
 *   metric             (Y7) metric:km-m  metric:l-ml  metric:mm-cm  metric:cm-m  metric:g-kg
 *   time-convert       (Y7) mtime:frac-h  mtime:h-min  mtime:min-h
 *   formulas           (Y7) formula:rect-area  formula:rect-perim  formula:tri-area  formula:cube-vol  formula:cuboid-vol  formula:square-side
 *   angle-facts        (Y7) angle:tri-third  angle:line  angle:line3  angle:point  angle:isosceles
 *   polygon-angles     (Y7) polygon:exterior  polygon:sum
 *   compass-degrees    (Y7) compass:turn  compass:from-n
 *   metric-area-volume (Y8) unitsq:cm2  unitsq:m2  unitsq:ml-cm3  unitsq:l-cm3  unitsq:m3-l
 *   circle-parts       (Y8) circle:diam  circle:radius
 */
import { int, isInt, tidy, type Family, type Made } from '../banded';
import type { Figure } from '../figure';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { talk } from './pickKit';

const T = (strand: string, year: 7 | 8, ...n: number[]) => n.map((i) => `MS.Y${year}.MG.${strand}.P${i}`);
const Y7_METRIC = T('M', 7, 1, 2);
const Y7_TIME = T('M', 7, 3);
const Y7_FORMULA = T('M', 7, 4, 5);
const Y7_ANGLE = T('G', 7, 1, 2);
const Y7_POLY = T('G', 7, 3);
const Y7_COMPASS = T('G', 7, 4);
const Y8_UNITS = T('M', 8, 1, 2);
const Y8_CIRCLE = T('G', 8, 1);

/** A number as shown: 8.5, 0.45, 3500. */
const show = (n: number) => String(tidy(n));

/** A typed question: decimal pad when the answer isn't whole. Null when fewer than three named mistakes are left. */
function typed(base: { parts: string[]; spoken: string; answer: number; prompt?: string; figure?: Figure }, named: Named): Made | null {
  const answer = tidy(base.answer);
  return withMistakes({ ...base, answer, ...(Number.isInteger(answer) ? {} : { input: 'decimal' as const }) }, named);
}

const SAY: Record<string, string> = { km: 'kilometres', m: 'metres', mm: 'millimetres', cm: 'centimetres', L: 'litres', mL: 'millilitres', g: 'grams', kg: 'kilograms' };

// ---------------------------------------------------------------- metric (Y7)

/** "3.5 km = ? m": a number and a unit, and the unit it is asked in. `value` comes from the first number, `answer` from it. */
function metric(key: string, label: string, from: string, to: string, lo: number, hi: number, value: (n: number) => number, answer: (n: number) => number): Family {
  return oneKey(
    key,
    label,
    Y7_METRIC,
    1,
    (_k, r) => {
      for (;;) {
        const n = int(r, lo, hi);
        if (n % 10 !== 0) return [n];
      }
    },
    (_k, [n]) => {
      if (!isInt(n, lo, hi) || n % 10 === 0) return null;
      const v = value(n);
      const a = tidy(answer(n));
      const parts = [`${show(v)} ${from}`, '=', '?', to];
      const spoken = `${show(v)} ${SAY[from]} equals how many ${SAY[to]}?`;
      const wrongPower: Named = {
        'one zero too many': a * 10,
        'one zero too few': a / 10,
        'two zeros too many': a * 100,
        'two zeros too few': a / 100,
        'forgot to convert': v,
      };
      return typed({ parts, spoken, answer: a }, wrongPower);
    },
  );
}

const kmM = metric('metric:km-m', 'Kilometres to metres (3.5 km)', 'km', 'm', 11, 99, (n) => n / 10, (n) => n * 100);
const lMl = metric('metric:l-ml', 'Litres to millilitres (2.4 L)', 'L', 'mL', 11, 99, (n) => n / 10, (n) => n * 100);
const mmCm = metric('metric:mm-cm', 'Millimetres to centimetres (85 mm)', 'mm', 'cm', 11, 99, (n) => n, (n) => n / 10);
const cmM = metric('metric:cm-m', 'Centimetres to metres (240 cm)', 'cm', 'm', 11, 49, (n) => n * 10, (n) => n / 10);

/** "450 g = ? kg": grams in steps of 50, to under a kilogram. */
const gKg = oneKey(
  'metric:g-kg',
  'Grams to kilograms (450 g)',
  Y7_METRIC,
  1,
  (_k, r) => [int(r, 1, 19)],
  (_k, [k]) => {
    if (!isInt(k, 1, 19)) return null;
    const g = k * 50;
    const a = g / 1000;
    return typed(
      { parts: [`${g} g`, '=', '?', 'kg'], spoken: `${g} grams equals how many kilograms?`, answer: a },
      { 'one zero too many': a * 10, 'two zeros too many': a * 100, 'one zero too few': a / 10, 'three zeros too many': a * 1000, 'forgot to convert': g },
    );
  },
);

// ---------------------------------------------------------------- time-convert (Y7)

const FRACS: [number, number][] = [[1, 4], [1, 2], [3, 4], [1, 3], [2, 3], [1, 6], [1, 5], [2, 5]];

/** "3/4 h = ? min". */
const fracH = oneKey(
  'mtime:frac-h',
  'Part of an hour in minutes (3/4 h)',
  Y7_TIME,
  1,
  (_k, r) => [int(r, 0, FRACS.length - 1)],
  (_k, [i]) => {
    if (!isInt(i, 0, FRACS.length - 1)) return null;
    const [n, d] = FRACS[i];
    const a = (60 * n) / d;
    return typed(
      { parts: [`${n}/${d} h`, '=', '?', 'min'], spoken: `${n} over ${d} of an hour equals how many minutes?`, answer: a },
      { 'took it of 100 minutes': (100 * n) / d, 'gave the top number': n, 'gave the bottom number': d, 'one step too many': (60 * (n + 1)) / d, 'one step too few': (60 * (n - 1)) / d || NaN, doubled: a * 2 },
    );
  },
);

/** "2 h 15 min = ? min". */
const hMin = oneKey(
  'mtime:h-min',
  'Hours and minutes in minutes (2 h 15 min)',
  Y7_TIME,
  2,
  (_k, r) => [int(r, 1, 4), int(r, 1, 11) * 5],
  (_k, [h, m]) => {
    if (!isInt(h, 1, 4) || !isInt(m, 5, 55) || m % 5 !== 0) return null;
    const a = h * 60 + m;
    return typed(
      { parts: [`${h} h ${m} min`, '=', '?', 'min'], spoken: `${h} hours ${m} minutes equals how many minutes?`, answer: a },
      { '100 minutes in an hour': h * 100 + m, 'added the numbers': h + m, 'forgot the hours': m, 'one hour short': a - 60, 'one hour too many': a + 60 },
    );
  },
);

/** "150 min = 2 h ? min". */
const minH = oneKey(
  'mtime:min-h',
  'Minutes as hours and minutes (150 min)',
  Y7_TIME,
  2,
  (_k, r) => [int(r, 1, 4), int(r, 1, 11) * 5],
  (_k, [h, m]) => {
    if (!isInt(h, 1, 4) || !isInt(m, 5, 55) || m % 5 !== 0) return null;
    const total = h * 60 + m;
    return typed(
      { parts: [`${total} min`, '=', `${h} h`, '?', 'min'], spoken: `${total} minutes equals ${h} hours and how many minutes?`, answer: m },
      { '100 minutes in an hour': total - 100 * h, 'took off 100 once': total - 100, 'did not take off the hours': total, 'counted back to the next hour': 60 - m, 'left an hour in': m + 60 },
    );
  },
);

// ---------------------------------------------------------------- formulas (Y7)

const cm = (n: number) => `${n} cm`;

/** "Area = ? cm²" for a rectangle. */
const rectArea = oneKey(
  'formula:rect-area',
  'Area of a rectangle (6 cm by 4 cm)',
  Y7_FORMULA,
  2,
  (_k, r) => rectRoll(r),
  (_k, [w, h]) => {
    if (!isInt(w, 3, 12) || !isInt(h, 2, 9) || w === h) return null;
    return typed(
      {
        parts: ['Area', '=', '?', 'cm²'],
        spoken: `A rectangle is ${w} centimetres by ${h} centimetres. What is its area in square centimetres?`,
        prompt: `A rectangle ${w} cm by ${h} cm`,
        figure: { kind: 'rectangle', width: cm(w), height: cm(h), inside: '?' },
        answer: w * h,
      },
      { 'added the sides': w + h, 'found the perimeter': 2 * (w + h), 'doubled the product': 2 * w * h, 'one row short': w * (h - 1), 'one row too many': w * (h + 1) },
    );
  },
);

/** "Perimeter = ? cm" for a rectangle (two steps). */
const rectPerim = oneKey(
  'formula:rect-perim',
  'Perimeter of a rectangle (6 cm by 4 cm)',
  Y7_FORMULA,
  2,
  (_k, r) => rectRoll(r),
  (_k, [w, h]) => {
    if (!isInt(w, 3, 12) || !isInt(h, 2, 9) || w === h) return null;
    return typed(
      {
        parts: ['Perimeter', '=', '?', 'cm'],
        spoken: `A rectangle is ${w} centimetres by ${h} centimetres. What is its perimeter in centimetres?`,
        prompt: `A rectangle ${w} cm by ${h} cm`,
        figure: { kind: 'rectangle', width: cm(w), height: cm(h), inside: 'Perimeter\n?' },
        answer: 2 * (w + h),
      },
      { 'added two sides only': w + h, 'found the area': w * h, 'added three sides': 2 * w + h, 'doubled the longer side': 2 * Math.max(w, h), 'one side left out': w + 2 * h },
    );
  },
);

function rectRoll(r: () => number): number[] {
  for (;;) {
    const w = int(r, 3, 12);
    const h = int(r, 2, 9);
    if (w !== h) return [w, h];
  }
}

/** "Area = ? cm²" for a triangle from its base and height (two steps). */
const triArea = oneKey(
  'formula:tri-area',
  'Area of a triangle (base 8 cm, height 5 cm)',
  Y7_FORMULA,
  2,
  (_k, r) => {
    for (;;) {
      const b = int(r, 4, 14);
      const h = int(r, 3, 9);
      if ((b * h) % 2 === 0) return [b, h];
    }
  },
  (_k, [b, h]) => {
    if (!isInt(b, 4, 14) || !isInt(h, 3, 9) || (b * h) % 2 !== 0) return null;
    return typed(
      {
        parts: ['Area', '=', '?', 'cm²'],
        spoken: `A triangle has a base of ${b} centimetres and a height of ${h} centimetres. What is its area in square centimetres?`,
        prompt: `A triangle: base ${b} cm, height ${h} cm`,
        figure: { kind: 'triangle-area', base: cm(b), height: cm(h), inside: '?' },
        answer: (b * h) / 2,
      },
      { 'forgot to halve': b * h, 'added them': b + h, 'halved twice': (b * h) / 4, 'doubled it': 2 * b * h, 'halved one and added': b / 2 + h },
    );
  },
);

/** "Volume = ? cm³" for a cube. */
const cubeVol = oneKey(
  'formula:cube-vol',
  'Volume of a cube (3 cm sides)',
  Y7_FORMULA,
  1,
  (_k, r) => [int(r, 2, 6)],
  (_k, [s]) => {
    if (!isInt(s, 2, 6)) return null;
    return typed(
      {
        parts: ['Volume', '=', '?', 'cm³'],
        spoken: `A cube has sides of ${s} centimetres. What is its volume in cubic centimetres?`,
        prompt: `A cube with ${s} cm sides`,
        figure: { kind: 'cuboid', length: cm(s), width: '', height: '', cube: true },
        answer: s ** 3,
      },
      { 'times three': 3 * s, 'squared it': s * s, 'found the surface': 6 * s * s, 'added three sides': s * 3 + 3, 'times two': 2 * s },
    );
  },
);

/** "Volume = ? cm³" for a box: length, width, height (two steps). */
const cuboidVol = oneKey(
  'formula:cuboid-vol',
  'Volume of a box (5 by 3 by 2 cm)',
  Y7_FORMULA,
  3,
  (_k, r) => [int(r, 2, 8), int(r, 2, 5), int(r, 2, 5)],
  (_k, [l, w, h]) => {
    if (!isInt(l, 2, 8) || !isInt(w, 2, 5) || !isInt(h, 2, 5)) return null;
    return typed(
      {
        parts: ['Volume', '=', '?', 'cm³'],
        spoken: `A box is ${l} centimetres long, ${w} centimetres wide and ${h} centimetres high. What is its volume in cubic centimetres?`,
        prompt: `A box: length ${l} cm, width ${w} cm, height ${h} cm`,
        figure: { kind: 'cuboid', length: cm(l), width: cm(w), height: cm(h) },
        answer: l * w * h,
      },
      { 'added the sides': l + w + h, 'only length times width': l * w, 'only width times height': w * h, 'only length times height': l * h, 'times two sides and added': l * w + h },
    );
  },
);

/** "Square, perimeter 36 cm: side = ? cm". */
const squareSide = oneKey(
  'formula:square-side',
  'Side of a square from its perimeter (36 cm)',
  Y7_FORMULA,
  1,
  (_k, r) => [int(r, 2, 12) * 4],
  (_k, [p]) => {
    if (!isInt(p, 8, 48) || p % 4 !== 0) return null;
    const s = p / 4;
    return typed(
      {
        parts: ['Side', '=', '?', 'cm'],
        spoken: `A square has a perimeter of ${p} centimetres. How long is one side in centimetres?`,
        prompt: `A square with a perimeter of ${p} cm`,
        figure: { kind: 'rectangle', width: '?', height: '?', inside: `Perimeter\n${p} cm` },
        answer: s,
      },
      { 'halved it': p / 2, 'gave the perimeter': p, 'divided by 3': p / 3, 'squared the side': s * s, 'took off 4': p - 4 },
    );
  },
);

// ---------------------------------------------------------------- angle-facts (Y7)

const deg = (n: number) => `${n}°`;
const round5 = (r: () => number, lo: number, hi: number) => int(r, lo / 5, hi / 5) * 5;

/** "50° + 60° + ?° = 180°". */
const triThird = oneKey(
  'angle:tri-third',
  'The third angle of a triangle (50°, 60°)',
  Y7_ANGLE,
  2,
  (_k, r) => {
    for (;;) {
      const a = round5(r, 20, 100);
      const b = round5(r, 20, 100);
      if (a + b <= 150) return [a, b];
    }
  },
  (_k, [a, b]) => {
    if (!isInt(a, 20, 100) || !isInt(b, 20, 100) || a % 5 || b % 5 || a + b > 150) return null;
    return typed(
      {
        parts: [deg(a), '+', deg(b), '+', '?°', '=', '180°'],
        spoken: `A triangle has angles of ${a} degrees and ${b} degrees. What is the third angle?`,
        prompt: 'The angles in a triangle',
        figure: { kind: 'triangle', angles: [deg(a), deg(b), '?'] },
        answer: 180 - a - b,
      },
      { 'used 360': 360 - a - b, 'added them': a + b, 'forgot one angle': 180 - a, 'forgot the other angle': 180 - b, 'used 90': 90 - a - b || NaN },
    );
  },
);

/** "115° + ?° = 180°". */
const lineAngle = oneKey(
  'angle:line',
  'Angles on a straight line (115°)',
  Y7_ANGLE,
  1,
  (_k, r) => {
    for (;;) {
      const a = round5(r, 20, 160);
      if (a !== 90) return [a];
    }
  },
  (_k, [a]) => {
    if (!isInt(a, 20, 160) || a % 5 || a === 90) return null;
    return typed(
      {
        parts: [deg(a), '+', '?°', '=', '180°'],
        spoken: `Angles on a straight line: ${a} degrees and what?`,
        prompt: 'Angles on a straight line',
        figure: { kind: 'line', angles: [deg(a), '?'] },
        answer: 180 - a,
      },
      { 'used 360': 360 - a, 'used 90': 90 - a, 'added to 180': 180 + a, 'gave the angle itself': a, 'off by 10': 180 - a + 10 },
    );
  },
);

/** "40° + 75° + ?° = 180°" on a line (three angles). */
const line3 = oneKey(
  'angle:line3',
  'Three angles on a straight line (40°, 75°)',
  Y7_ANGLE,
  2,
  (_k, r) => {
    for (;;) {
      const a = round5(r, 20, 100);
      const b = round5(r, 20, 100);
      if (a + b <= 150) return [a, b];
    }
  },
  (_k, [a, b]) => {
    if (!isInt(a, 20, 100) || !isInt(b, 20, 100) || a % 5 || b % 5 || a + b > 150) return null;
    return typed(
      {
        parts: [deg(a), '+', deg(b), '+', '?°', '=', '180°'],
        spoken: `Angles on a straight line: ${a} degrees, ${b} degrees and what?`,
        prompt: 'Angles on a straight line',
        figure: { kind: 'line', angles: [deg(a), deg(b), '?'] },
        answer: 180 - a - b,
      },
      { 'used 360': 360 - a - b, 'added them': a + b, 'forgot one angle': 180 - a, 'forgot the other angle': 180 - b },
    );
  },
);

/** "130° + 100° + ?° = 360°" round a point. */
const pointAngle = oneKey(
  'angle:point',
  'Angles round a point (130°, 100°)',
  Y7_ANGLE,
  2,
  (_k, r) => {
    for (;;) {
      const a = round5(r, 60, 150);
      const b = round5(r, 60, 150);
      if (a + b <= 280) return [a, b];
    }
  },
  (_k, [a, b]) => {
    if (!isInt(a, 60, 150) || !isInt(b, 60, 150) || a % 5 || b % 5 || a + b > 280) return null;
    return typed(
      {
        parts: [deg(a), '+', deg(b), '+', '?°', '=', '360°'],
        spoken: `Angles round a point: ${a} degrees, ${b} degrees and what?`,
        prompt: 'Angles round a point',
        figure: { kind: 'point', angles: [deg(a), deg(b), '?'] },
        answer: 360 - a - b,
      },
      { 'used 180': 180 - a - b || NaN, 'added them': a + b, 'forgot one angle': 360 - a, 'forgot the other angle': 360 - b, 'off by 10': 360 - a - b + 10 },
    );
  },
);

/** Isosceles triangle: base angles equal, find the top (two steps). */
const isosceles = oneKey(
  'angle:isosceles',
  'Top angle of an isosceles triangle (base angles 70°)',
  Y7_ANGLE,
  1,
  (_k, r) => {
    for (;;) {
      const b = round5(r, 40, 80);
      if (b !== 60) return [b];
    }
  },
  (_k, [b]) => {
    if (!isInt(b, 40, 80) || b % 5 || b === 60) return null;
    return typed(
      {
        parts: [deg(b), '+', deg(b), '+', '?°', '=', '180°'],
        spoken: `An isosceles triangle has two equal base angles of ${b} degrees. What is the top angle?`,
        prompt: 'An isosceles triangle: the base angles are equal',
        figure: { kind: 'triangle', angles: [deg(b), deg(b), '?'], equal: 'two' },
        answer: 180 - 2 * b,
      },
      { 'took off one base angle only': 180 - b, 'used 360': 360 - 2 * b, 'added the base angles': 2 * b, 'used 90': 90 - b, 'gave the base angle': b },
    );
  },
);

// ---------------------------------------------------------------- polygon-angles (Y7)

const POLYGONS: [number, string][] = [[3, 'triangle'], [4, 'square'], [5, 'pentagon'], [6, 'hexagon'], [8, 'octagon'], [9, 'nonagon'], [10, 'decagon'], [12, 'dodecagon']];
const SUM_SIDES = [4, 5, 6, 7, 8, 9, 10, 12];
const polyName = (n: number) => POLYGONS.find(([s]) => s === n)?.[1] ?? { 7: 'heptagon' }[n as 7] ?? `${n}-sided shape`;

/** "Exterior angle of a regular hexagon = ?°". */
const exterior = oneKey(
  'polygon:exterior',
  'Exterior angle of a regular polygon (hexagon)',
  Y7_POLY,
  1,
  (_k, r) => [POLYGONS[int(r, 0, POLYGONS.length - 1)][0]],
  (_k, [n]) => {
    const found = POLYGONS.find(([s]) => s === n);
    if (!found) return null;
    const a = 360 / n;
    return typed(
      {
        parts: ['Exterior angle', '=', '?°'],
        spoken: `What is the exterior angle of a regular ${found[1]} with ${n} sides?`,
        prompt: `A regular ${found[1]} (${n} sides)`,
        figure: { kind: 'polygon', sides: n, label: '?' },
        answer: a,
      },
      { 'found the inside angle': 180 - a, 'found the angle sum': (n - 2) * 180, 'divided 180 by the sides': 180 / n, 'gave the number of sides': n, 'one side too many': 360 / (n + 1), 'one side too few': 360 / (n - 1) },
    );
  },
);

/** "Angle sum = ?°": the inside angles of a polygon (two steps). */
const interiorSum = oneKey(
  'polygon:sum',
  'Interior angle sum of a polygon (pentagon)',
  Y7_POLY,
  1,
  (_k, r) => [SUM_SIDES[int(r, 0, SUM_SIDES.length - 1)]],
  (_k, [n]) => {
    if (!SUM_SIDES.includes(n)) return null;
    const name = polyName(n);
    return typed(
      {
        parts: ['Angle sum', '=', '?°'],
        spoken: `What do the inside angles of a ${name} with ${n} sides add up to?`.replace(' a octagon', ' an octagon'),
        prompt: `Inside angles of ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name} (${n} sides)`,
        figure: { kind: 'polygon', sides: n, label: '' },
        answer: (n - 2) * 180,
      },
      { 'sides times 180': n * 180, 'one triangle too many': (n - 1) * 180, 'one triangle too few': (n - 3) * 180, 'sides times 90': n * 90, 'gave the outside angles': 360, 'took 2 off after': n * 180 - 2 },
    );
  },
);

// ---------------------------------------------------------------- compass-degrees (Y7)

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const POINT_SAY = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** "N to SE clockwise = ?°". */
const turn = oneKey(
  'compass:turn',
  'Turning clockwise between compass points (N to SE)',
  Y7_COMPASS,
  2,
  (_k, r) => [int(r, 0, 7), int(r, 1, 7)],
  (_k, [from, steps]) => {
    if (!isInt(from, 0, 7) || !isInt(steps, 1, 7)) return null;
    const to = (from + steps) % 8;
    const a = steps * 45;
    return typed(
      {
        parts: [POINTS[from], 'to', POINTS[to], '=', '?°'],
        spoken: `Turning clockwise from ${POINT_SAY[from]} to ${POINT_SAY[to]} is how many degrees?`,
        prompt: 'Turn clockwise',
        figure: { kind: 'compass', from: POINTS[from], to: POINTS[to] },
        answer: a,
      },
      { 'turned anticlockwise': 360 - a, 'counted the points': steps, 'one point too far': a + 45, 'one point short': a - 45, 'used 90 a point': steps * 90 },
    );
  },
);

/** "NE is ?° from N". */
const fromN = oneKey(
  'compass:from-n',
  'Compass point in degrees from north (NE is 45°)',
  Y7_COMPASS,
  1,
  (_k, r) => [int(r, 1, 7)],
  (_k, [k]) => {
    if (!isInt(k, 1, 7)) return null;
    const a = k * 45;
    return typed(
      {
        parts: [POINTS[k], 'is', '?°', 'from', 'N'],
        spoken: `${POINT_SAY[k]} is how many degrees clockwise from north?`,
        prompt: 'Turn clockwise from north',
        figure: { kind: 'compass', from: 'N', to: POINTS[k] },
        answer: a,
      },
      { 'turned anticlockwise': 360 - a, 'counted the points': k, 'one point too far': a + 45, 'one point short': a - 45, 'used 90 a point': k * 90 },
    );
  },
);

// ---------------------------------------------------------------- metric-area-volume (Y8)

/** "1 m² = ? cm²" and the like: the unit pair's factor times a small number. */
function unitPair(key: string, label: string, from: string, to: string, factor: number, nums: number[], named: (n: number) => Named): Family {
  return oneKey(
    key,
    label,
    Y8_UNITS,
    1,
    (_k, r) => [nums[int(r, 0, nums.length - 1)]],
    (_k, [n]) => {
      if (!nums.includes(n)) return null;
      return typed({ parts: [`${n} ${from}`, '=', '?', to], spoken: talk([`${n} ${from}`, '=', '?', to]), answer: n * factor }, named(n));
    },
  );
}

const cm2 = unitPair('unitsq:cm2', 'Square centimetres to square millimetres', 'cm²', 'mm²', 100, [1, 2, 3, 5, 10], (n) => ({ 'used 10': n * 10, 'one zero too many': n * 1000, 'two zeros too many': n * 10000, 'forgot to convert': n }));
const m2 = unitPair('unitsq:m2', 'Square metres to square centimetres', 'm²', 'cm²', 10000, [1, 2, 3, 5], (n) => ({ 'used 100': n * 100, 'used 1000': n * 1000, 'one zero too many': n * 100000, 'forgot to convert': n }));
const mlCm3 = unitPair('unitsq:ml-cm3', 'Millilitres to cubic centimetres', 'mL', 'cm³', 1, [1, 2, 5, 10, 25, 50, 250, 500], (n) => ({ 'times 10': n * 10, 'times 100': n * 100, 'times 1000': n * 1000, 'one more': n + 1 }));
const lCm3 = unitPair('unitsq:l-cm3', 'Litres to cubic centimetres', 'L', 'cm³', 1000, [1, 2, 3, 5], (n) => ({ 'used 100': n * 100, 'used 10': n * 10, 'one zero too many': n * 10000, 'forgot to convert': n }));
const m3L = unitPair('unitsq:m3-l', 'Cubic metres to litres', 'm³', 'L', 1000, [1, 2, 3, 5], (n) => ({ 'used 100': n * 100, 'used 10000': n * 10000, 'used a million': n * 1000000, 'forgot to convert': n }));

// ---------------------------------------------------------------- circle-parts (Y8)

/** "Radius 7 cm: diameter = ? cm". */
const diameter = oneKey(
  'circle:diam',
  'Diameter from the radius (radius 7)',
  Y8_CIRCLE,
  1,
  (_k, r) => [int(r, 2, 25)],
  (_k, [rad]) => {
    if (!isInt(rad, 2, 25)) return null;
    return typed(
      {
        parts: ['Diameter', '=', '?', 'cm'],
        spoken: `A circle has a radius of ${rad} centimetres. What is its diameter in centimetres?`,
        prompt: `A circle with radius ${rad} cm`,
        figure: { kind: 'circle', radius: cm(rad), diameter: '?' },
        answer: 2 * rad,
      },
      { 'halved it': rad / 2, 'squared it': rad * rad, 'added 2': rad + 2, 'times three': 3 * rad, 'gave the radius': rad },
    );
  },
);

/** "Diameter 18 cm: radius = ? cm". */
const radius = oneKey(
  'circle:radius',
  'Radius from the diameter (diameter 18)',
  Y8_CIRCLE,
  1,
  (_k, r) => [int(r, 2, 25) * 2],
  (_k, [d]) => {
    if (!isInt(d, 4, 50) || d % 2 !== 0) return null;
    return typed(
      {
        parts: ['Radius', '=', '?', 'cm'],
        spoken: `A circle has a diameter of ${d} centimetres. What is its radius in centimetres?`,
        prompt: `A circle with diameter ${d} cm`,
        figure: { kind: 'circle', radius: '?', diameter: cm(d) },
        answer: d / 2,
      },
      { 'doubled it': 2 * d, 'quartered it': d / 4, 'took off 2': d - 2, 'added 2': d + 2, 'gave the diameter': d },
    );
  },
);

// ---------------------------------------------------------------- the lot

export const MEASURE_FAMILIES: Record<string, Family> = Object.fromEntries(
  [
    kmM, lMl, mmCm, cmM, gKg,
    fracH, hMin, minH,
    rectArea, rectPerim, triArea, cubeVol, cuboidVol, squareSide,
    triThird, lineAngle, line3, pointAngle, isosceles,
    exterior, interiorSum,
    turn, fromN,
    cm2, m2, mlCm3, lCm3, m3L,
    diameter, radius,
  ].map((f) => [f.keys[0], f]),
);

export const MEASURE_SKILL_KEYS = {
  metric: ['metric:km-m', 'metric:l-ml', 'metric:mm-cm', 'metric:cm-m', 'metric:g-kg'],
  'time-convert': ['mtime:frac-h', 'mtime:h-min', 'mtime:min-h'],
  formulas: ['formula:rect-area', 'formula:rect-perim', 'formula:tri-area', 'formula:cube-vol', 'formula:cuboid-vol', 'formula:square-side'],
  'angle-facts': ['angle:tri-third', 'angle:line', 'angle:line3', 'angle:point', 'angle:isosceles'],
  'polygon-angles': ['polygon:exterior', 'polygon:sum'],
  'compass-degrees': ['compass:turn', 'compass:from-n'],
  'metric-area-volume': ['unitsq:cm2', 'unitsq:m2', 'unitsq:ml-cm3', 'unitsq:l-cm3', 'unitsq:m3-l'],
  'circle-parts': ['circle:diam', 'circle:radius'],
};

/** The two-step types: 12 seconds to count as quick. */
export const MEASURE_SLOW_KEYS: string[] = ['mtime:h-min', 'mtime:min-h', 'formula:rect-perim', 'formula:tri-area', 'formula:cuboid-vol', 'angle:isosceles', 'polygon:sum'];

export const MEASURE_LADDER: { id: keyof typeof MEASURE_SKILL_KEYS; label: string; tiny: string; stage: 'measurement-geometry'; year: 7 | 8; tags: string[] }[] = [
  { id: 'metric', label: 'Metric conversions (3.5 km in m)', tiny: 'Metric units', stage: 'measurement-geometry', year: 7, tags: Y7_METRIC },
  { id: 'time-convert', label: 'Time conversions (2 h 15 min in min)', tiny: 'Hours and minutes', stage: 'measurement-geometry', year: 7, tags: Y7_TIME },
  { id: 'formulas', label: 'Area, perimeter and volume formulas', tiny: 'Area and volume', stage: 'measurement-geometry', year: 7, tags: Y7_FORMULA },
  { id: 'angle-facts', label: 'Missing angles', tiny: 'Missing angles', stage: 'measurement-geometry', year: 7, tags: Y7_ANGLE },
  { id: 'polygon-angles', label: 'Angles in polygons', tiny: 'Polygon angles', stage: 'measurement-geometry', year: 7, tags: Y7_POLY },
  { id: 'compass-degrees', label: 'Compass points in degrees', tiny: 'Compass degrees', stage: 'measurement-geometry', year: 7, tags: Y7_COMPASS },
  { id: 'metric-area-volume', label: 'Area and volume units (1 m² in cm²)', tiny: 'Area, volume units', stage: 'measurement-geometry', year: 8, tags: Y8_UNITS },
  { id: 'circle-parts', label: 'Radius and diameter', tiny: 'Radius, diameter', stage: 'measurement-geometry', year: 8, tags: Y8_CIRCLE },
];
