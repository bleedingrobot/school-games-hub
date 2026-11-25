/**
 * Year 6 ladder skills: Negative numbers and time (docs/plans/ladder-y6/PLAN.md). Built the way docs/plans/ladder-7-8/BUILD-SPEC.md says.
 *
 * James: fluency, not working out. So counting through zero is in 1s, 2s, 5s and 10s, and every time question uses round times
 * (5-minute marks), half and whole hours, and small gaps. Negative answers are taps (`signed`), the rest are typed.
 *
 * Types:
 *   count-zero  cz:back  cz:on  cz:temp
 *   time-y6     tunit:hmin  tunit:mins  tunit:minh
 *   time-24     t24:to12  t24:to24
 *   elapsed     elap:tohour  elap:gap
 */
import { int, isInt, tidy, type Family, type Made } from '../banded';
import { oneKey, withMistakes, type Named } from './generatedKit';
import { pick, rollPick, goodPick } from './pickKit';
import { signed, signedText } from './integerSkills';
import type { Y6Row } from './y6Row';

const NS = ['MS.Y6.NUM.NS.P7'];
const MEASURE = ['MS.Y6.MEA.M.P9'];
const H24 = ['MS.Y6.MEA.M.P10'];
const ELAPSED = ['MS.Y6.MEA.M.P11'];

/** Spoken numbers: no minus sign. */
const sayInt = (n: number) => (n < 0 ? `negative ${-n}` : String(n));
const typed = (base: Omit<Made, 'wrong' | 'named'>, named: Named) => withMistakes({ ...base, answer: tidy(base.answer) }, named);
const pad = (n: number) => String(n).padStart(2, '0');

// ---------------------------------------------------------------- count-zero

const STEPS = [1, 2, 5, 10];

/** "4, 2, 0, ?": counting back in 1s, 2s, 5s or 10s across zero (tap −2). */
const back = oneKey(
  'cz:back',
  'Counting back through zero (4, 2, 0, ?)',
  NS,
  5,
  (_k, r) => {
    const si = int(r, 0, 3);
    return [si, int(r, 1, 2), si === 1 ? int(r, 0, 1) : 0, ...rollPick(r)];
  },
  (_k, [si, m, o, slot, salt]) => {
    if (!isInt(si, 0, 3) || !isInt(m, 1, 2) || !isInt(o, 0, 1) || (o === 1 && si !== 1)) return null;
    const s = STEPS[si];
    const a = -m * s + o;
    const shown = [a + 3 * s, a + 2 * s, a + s].map(signedText);
    const parts = [`${shown[0]},`, `${shown[1]},`, `${shown[2]},`, '?'];
    const spoken = `Count back in ${s}s: ${[a + 3 * s, a + 2 * s, a + s].map(sayInt).join(', ')}, what comes next?`;
    return signed({ parts, spoken, prompt: 'Count back.' }, a, { 'forgot the minus': -a, 'stopped at zero': 0, 'one step too far': a - s, 'repeated the last number': a + s }, slot, salt);
  },
);

/** "−7, −5, −3, ?": counting on from below zero (tap −1, or type a number above zero). */
const on = oneKey(
  'cz:on',
  'Counting on from below zero (−7, −5, −3, ?)',
  NS,
  5,
  (_k, r) => {
    for (;;) {
      const si = int(r, 0, 3);
      const k = [1, 2, 4, 5][int(r, 0, 3)];
      if (k * STEPS[si] > 20) continue;
      return [si, k, si === 1 ? int(r, 0, 1) : 0, ...rollPick(r)];
    }
  },
  (_k, [si, k, o, slot, salt]) => {
    if (!isInt(si, 0, 3) || ![1, 2, 4, 5].includes(k) || !isInt(o, 0, 1) || (o === 1 && si !== 1)) return null;
    const s = STEPS[si];
    if (k * s > 20) return null;
    const t0 = -k * s + o;
    const a = t0 + 3 * s;
    const parts = [t0, t0 + s, t0 + 2 * s].map((n) => `${signedText(n)},`).concat('?');
    const spoken = `Count on in ${s}s: ${[t0, t0 + s, t0 + 2 * s].map(sayInt).join(', ')}, what comes next?`;
    return signed({ parts, spoken, prompt: 'Count on.' }, a, { 'forgot the minus': Math.abs(a), 'stopped at zero': 0, 'one step too far': a + s, 'repeated the last number': a - s, 'two steps too far': a + 2 * s, 'one too many': a + 1 }, slot, salt);
  },
);

/** "It is 3°C. It gets 5° colder.": the temperature now (tap −2), or warmer from below zero. */
const temp = oneKey(
  'cz:temp',
  'Temperature across zero (3° and 5° colder)',
  NS,
  5,
  (_k, r) => {
    for (;;) {
      const warm = int(r, 0, 1);
      const a = int(r, 1, warm ? 9 : 8);
      const b = int(r, 1, 10);
      if (a !== b) return [warm, a, b, ...rollPick(r)];
    }
  },
  (_k, [warm, a, b, slot, salt]) => {
    if (!isInt(warm, 0, 1) || !isInt(a, 1, warm ? 9 : 8) || !isInt(b, 1, 10) || a === b) return null;
    if (warm) {
      const parts = [`${signedText(-a)}°`, '+', `${b}°`, '=', '?°'];
      const spoken = `It is negative ${a} degrees and it gets ${b} degrees warmer. What is the temperature now, in degrees?`;
      const ans = b - a;
      return signed({ parts, spoken, prompt: `It is ${signedText(-a)}°C. It gets ${b}° warmer.` }, ans, { 'added both numbers': a + b, 'one too many': ans + 1, 'one too few': ans - 1, 'went the wrong way': -a - b, 'stopped at zero': 0 }, slot, salt);
    }
    const parts = [`${a}°`, '−', `${b}°`, '=', '?°'];
    const spoken = `It is ${a} degrees and it gets ${b} degrees colder. What is the temperature now, in degrees?`;
    const ans = a - b;
    return signed({ parts, spoken, prompt: `It is ${a}°C. It gets ${b}° colder.` }, ans, { 'took the smaller from the bigger': Math.abs(ans), 'added them': a + b, 'stopped at zero': 0, 'one too far': ans - 1, 'one short': ans + 1, 'one too many': ans + 2 }, slot, salt);
  },
);

// ---------------------------------------------------------------- time-y6: hours, minutes and seconds

/** Words for a number of half hours: 1 → "half an hour", 3 → "1 and a half hours". */
const halfHours = (m: number) => (m === 1 ? 'half an hour' : m % 2 === 0 ? `${m / 2} ${m === 2 ? 'hour' : 'hours'}` : `${(m - 1) / 2} and a half hours`);

/** "2 h = ? min", "1½ h = ? min", "½ h", "2 h 30 min": whole and half hours up to 3 h. */
const hmin = oneKey(
  'tunit:hmin',
  'Hours to minutes (2 h, 1½ h, ½ h)',
  MEASURE,
  2,
  (_k, r) => {
    for (;;) {
      const m = int(r, 1, 6);
      const v = int(r, 0, 1);
      if (v === 0 || (m % 2 === 1 && m >= 3)) return [m, v];
    }
  },
  (_k, [m, v]) => {
    if (!isInt(m, 1, 6) || !isInt(v, 0, 1) || (v === 1 && (m % 2 === 0 || m < 3))) return null;
    const whole = Math.floor(m / 2);
    const text = v === 1 ? `${whole} h 30 min` : m === 1 ? '½ h' : m % 2 === 1 ? `${whole}½ h` : `${whole} h`;
    const spoken = v === 1 ? `${whole} hours 30 minutes equals how many minutes?` : `${halfHours(m)} equals how many minutes?`;
    const a = m * 30;
    return typed({ parts: [text, '=', '?', 'min'], spoken, answer: a }, { 'used 100 minutes in an hour': (m * 100) / 2, 'forgot the half': whole * 60, 'counted the half hour as 50': whole * 60 + 50, 'one hour too many': a + 60, 'one hour short': a - 60, 'half an hour too many': a + 30, 'half an hour short': a - 30 });
  },
);

const MINS = [0.5, 1, 2, 3, 4, 5];

/** "3 min = ? s", "½ min = ? s". */
const mins = oneKey(
  'tunit:mins',
  'Minutes to seconds (3 min, ½ min)',
  MEASURE,
  1,
  (_k, r) => [int(r, 0, 5)],
  (_k, [i]) => {
    if (!isInt(i, 0, 5)) return null;
    const n = MINS[i];
    const text = n === 0.5 ? '½ min' : `${n} min`;
    const a = n * 60;
    return typed({ parts: [text, '=', '?', 's'], spoken: `${n === 0.5 ? 'half a minute' : `${n} ${n === 1 ? 'minute' : 'minutes'}`} equals how many seconds?`, answer: a }, { 'used 100 seconds in a minute': n * 100, 'used 10 seconds': n * 10, 'one minute too many': a + 60, 'one minute short': a - 60, 'doubled it': a * 2, 'gave the minutes': n });
  },
);

/** "120 min = ? h". */
const minh = oneKey(
  'tunit:minh',
  'Minutes to hours (120 min)',
  MEASURE,
  1,
  (_k, r) => [int(r, 1, 4)],
  (_k, [h]) => {
    if (!isInt(h, 1, 4)) return null;
    return typed({ parts: [`${h * 60} min`, '=', '?', 'h'], spoken: `${h * 60} minutes equals how many hours?`, answer: h }, { 'divided by 30': h * 2, 'divided by 10': h * 6, 'one hour too many': h + 1, 'one hour short': h - 1, 'gave the minutes': h * 60 });
  },
);

// ---------------------------------------------------------------- time-24: 24-hour time

/** The hour of a 24-hour time (6 to 11 in the morning, 13 to 23 after noon): the pm ones come up more. */
const rollHour = (r: () => number) => (int(r, 0, 3) === 0 ? int(r, 6, 11) : int(r, 13, 23));
const goodHour = (h: number) => isInt(h, 6, 23) && h !== 12;
/** "3:40 pm" for 24-hour 15 and 40. */
const label12 = (h: number, m: number, ampm = h >= 12 ? 'pm' : 'am') => `${h}:${pad(m)} ${ampm}`;
const okHour12 = (h: number) => h >= 1 && h <= 12;

/** "15:40 = ?": tap the same time in 12-hour time. */
const to12 = oneKey(
  't24:to12',
  '24-hour time as 12-hour time (15:40)',
  H24,
  4,
  (_k, r) => [rollHour(r), int(r, 0, 11), ...rollPick(r)],
  (_k, [h, mi, slot, salt]) => {
    if (!goodHour(h) || !isInt(mi, 0, 11) || !goodPick(slot, salt)) return null;
    const m = mi * 5;
    const pm = h >= 12;
    const right = label12(pm ? h - 12 : h, m, pm ? 'pm' : 'am');
    const named: Record<string, string> = {};
    if (pm) {
      named['swapped am and pm'] = label12(h - 12, m, 'am');
      if (okHour12(h - 10)) named['took 10 off, not 12'] = label12(h - 10, m, 'pm');
      if (okHour12(h - 11)) named['took 11 off, not 12'] = label12(h - 11, m, 'pm');
      if (okHour12(h - 14)) named['took 14 off, not 12'] = label12(h - 14, m, 'pm');
    } else {
      named['swapped am and pm'] = label12(h, m, 'pm');
      named['one hour out'] = label12(h + 1, m, 'am');
      named['one hour out the other way'] = label12(h - 1, m, 'am');
    }
    named['read the minutes the other way round'] = label12(pm ? h - 12 : h, (60 - m) % 60, pm ? 'pm' : 'am');
    const time = `${pad(h)}:${pad(m)}`;
    const made = pick({ parts: [time, '=', '?'], spoken: `${time} in 12 hour time is what?`, fact: `${time} is ${right}` }, right, named, { slot, salt });
    return made && { ...made, prompt: 'Which is the same time in 12-hour time?' };
  },
);

/** "9:15 pm = ?": tap the same time in 24-hour time. */
const to24 = oneKey(
  't24:to24',
  '12-hour time as 24-hour time (9:15 pm)',
  H24,
  4,
  (_k, r) => [rollHour(r), int(r, 0, 11), ...rollPick(r)],
  (_k, [h, mi, slot, salt]) => {
    if (!goodHour(h) || !isInt(mi, 0, 11) || !goodPick(slot, salt)) return null;
    const m = mi * 5;
    const pm = h >= 12;
    const h12v = pm ? h - 12 : h;
    const c = (x: number, mm = m) => `${pad(x)}:${pad(mm)}`;
    const named: Record<string, string> = {};
    if (pm) {
      named['forgot to add 12'] = c(h12v);
      for (const [name, add] of [['added 10, not 12', 10], ['added 11, not 12', 11], ['added 14, not 12', 14], ['added 13, not 12', 13]] as const) if (h12v + add <= 23) named[name] = c(h12v + add);
    } else {
      named['added 12 to a morning time'] = c(h + 12);
      named['one hour out'] = c(h + 1);
      named['one hour out the other way'] = c(h - 1);
    }
    named['read the minutes the other way round'] = c(h, (60 - m) % 60);
    const shown = label12(h12v, m, pm ? 'pm' : 'am');
    const parts = [shown, '=', '?'];
    const made = pick({ parts, spoken: `${shown} in 24 hour time is what?`, fact: `${shown} is ${c(h)}` }, c(h), named, { slot, salt });
    return made && { ...made, prompt: 'Which is the same time in 24-hour time?' };
  },
);

// ---------------------------------------------------------------- elapsed: time across the hour

const ampmOf = (ap: number) => (ap === 0 ? 'am' : 'pm');
const at = (h: number, m: number, ap: number) => `${h}:${pad(m)} ${ampmOf(ap)}`;
const sayAt = (h: number, m: number, ap: number) => `${h} ${m === 0 ? "o'clock" : m} ${ampmOf(ap)}`;

/** "2:35 pm to 3:00 pm = ? min": up to the next hour. */
const toHour = oneKey(
  'elap:tohour',
  'Minutes up to the next hour (2:35 pm to 3:00 pm)',
  ELAPSED,
  3,
  (_k, r) => [int(r, 1, 10), int(r, 1, 11), int(r, 0, 1)],
  (_k, [h, mi, ap]) => {
    if (!isInt(h, 1, 10) || !isInt(mi, 1, 11) || !isInt(ap, 0, 1)) return null;
    const m = mi * 5;
    const a = 60 - m;
    return typed(
      { parts: [at(h, m, ap), 'to', at(h + 1, 0, ap), '=', '?', 'min'], spoken: `How many minutes from ${sayAt(h, m, ap)} to ${h + 1} o'clock ${ampmOf(ap)}?`, answer: a },
      { 'used 100 minutes in an hour': 100 - m, 'gave the minutes past the hour': m, 'miscounted by one mark': a + 5, 'miscounted by one mark the other way': a - 5, 'gave the whole hour': 60 },
    );
  },
);

/** "2:50 pm to 3:20 pm = ? min": a small gap across the hour. */
const gap = oneKey(
  'elap:gap',
  'Time across the hour (2:50 pm to 3:20 pm)',
  ELAPSED,
  4,
  (_k, r) => {
    for (;;) {
      const mi = int(r, 1, 11);
      const gi = int(r, 2, 12);
      if (mi * 5 + gi * 5 > 60) return [int(r, 1, 10), mi, gi, int(r, 0, 1)];
    }
  },
  (_k, [h, mi, gi, ap]) => {
    if (!isInt(h, 1, 10) || !isInt(mi, 1, 11) || !isInt(gi, 2, 12) || !isInt(ap, 0, 1)) return null;
    const m1 = mi * 5;
    const g = gi * 5;
    if (m1 + g <= 60) return null;
    const m2 = m1 + g - 60;
    return typed(
      { parts: [at(h, m1, ap), 'to', at(h + 1, m2, ap), '=', '?', 'min'], spoken: `How many minutes from ${sayAt(h, m1, ap)} to ${sayAt(h + 1, m2, ap)}?`, answer: g },
      { 'used 100 minutes in an hour': g + 40, 'took the smaller minutes from the bigger': Math.abs(m1 - m2), 'gave the minutes after the hour': m2, 'gave the minutes up to the hour': 60 - m1, 'added the minutes': m1 + m2, 'miscounted by one mark': g + 5, 'miscounted by one mark the other way': g - 5 },
    );
  },
);

// ---------------------------------------------------------------- the lot

export const TIME_FAMILIES: Record<string, Family> = Object.fromEntries([back, on, temp, hmin, mins, minh, to12, to24, toHour, gap].map((f) => [f.keys[0], f]));

export const TIME_SKILL_KEYS: Record<string, readonly string[]> = {
  'count-zero': ['cz:back', 'cz:on', 'cz:temp'],
  'time-y6': ['tunit:hmin', 'tunit:mins', 'tunit:minh'],
  'time-24': ['t24:to12', 't24:to24'],
  elapsed: ['elap:tohour', 'elap:gap'],
};

/** The gap across the hour is two steps. */
export const TIME_SLOW_KEYS: string[] = ['elap:gap'];

export const TIME_LADDER: readonly Y6Row[] = [
  { id: 'count-zero', label: 'Counting through zero (−6, −8, −10, …)', tiny: 'Count past zero', stage: 'integers', after: 'remainders', tags: NS },
  { id: 'time-y6', label: 'Hours, minutes and seconds', tiny: 'Time units', stage: 'measurement-geometry', after: 'count-zero', tags: MEASURE },
  { id: 'time-24', label: '24-hour time', tiny: '24-hour time', stage: 'measurement-geometry', after: 'time-y6', tags: H24 },
  { id: 'elapsed', label: 'Time across the hour', tiny: 'Time across hour', stage: 'measurement-geometry', after: 'time-24', tags: ELAPSED },
];
