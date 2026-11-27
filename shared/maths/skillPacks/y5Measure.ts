/**
 * Year 5 card (Measure), docs/plans/ladder-y5/PLAN.md. Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 *
 * Fluency only: one typed number or one tap of four in about 8 seconds, friendly numbers. Nothing here is two-step, so
 * Y5_MEASURE_SLOW_KEYS is empty.
 *
 * Types:
 *   perimeter    : per5:sq  per5:rect  per5:reg
 *   angle-types  : ang5:size  ang5:pic  ang5:clue
 *   metric-mm-km : mmkm5:down  mmkm5:up  mmkm5:half
 *   compass-4    : comp5:quarter  comp5:half  comp5:three
 *   clock-read   : clock5:read  clock5:words
 */
import { int, isInt, tidy, type Family, type Made } from '../banded';
import type { Figure, ShapeName } from '../figure';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { goodPick, pick, rollPick } from './pickKit';
import type { Y6Row } from './y6Row';

const PERIMETER_TAGS = ['MS.Y5.MEA.M.P1'];
const ANGLE_TAGS = ['MS.Y5.MEA.M.P2'];
const METRIC_TAGS = ['MS.Y5.MEA.M.P3'];
const COMPASS_TAGS = ['MS.Y5.MEA.M.P4'];
const CLOCK_TAGS = ['MS.Y5.MEA.M.P5'];

const show = (n: number) => String(tidy(n));
const twoDp = (n: number) => Math.round(n * 100) / 100 === n;
const pad = (n: number) => String(n).padStart(2, '0');

/** A typed question: decimal pad when the answer isn't whole. Null when fewer than three named mistakes are left. */
function typed(base: { parts: string[]; spoken: string; answer: number; prompt?: string; figure?: Figure }, named: Named): Made | null {
  const answer = tidy(base.answer);
  return withMistakes({ ...base, answer, ...(Number.isInteger(answer) ? {} : { input: 'decimal' as const }) }, named, { ok: twoDp });
}

/** A pick question with a prompt and (optionally) a picture. */
function tap(made: Made | null, extra: { prompt?: string; figure?: Figure }): Made | null {
  return made && { ...made, ...extra };
}

// ---------------------------------------------------------------- perimeter

/** "Square, side 7 cm: perimeter = ? cm". */
const sq = oneKey(
  'per5:sq',
  'Perimeter of a square (side 7 cm)',
  PERIMETER_TAGS,
  1,
  (_k, r) => [int(r, 2, 12)],
  (_k, [s]) => {
    if (!isInt(s, 2, 12)) return null;
    return typed(
      {
        parts: [`Square, side ${s} cm`, 'perimeter', '=', '?', 'cm'],
        spoken: `A square has sides of ${s} centimetres. What is its perimeter in centimetres?`,
        figure: { kind: 'shape', name: 'square', side: `${s} cm` },
        answer: 4 * s,
      },
      { 'added two sides': 2 * s, 'counted three sides': 3 * s, 'found the area': s * s, 'added four to the side': s + 4, 'five sides': 5 * s },
    );
  },
);

/** "Rectangle 6 cm by 4 cm: perimeter = ? cm". */
const rect = oneKey(
  'per5:rect',
  'Perimeter of a rectangle (6 cm by 4 cm)',
  PERIMETER_TAGS,
  2,
  (_k, r) => {
    for (;;) {
      const w = int(r, 2, 10);
      const h = int(r, 2, 10);
      if (w > h) return [w, h];
    }
  },
  (_k, [w, h]) => {
    if (!isInt(w, 3, 10) || !isInt(h, 2, 9) || w <= h) return null;
    return typed(
      {
        parts: [`Rectangle ${w} cm by ${h} cm`, 'perimeter', '=', '?', 'cm'],
        spoken: `A rectangle is ${w} centimetres by ${h} centimetres. What is its perimeter in centimetres?`,
        figure: { kind: 'rectangle', width: `${w} cm`, height: `${h} cm`, inside: '' },
        answer: 2 * (w + h),
      },
      { 'added two sides': w + h, 'found the area': w * h, 'doubled one side only': 2 * w + h, 'doubled the other side only': w + 2 * h, 'doubled the area': 2 * w * h },
    );
  },
);

/** [sides, name for the screen, name for the picture]. */
const REGULAR: [number, string, ShapeName][] = [
  [3, 'Equilateral triangle', 'equilateral'],
  [5, 'Regular pentagon', 'pentagon'],
  [6, 'Regular hexagon', 'hexagon'],
  [8, 'Regular octagon', 'octagon'],
];

/** "Regular hexagon, side 5 cm: perimeter = ? cm": the number of sides times the side. */
const reg = oneKey(
  'per5:reg',
  'Perimeter of a regular shape (hexagon, side 5 cm)',
  PERIMETER_TAGS,
  2,
  (_k, r) => [int(r, 0, 3), int(r, 2, 10)],
  (_k, [i, s]) => {
    if (!isInt(i, 0, 3) || !isInt(s, 2, 10)) return null;
    const [n, name, fig] = REGULAR[i];
    return typed(
      {
        parts: [`${name}, side ${s} cm`, 'perimeter', '=', '?', 'cm'],
        spoken: `A ${name.toLowerCase()} has sides of ${s} centimetres. What is its perimeter in centimetres?`,
        figure: { kind: 'shape', name: fig, side: `${s} cm` },
        answer: n * s,
      },
      { 'counted one side too few': (n - 1) * s, 'counted one side too many': (n + 1) * s, 'added the sides to the side': n + s, 'found the side squared': s * s, 'added two sides': 2 * s },
    );
  },
);

// ---------------------------------------------------------------- angle-types

const KINDS = ['acute', 'right', 'obtuse', 'straight', 'reflex'] as const;
type Kind = (typeof KINDS)[number];
const ANGLE_VALUES: Record<Kind, number[]> = {
  acute: [20, 30, 40, 50, 60, 70],
  right: [90],
  obtuse: [110, 120, 130, 140, 150, 160],
  straight: [180],
  reflex: [200, 210, 220, 240, 250, 270, 300, 330],
};
const kindOf = (deg: number): Kind | null => KINDS.find((k) => ANGLE_VALUES[k].includes(deg)) ?? null;

function rollAngle(r: () => number): number {
  const k = KINDS[int(r, 0, 4)];
  const list = ANGLE_VALUES[k];
  return list[int(r, 0, list.length - 1)];
}

/** The other kinds as the slips a pupil makes with the right one (every one of the four others is a real mix-up). */
function kindSlips(right: Kind): Record<string, string> {
  const named: Record<string, string> = {};
  const order = KINDS.map((k, i) => [k, Math.abs(i - KINDS.indexOf(right))] as const)
    .filter(([k]) => k !== right)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
  for (const k of order) named[`mixed up ${right} with ${k}`] = k;
  return named;
}

function kindQuestion(deg: number, slot: number, salt: number, parts: string[], spoken: string, prompt: string, figure?: Figure): Made | null {
  const right = kindOf(deg);
  if (!right || !goodPick(slot, salt)) return null;
  const made = pick({ parts, spoken, fact: `${parts.slice(0, -1).join(' ')} is ${right}` }, right, kindSlips(right), { slot, salt });
  return tap(made, { prompt, ...(figure ? { figure } : {}) });
}

/** "An angle of 130° is ?": from the size alone. */
const size = oneKey(
  'ang5:size',
  'Kind of angle from its size (130°)',
  ANGLE_TAGS,
  3,
  (_k, r) => [rollAngle(r), ...rollPick(r)],
  (_k, [deg, slot, salt]) =>
    kindQuestion(deg, slot, salt, [`An angle of ${deg}°`, 'is', '?'], `An angle of ${deg} degrees is what kind of angle?`, 'What kind of angle is it?'),
);

/** A picture of the angle, and its size in the parts too. */
const pic = oneKey(
  'ang5:pic',
  'Kind of angle from a picture (130°)',
  ANGLE_TAGS,
  3,
  (_k, r) => [rollAngle(r), ...rollPick(r)],
  (_k, [deg, slot, salt]) =>
    kindQuestion(deg, slot, salt, [`This ${deg}° angle`, 'is', '?'], `This angle is ${deg} degrees. What kind of angle is it?`, 'What kind of angle is this?', { kind: 'angle', degrees: deg }),
);

const CLUES: Record<Kind, string> = {
  acute: 'Less than 90°',
  right: 'Exactly 90°',
  obtuse: 'Between 90° and 180°',
  straight: 'Exactly 180°',
  reflex: 'More than 180°',
};

/** "Between 90° and 180°: ?": the rule for each kind. */
const clue = oneKey(
  'ang5:clue',
  'Kind of angle from its size rule (between 90° and 180°)',
  ANGLE_TAGS,
  3,
  (_k, r) => [int(r, 0, 4), ...rollPick(r)],
  (_k, [k, slot, salt]) => {
    if (!isInt(k, 0, 4) || !goodPick(slot, salt)) return null;
    const right = KINDS[k];
    const made = pick(
      { parts: [CLUES[right], 'is', '?'], spoken: `An angle that is ${CLUES[right].replace(/°/g, ' degrees').toLowerCase()} is what kind of angle?`, fact: `${CLUES[right]} is ${right}` },
      right,
      kindSlips(right),
      { slot, salt },
    );
    return tap(made, { prompt: 'What kind of angle is it?' });
  },
);

// ---------------------------------------------------------------- metric-mm-km

/** [big unit, small unit, small units in one big unit]. */
const UNITS: [string, string, number][] = [['cm', 'mm', 10], ['m', 'cm', 100], ['km', 'm', 1000]];
const SAY: Record<string, string> = { mm: 'millimetres', cm: 'centimetres', m: 'metres', km: 'kilometres' };

/** "4 cm = ? mm": a whole number of the big unit in the small one. */
const down = oneKey(
  'mmkm5:down',
  'Big unit to small unit (4 cm in mm)',
  METRIC_TAGS,
  2,
  (_k, r) => {
    const u = int(r, 0, 2);
    return [u, int(r, 2, u === 0 ? 12 : 9)];
  },
  (_k, [u, k]) => {
    if (!isInt(u, 0, 2) || !isInt(k, 2, u === 0 ? 12 : 9)) return null;
    const [bigU, little, per] = UNITS[u];
    const a = k * per;
    return typed(
      { parts: [`${k} ${bigU}`, '=', '?', little], spoken: `${k} ${SAY[bigU]} equals how many ${SAY[little]}?`, answer: a },
      { 'one zero too few': a / 10, 'one zero too many': a * 10, 'forgot to convert': k, 'used 10': k * 10, 'used 100': k * 100, 'used 1000': k * 1000 },
    );
  },
);

/** "30 mm = ? cm": tidy multiples of the unit, asked in the bigger one. */
const up = oneKey(
  'mmkm5:up',
  'Small unit to big unit (30 mm in cm)',
  METRIC_TAGS,
  2,
  (_k, r) => [int(r, 0, 2), int(r, 2, 9)],
  (_k, [u, k]) => {
    if (!isInt(u, 0, 2) || !isInt(k, 2, 9)) return null;
    const [bigU, little, per] = UNITS[u];
    const v = k * per;
    return typed(
      { parts: [`${v} ${little}`, '=', '?', bigU], spoken: `${v} ${SAY[little]} equals how many ${SAY[bigU]}?`, answer: k },
      { 'forgot to convert': v, 'one zero too many': k * 10, 'two zeros too many': k * 100, 'divided by ten only': v / 10, 'divided by a hundred only': v / 100, 'three zeros too many': k * 1000 },
    );
  },
);

/** "250 cm = ? m" (2.5), or "2.5 m = ? cm" (250): halves. */
const half = oneKey(
  'mmkm5:half',
  'Halves between units (250 cm in m)',
  METRIC_TAGS,
  3,
  (_k, r) => [int(r, 0, 2), int(r, 0, 8), int(r, 0, 1)],
  (_k, [u, k, dir]) => {
    if (!isInt(u, 0, 2) || !isInt(k, 0, 8) || !isInt(dir, 0, 1)) return null;
    const [bigU, little, per] = UNITS[u];
    const b = k + 0.5;
    const v = b * per;
    if (dir === 0) {
      return typed(
        { parts: [`${v} ${little}`, '=', '?', bigU], spoken: `${v} ${SAY[little]} equals how many ${SAY[bigU]}?`, answer: b },
        { 'forgot to convert': v, 'one zero too many': b * 10, 'one zero too few': b / 10, 'ignored the half': k, 'rounded the half up': k + 1 },
      );
    }
    return typed(
      { parts: [`${show(b)} ${bigU}`, '=', '?', little], spoken: `${show(b)} ${SAY[bigU]} equals how many ${SAY[little]}?`, answer: v },
      { 'one zero too many': v * 10, 'one zero too few': v / 10, 'ignored the half': k * per, 'rounded the half up': (k + 1) * per, 'two zeros too many': v * 100 },
    );
  },
);

// ---------------------------------------------------------------- compass-4

const DIRS = ['north', 'east', 'south', 'west'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Quarter turns clockwise, 0 to 3, and how a pupil would have turned instead. */
const TURN_SLIP = ['did not turn', 'turned a quarter turn clockwise', 'turned a half turn', 'turned a quarter turn anticlockwise'];

/** The pick question for a start direction and a number of clockwise quarter turns (3 is one quarter turn anticlockwise). */
function compass(start: number, turns: number, turn: string, slot: number, salt: number): Made | null {
  const right = DIRS[(start + turns) % 4];
  // Plain words, and always which way round (James, 27 Nov 2026: "Face north, half turn: ?" left him asking "turn half which way?").
  const parts = [`You face ${DIRS[start]}.`, `You make ${turn}.`];
  const spoken = `${parts.join(' ')} Which way are you facing now?`;
  const named: Record<string, string> = {};
  for (let t = 0; t < 4; t++) if (t !== turns) named[`${TURN_SLIP[t]} instead`] = DIRS[(start + t) % 4];
  const made = pick({ parts, spoken, fact: `${cap(DIRS[start])} then ${turn} is ${right}` }, right, named, { slot, salt });
  // A compass with an arrow the way you face at the start (James, 26 Nov 2026: he couldn't answer it from words alone).
  return tap(made, { prompt: 'Which way are you facing now?', figure: { kind: 'compass', from: 'NESW'[start] } });
}

/** "You face east. You make a quarter turn clockwise." */
const quarter = oneKey(
  'comp5:quarter',
  'Quarter turn from a compass point (face east, quarter turn clockwise)',
  COMPASS_TAGS,
  4,
  (_k, r) => [int(r, 0, 3), int(r, 0, 1), ...rollPick(r)],
  (_k, [s, anti, slot, salt]) => {
    if (!isInt(s, 0, 3) || !isInt(anti, 0, 1) || !goodPick(slot, salt)) return null;
    const way = anti ? 'anticlockwise' : 'clockwise';
    return compass(s, anti ? 3 : 1, `a quarter turn ${way}`, slot, salt);
  },
);

/** "You face south. You make a half turn clockwise." */
const halfTurn = oneKey(
  'comp5:half',
  'Half turn from a compass point (face south, half turn)',
  COMPASS_TAGS,
  3,
  (_k, r) => [int(r, 0, 3), ...rollPick(r)],
  (_k, [s, slot, salt]) => {
    if (!isInt(s, 0, 3) || !goodPick(slot, salt)) return null;
    return compass(s, 2, 'a half turn clockwise', slot, salt);
  },
);

/** "You face west. You make 3 quarter turns clockwise." */
const three = oneKey(
  'comp5:three',
  'Three quarter turns from a compass point (face west, three quarter turns)',
  COMPASS_TAGS,
  4,
  (_k, r) => [int(r, 0, 3), int(r, 0, 1), ...rollPick(r)],
  (_k, [s, anti, slot, salt]) => {
    if (!isInt(s, 0, 3) || !isInt(anti, 0, 1) || !goodPick(slot, salt)) return null;
    const way = anti ? 'anticlockwise' : 'clockwise';
    return compass(s, anti ? 1 : 3, `3 quarter turns ${way}`, slot, salt);
  },
);

// ---------------------------------------------------------------- clock-read

const wrap12 = (h: number) => ((h - 1 + 12) % 12) + 1;
const clockTime = (h: number, m: number) => `${h}:${pad(m)}`;
const CLOCK_PROMPT = 'What time does the clock show?';

/** "Short hand between 7 and 8, long hand on 5: ?": a time to the nearest five minutes. */
const read = oneKey(
  'clock5:read',
  'Read a clock to five minutes (7:25)',
  CLOCK_TAGS,
  4,
  (_k, r) => [int(r, 1, 12), int(r, 1, 11), ...rollPick(r)],
  (_k, [h, f, slot, salt]) => {
    if (!isInt(h, 1, 12) || !isInt(f, 1, 11) || !goodPick(slot, salt)) return null;
    const m = f * 5;
    const next = wrap12(h + 1);
    const right = clockTime(h, m);
    const parts = [`Short hand between ${h} and ${next},`, `long hand on ${f}:`, '?'];
    const made = pick(
      {
        parts,
        spoken: `The short hand is between ${h} and ${next}. The long hand is on the ${f}. What time does the clock show?`,
        fact: `Short hand between ${h} and ${next}, long hand on ${f} is ${right}`,
      },
      right,
      {
        'swapped the two hands': clockTime(wrap12(f), (h * 5) % 60),
        'read the hour as the next one': clockTime(next, m),
        'read the minute hand number as minutes': clockTime(h, f),
        'read the other side of the clock': clockTime(h, 60 - m),
        'forgot the minutes': clockTime(h, 0),
      },
      { slot, salt },
    );
    return tap(made, { prompt: CLOCK_PROMPT, figure: { kind: 'clock', hour: h, minute: m } });
  },
);

/** Quarter-hour words: [minute, the short hand in words, the long hand number]. */
const WORD_TIMES = [0, 15, 30, 45];

/** "Short hand just past 7, long hand on 3: ?" with "quarter past 7" among the choices. */
const words = oneKey(
  'clock5:words',
  "Read a clock in words (quarter past 7, half past 7, 7 o'clock)",
  CLOCK_TAGS,
  4,
  (_k, r) => [int(r, 1, 12), int(r, 0, 3), ...rollPick(r)],
  (_k, [h, q, slot, salt]) => {
    if (!isInt(h, 1, 12) || !isInt(q, 0, 3) || !goodPick(slot, salt)) return null;
    const next = wrap12(h + 1);
    const label = [`${h} o'clock`, `quarter past ${h}`, `half past ${h}`, `quarter to ${next}`];
    const short = [`Short hand on ${h},`, `Short hand just past ${h},`, `Short hand halfway ${h} to ${next},`, `Short hand nearly at ${next},`][q];
    const long = WORD_TIMES[q] / 5;
    const right = label[q];
    const named: Record<string, string>[] = [
      { 'read the 12 as a 6': `half past ${h}`, 'read the 12 as a 3': `quarter past ${h}`, 'read the hour as the next one': `${next} o'clock`, 'read the 12 as a 9': `quarter to ${h}` },
      { 'mixed up past and to': `quarter to ${h}`, 'read the hour as the next one': `quarter past ${next}`, 'read the 3 as a 6': `half past ${h}`, 'forgot the minutes': `${h} o'clock` },
      { 'read the hour as the next one': `half past ${next}`, 'read the 6 as a 3': `quarter past ${h}`, 'read the 6 as a 9': `quarter to ${next}`, 'forgot the minutes': `${h} o'clock` },
      { 'mixed up past and to': `quarter past ${next}`, 'used the hour the short hand left': `quarter to ${h}`, 'read the 9 as a 3': `quarter past ${h}`, 'forgot the minutes': `${next} o'clock` },
    ];
    const made = pick(
      {
        parts: [short, `long hand on ${long === 0 ? 12 : long}:`, '?'],
        spoken: `${short.replace(/,$/, '')}. The long hand is on the ${long === 0 ? 12 : long}. What time does the clock show?`,
        fact: `${short} long hand on ${long === 0 ? 12 : long} is ${right}`,
      },
      right,
      named[q],
      { slot, salt },
    );
    return tap(made, { prompt: CLOCK_PROMPT, figure: { kind: 'clock', hour: q === 3 ? next : h, minute: WORD_TIMES[q] } });
  },
);

// ---------------------------------------------------------------- exports

export const Y5_MEASURE_FAMILIES: Record<string, Family> = {
  'per5:sq': sq,
  'per5:rect': rect,
  'per5:reg': reg,
  'ang5:size': size,
  'ang5:pic': pic,
  'ang5:clue': clue,
  'mmkm5:down': down,
  'mmkm5:up': up,
  'mmkm5:half': half,
  'comp5:quarter': quarter,
  'comp5:half': halfTurn,
  'comp5:three': three,
  'clock5:read': read,
  'clock5:words': words,
};

export const Y5_MEASURE_SKILL_KEYS: Record<string, readonly string[]> = {
  perimeter: ['per5:sq', 'per5:rect', 'per5:reg'],
  'angle-types': ['ang5:size', 'ang5:pic', 'ang5:clue'],
  'metric-mm-km': ['mmkm5:down', 'mmkm5:up', 'mmkm5:half'],
  'compass-4': ['comp5:quarter', 'comp5:half', 'comp5:three'],
  'clock-read': ['clock5:read', 'clock5:words'],
};

/** Every type is one step: none needs the longer 12 seconds. */
export const Y5_MEASURE_SLOW_KEYS: string[] = [];

export const Y5_MEASURE_LADDER: readonly Y6Row[] = [
  { id: 'perimeter', label: 'Perimeter of squares, rectangles and regular shapes', tiny: 'Perimeter', stage: 'measurement-geometry', after: 'round-big', tags: PERIMETER_TAGS, year: 5 },
  { id: 'angle-types', label: 'Kinds of angles (acute, right, obtuse, reflex)', tiny: 'Kinds of angles', stage: 'measurement-geometry', after: 'perimeter', tags: ANGLE_TAGS, year: 5 },
  { id: 'metric-mm-km', label: 'Millimetres, centimetres, metres and kilometres', tiny: 'mm, cm, m, km', stage: 'measurement-geometry', after: 'angle-types', tags: METRIC_TAGS, year: 5 },
  { id: 'compass-4', label: 'Compass points and quarter turns', tiny: 'Compass turns', stage: 'measurement-geometry', after: 'metric-mm-km', tags: COMPASS_TAGS, year: 5 },
  { id: 'clock-read', label: 'Telling the time on a clock face', tiny: 'Read a clock', stage: 'measurement-geometry', after: 'compass-4', tags: CLOCK_TAGS, year: 5 },
];
