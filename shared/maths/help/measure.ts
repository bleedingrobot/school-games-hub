/**
 * Help me cards for measures, time, shape, angles, compass, coordinates, averages and chance
 * (docs/plans/help-me/PLAN.md H4-H7). Each helper reads only what the pupil sees and teaches the way in: the unit fact,
 * the formula, the worked steps. The last step always leaves the final bit for the pupil.
 */
import { num, show, words } from './read';
import type { HelpCard, HelpQuestion, Helper } from './types';

const card = (kind: string, title: string, ...steps: string[]): HelpCard => ({ kind, title, steps });
const numbersIn = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const prompt = (q: HelpQuestion) => q.prompt ?? '';
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// ---------------------------------------------------------------- changing units

/** [bigger unit, smaller unit, how many small make one big]. */
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['km', 'm', 1000], ['m', 'cm', 100], ['m', 'mm', 1000], ['cm', 'mm', 10],
  ['kg', 'g', 1000], ['L', 'mL', 1000], ['h', 'min', 60], ['min', 's', 60],
  ['m²', 'cm²', 10000], ['cm²', 'mm²', 100], ['L', 'cm³', 1000], ['mL', 'cm³', 1], ['m³', 'L', 1000],
];
const FACTS: Record<string, string> = {
  'm²-cm²': '1 m² = 10 000 cm², because 100 cm × 100 cm = 10 000 cm².',
  'cm²-mm²': '1 cm² = 100 mm², because 10 mm × 10 mm = 100 mm².',
  'mL-cm³': '1 mL = 1 cm³: they are exactly the same amount.',
  'm³-L': '1 m³ = 1000 L.',
  'L-cm³': '1 L = 1000 cm³.',
};
/** When the question is the unit fact itself ("1 m² = ? cm²"), a way to see it without being told it. */
const WHY: Record<string, string[]> = {
  'km-m': ['Kilo means a thousand.', 'So 1 kilometre is a thousand metres: how do you write a thousand? ?'],
  'kg-g': ['Kilo means a thousand.', 'So 1 kilogram is a thousand grams: how do you write a thousand? ?'],
  'm-cm': ['Centi means a hundredth: 1 cm is one hundredth of a metre.', 'How many hundredths make a whole? ?'],
  'm-mm': ['Milli means a thousandth: 1 mm is one thousandth of a metre.', 'How many thousandths make a whole? ?'],
  'L-mL': ['Milli means a thousandth: 1 mL is one thousandth of a litre.', 'How many thousandths make a whole? ?'],
  'cm-mm': ['Look at a ruler: the little marks between 0 and 1 cm are millimetres.', 'Count the gaps from 0 to 1 cm: ?'],
  'h-min': ['The long hand goes once round the clock in 1 hour.', 'It passes every minute mark on the way: how many minutes is once round? ?'],
  'min-s': ['The second hand goes once round the clock in 1 minute.', 'How many seconds is once round? ?'],
  'm²-cm²': ['Picture a square 1 m long and 1 m wide.', 'Each side is 100 cm, so it is 100 rows of 100 little squares.', '100 × 100 = ?'],
  'cm²-mm²': ['Picture a square 1 cm long and 1 cm wide.', 'Each side is 10 mm, so it is 10 rows of 10 tiny squares.', '10 × 10 = ?'],
  'L-cm³': ['A 1 litre box is 10 cm long, 10 cm wide and 10 cm high.', 'Count the 1 cm cubes inside: 10 × 10 × 10 = ?'],
  'm³-L': ['A 1 m cube is 10 cm boxes stacked 10 long, 10 wide and 10 high.', 'Each 10 cm box holds 1 litre.', '10 × 10 × 10 = ?'],
};
const fact = (big: string, small: string, f: number) => FACTS[`${big}-${small}`] ?? `1 ${big} = ${show(f)} ${small}.`;
const UNIT = '[A-Za-z²³]+';

interface Qty { whole: number | null; fracN: number; fracD: number; unit: string; text: string }

function qty(text: string | undefined): Qty | null {
  const m = new RegExp(`^(\\d+(?:\\.\\d+)?)?\\s*(½|\\d+/\\d+)?\\s*(${UNIT})$`).exec((text ?? '').trim());
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  let fracN = 0, fracD = 1;
  if (m[2]) {
    if (m[2] === '½') { fracN = 1; fracD = 2; } else { const [a, b] = m[2].split('/').map(Number); fracN = a; fracD = b; }
  }
  return { whole: m[1] === undefined ? null : Number(m[1]), fracN, fracD, unit: m[3], text: `${m[1] ?? ''}${m[2] ?? ''}`.trim() };
}

function pairFor(a: string, b: string) {
  return PAIRS.find(([big, small]) => (big === a && small === b) || (big === b && small === a)) ?? null;
}

function placeTip(f: number, times: boolean): string[] {
  const d = Math.round(Math.log10(f));
  if (f < 10 || 10 ** d !== f) return [];
  return [times
    ? `Times ${show(f)} moves every digit ${d} ${plural(d, 'place', 'places')} to the left (fill any gap with a 0).`
    : `Divide by ${show(f)} and every digit moves ${d} ${plural(d, 'place', 'places')} to the right.`];
}

function convertOne(q: Qty, to: string): HelpCard | null {
  const pair = pairFor(q.unit, to);
  if (!pair || q.unit === to) return null;
  const [big, small, f] = pair;
  const times = q.unit === big;
  const n = q.whole ?? 0;
  if (times && n === 1 && !q.fracN && WHY[`${big}-${small}`]) return card('units', `How many ${small} in 1 ${big}?`, ...WHY[`${big}-${small}`]);
  if (f === 1) {
    return q.unit === 'mL'
      ? card('units', 'Same amount', fact(big, small, f), 'Think of 1 mL as one 1 cm cube.', `How many 1 cm cubes make ${q.text} mL? ?`)
      : card('units', 'Same amount', fact(big, small, f), 'Think of 1 cm³ as one little cube that holds 1 mL.', `How many mL do ${q.text} cubes hold? ?`);
  }
  if (q.fracN > 0) {
    if (!times) return null;
    const each = f / q.fracD;
    const part = q.fracN === 1 ? `1/${q.fracD} of ${show(f)}` : `${q.fracN}/${q.fracD} of ${show(f)}`;
    if (q.whole) {
      const w = `${show(n)} whole ${q.unit}: ${show(n)} × ${show(f)} = ${show(n * f)} ${to}.`;
      return card('units', 'Whole ones, then the part', fact(big, small, f), w, `Now ${part}: ${show(each * q.fracN)} ${to}. Add: ${show(n * f)} + ${show(each * q.fracN)} = ?`);
    }
    return card('units', `Part of one ${q.unit}`, fact(big, small, f),
      q.fracN === 1 ? `1/${q.fracD} means ${q.fracD} equal parts, so share ${show(f)} into ${q.fracD} equal parts.` : `1/${q.fracD} of ${show(f)} is ${show(f)} ÷ ${q.fracD} = ${show(each)}.`,
      q.fracN === 1 ? `${show(f)} ÷ ${q.fracD} = ?` : `${q.fracN} × ${show(each)} = ?`);
  }
  // Dividing a whole unit ("1000 mL = ? L"): the fact would be the answer, so ask for it another way.
  if (!times && n === f) {
    if (q.unit === 'min') return card('units', 'Once round the clock', 'The long hand takes 60 min to go once round the clock.', 'One trip round the clock is how many hours? ?');
    if (q.unit === 's') return card('units', 'Once round the clock', 'The second hand takes 60 s to go once round the clock.', 'One trip round the clock is how many minutes? ?');
    return card('units', `Divide by ${show(f)}`, `${q.unit} is the smaller unit, so you need fewer of them: divide.`, `How many lots of ${show(f)} ${q.unit} are in ${show(f)} ${q.unit}?`, `${show(f)} ÷ ${show(f)} = ?`);
  }
  // Minutes to hours: 240 min is 24 tens and 60 is 6 tens, so 24 ÷ 6.
  if (!times && f === 60 && big === 'h' && n % 60 === 0 && n / 60 > 1) {
    return card('units', 'Divide by 60', fact(big, small, f), `${show(n)} min is ${show(n / 10)} tens, and 60 is 6 tens.`, `${show(n / 10)} ÷ 6 = ?`);
  }
  const tip = placeTip(f, times);
  const step1 = FACTS[`${big}-${small}`]
    ? `${fact(big, small, f)} ${times ? `${to} is the smaller unit, so multiply.` : `${to} is the bigger unit, so divide.`}`
    : `1 ${big} = ${show(f)} ${small}, so you need ${times ? 'more' : 'fewer'} ${to} than ${q.unit}: ${times ? 'multiply' : 'divide'}.`;
  const sum = times ? `${q.text} × ${show(f)} = ?` : `${q.text} ÷ ${show(f)} = ?`;
  return card('units', times ? `Multiply by ${show(f)}` : `Divide by ${show(f)}`, step1, ...tip, sum);
}

const convert: Helper = (q) => {
  const p = q.parts;
  const ask = p.indexOf('?');
  if (p[1] !== '=' || ask < 0) return null;
  // "105 min = 1 h ? min": the hours are already taken out, find the minutes left.
  if (p.length === 5 && ask === 3) {
    const whole = qty(p[0]), taken = qty(p[2]);
    if (!whole || !taken || whole.whole === null || taken.whole === null || p[4] !== whole.unit) return null;
    const pair = pairFor(taken.unit, whole.unit);
    if (!pair || pair[0] !== taken.unit) return null;
    const f = pair[2];
    return card('units', `Take the ${taken.unit} out`, fact(pair[0], pair[1], f),
      `${show(taken.whole)} ${taken.unit} = ${show(taken.whole)} × ${show(f)} = ${show(taken.whole * f)} ${whole.unit}.`,
      `${show(whole.whole)} − ${show(taken.whole * f)} = ?`);
  }
  // "1 h 30 min = ? min", "4 L 750 mL = ? L": two parts.
  const two = /^(\d+(?:\.\d+)?) (\S+) (\d+(?:\.\d+)?) (\S+)$/.exec(p[0]);
  if (two && p.length === 4 && ask === 2) {
    const [, a, ua, b, ub] = two;
    const to = p[3];
    const pair = pairFor(ua, ub);
    if (!pair || pair[0] !== ua) return null;
    const f = pair[2];
    if (to === ub) {
      return card('units', 'Change the big part, then add', fact(ua, ub, f),
        `Change the ${ua} part: ${a} × ${show(f)} = ${show(Number(a) * f)} ${ub}.`,
        `Add the ${b} ${ub}: ${show(Number(a) * f)} + ${b} = ?`);
    }
    if (to === ua) {
      return card('units', 'Keep the big part, change the small', fact(ua, ub, f),
        `Keep the ${a} ${ua}. Change the ${b} ${ub} into ${ua}: ${b} ÷ ${show(f)} = ? ${ua}.`,
        `Put them together: ${a} ${ua} and ? ${ua} = ?`);
    }
    return null;
  }
  if (p.length === 4 && ask === 2) {
    const from = qty(p[0]);
    if (!from) return null;
    return convertOne(from, p[3]);
  }
  return null;
};

// ---------------------------------------------------------------- time

const clock = (t: string) => {
  const m = /^(\d{1,2}):(\d{2}) (am|pm)$/.exec(t);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]), pm: m[3] === 'pm' };
};

const elapsed: Helper = (q) => {
  const p = q.parts;
  if (p.length !== 6 || p[1] !== 'to' || p[3] !== '=' || p[4] !== '?' || p[5] !== 'min') return null;
  const a = clock(p[0]), b = clock(p[2]);
  if (!a || !b) return null;
  const mins = (t: { h: number; m: number; pm: boolean }) => ((t.h % 12) + (t.pm ? 12 : 0)) * 60 + t.m;
  const total = (mins(b) - mins(a) + 1440) % 1440;
  const toNext = a.m > 0 ? 60 - a.m : 0;
  const rest = total - toNext;
  const hours = Math.floor(rest / 60) * 60, end = rest % 60;
  const nextHour = (a.h % 12) + 1 || 12;
  const hourText = `${a.m > 0 ? nextHour : a.h}:00`;
  // Same minutes one hour later: the long hand has gone once round.
  if (total === 60 && a.m === b.m) return card('elapsed', 'Same minutes, one hour later', `${p[0].split(' ')[0]} and ${p[2].split(' ')[0]} have the same minutes: the long hand has gone once round the clock.`, 'The hour hand has moved on 1 hour.', '1 h = ? min');
  const steps: string[] = ['Count up in jumps: to the next o\'clock, then on to the end time.'];
  const parts: (number | string)[] = [];
  if (toNext) { parts.push(toNext); steps.push(`${p[0].split(' ')[0]} up to ${hourText} is ${toNext} min.`); }
  if (hours) { parts.push(hours); steps.push(`Whole hours after that: ${hours / 60} h = ${hours} min.`); }
  // The last jump is left for the pupil.
  if (end) { parts.push('?'); steps.push(`Then on to ${p[2].split(' ')[0]}: how many min?`); }
  if (parts.length === 1) return card('elapsed', 'Count up to the hour', `${p[0].split(' ')[0]} up to ${p[2].split(' ')[0]}.`, toNext ? `A whole hour is 60 min, so take away what is already gone: 60 − ${a.m} = ?` : `${hours / 60} h = ? min`);
  return card('elapsed', 'Jump to the o\'clock', steps[1], ...steps.slice(2), `Add the jumps: ${parts.join(' + ')} = ?`);
};

const time24: Helper = (q) => {
  const p = q.parts;
  const pr = prompt(q);
  if (p.length !== 3 || p[1] !== '=' || p[2] !== '?') return null;
  if (/12-hour/.test(pr)) {
    const m = /^(\d{2}):(\d{2})$/.exec(p[0]);
    if (!m) return null;
    const h = Number(m[1]);
    if (h === 0) return card('time24', '24-hour to 12-hour', '00:00 is midnight, the start of the day.', 'The hour is 12, and it is am.', 'Write it with am: ?');
    if (h < 12) return card('time24', 'Before or after noon?', 'Noon is 12:00. Times before noon are am. Times from noon on are pm.', `Is ${p[0]} before noon or after?`, `If it is before noon, the hour and minutes stay the same. Write ${p[0]} with am or pm: ?`);
    if (h === 12) return card('time24', 'Noon hour is pm', '12:00 to 12:59 is just after noon: pm.', 'The hour number stays 12.', `Write ${p[0]} with am or pm: ?`);
    return card('time24', 'Take 12 off', 'Times from 12:00 on are pm.', 'For 13:00 and later, take 12 off the hour. The minutes stay the same.', `${h} − 12 = ? That is the hour, then the minutes, then pm.`);
  }
  if (/24-hour/.test(pr)) {
    const t = clock(p[0]);
    if (!t) return null;
    if (!t.pm) {
      return t.h === 12
        ? card('time24', 'Midnight hour', '12 am is just after midnight, the start of the day.', 'In 24-hour time the hour is 00.', `Write ${p[0].split(' ')[0]} as a 4-digit time: ?`)
        : card('time24', 'Morning times keep their hour', 'Morning (am) times keep the same hour in 24-hour time.', 'A 24-hour time has 4 digits, so a one-digit hour gets a 0 in front.', `Is the hour ${t.h} one digit or two? Write the 4-digit time with that hour and the same minutes: ?`);
    }
    if (t.h === 12) return card('time24', 'Noon stays 12', '12 pm is noon, so the hour stays 12.', `Write ${p[0].split(' ')[0]} as a 4-digit time: ?`);
    return card('time24', 'Add 12 to pm hours', 'For pm times, add 12 to the hour. The minutes stay the same.', `${t.h} + 12 = ?`);
  }
  return null;
};

const clockFace: Helper = (q) => {
  if (!/What time does the clock show/.test(prompt(q)) || q.parts.length < 3) return null;
  const t = q.parts.join(' ');
  const long = /long hand on (\d+)/.exec(t);
  const short = /Short hand (?:on|between|halfway|just past|just before|nearly at) (\d+)(?: to |, | and )?(\d+)?/.exec(t);
  if (!long || !short) return null;
  const mark = Number(long[1]);
  const hour = Number(short[1]);
  // Words ("quarter past 2") or a time ("2:15") to pick?
  const isWords = (q.choiceLabels ?? []).some((c) => /past|to \d|o'clock/.test(c));
  const first = mark === 12
    ? 'The long hand shows minutes. Each number is 5 minutes, and 12 is the very top of the clock.'
    : `The long hand is on ${mark}. Each number is 5 minutes: ${mark} × 5 = ? minutes.`;
  const hourStep = /halfway/.test(t) ? `The short hand is halfway between ${short[1]} and ${short[2]}. It has not got to ${short[2]}, so the hour is ${short[1]}.`
    : /nearly at|just before/.test(t) ? `The short hand is nearly at ${hour}, so it is not ${hour} o'clock yet: the time is before ${hour}.`
    : mark === 9 && isWords ? `For quarter to, the hour is the NEXT one after ${hour}.`
    : /between/.test(t) ? `The short hand is between ${short[1]} and ${short[2]}. It has passed ${short[1]}, so the hour is ${short[1]}.`
    : `The short hand tells the hour: it is on ${hour}.`;
  if (isWords) {
    return card('clock', 'Match the minutes to the words', first,
      "Quarter past is 15 minutes, half past is 30 minutes, quarter to is 45 minutes, and o'clock is 0 minutes (the long hand on 12).",
      hourStep, 'Put the words and the hour together: ?');
  }
  const hourKnown = /between|halfway|just past/.test(t) || !/nearly at|just before/.test(t);
  const hh = /between|halfway/.test(t) ? short[1] : String(hour);
  return card('clock', 'Minutes on the long hand', first, hourStep, `Put the hour and the minutes together: ${hourKnown ? `${hh}:?` : '?'}`);
};

// ---------------------------------------------------------------- shapes: perimeter, area, volume

const SIDES: Record<string, number> = {
  triangle: 3, square: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10, dodecagon: 12,
};

const shapes: Helper = (q) => {
  const p0 = (q.parts[0] ?? '').toLowerCase();
  const all = words(q);
  // Side from a square's perimeter.
  if (p0 === 'side' && /square/i.test(prompt(q))) {
    const per = numbersIn(prompt(q))[0];
    return card('perimeter', 'Share the perimeter', 'A square has 4 equal sides.', `The sides together make ${show(per)}, so share it into 4 equal parts.`, `${show(per)} ÷ 4 = ?`);
  }
  if (/perimeter/i.test(all) && !/perimeter of/i.test(all)) {
    const n = numbersIn(all);
    if (/rectangle/i.test(all) && n.length >= 2) {
      return card('perimeter', 'Two lengths and two widths', 'Perimeter is the distance all the way round the edge.',
        `A rectangle has 2 sides of ${show(n[0])} cm and 2 sides of ${show(n[1])} cm.`,
        `${show(n[0])} + ${show(n[1])} + ${show(n[0])} + ${show(n[1])} = ?`);
    }
    const name = Object.keys(SIDES).find((k) => new RegExp(k, 'i').test(all));
    if (name && n.length >= 1) {
      const count = SIDES[name];
      const side = n[n.length - 1];
      const adj = /equilateral/i.test(all) ? 'equilateral ' : /regular/i.test(all) || name !== 'square' ? 'regular ' : '';
      const own = `${/^[aeiou]/i.test(adj + name) ? 'An' : 'A'} ${adj}${name}`;
      const last = count === 8 ? `Double ${show(side)} = ${show(side * 2)}, double again = ${show(side * 4)}, double again = ?`
        : count === 4 ? `Double ${show(side)} = ${show(side * 2)}, double again = ?` : `${count} × ${show(side)} = ?`;
      return card('perimeter', 'Equal sides: times', 'Perimeter is the distance all the way round the edge.',
        `${own} has ${count} equal sides of ${show(side)} cm.`, last);
    }
    return null;
  }
  if (p0 === 'area') {
    const n = numbersIn(prompt(q));
    if (/triangle/i.test(prompt(q)) && n.length >= 2) {
      return card('area', 'A triangle is half a rectangle', 'Draw a rectangle with the same base and height.',
        `Its area is ${show(n[0])} × ${show(n[1])} = ${show(n[0] * n[1])}.`, `A triangle is half of that: half of ${show(n[0] * n[1])} = ?`);
    }
    if (/rectangle/i.test(prompt(q)) && n.length >= 2) {
      return card('area', 'Length × width', 'Area counts the squares inside the shape.',
        `The grid has ${show(n[1])} rows with ${show(n[0])} squares in each row.`, `${show(n[0])} × ${show(n[1])} = ?`);
    }
    return null;
  }
  if (p0 === 'volume') {
    const n = numbersIn(prompt(q));
    if (/cube/i.test(prompt(q)) && !/cuboid/i.test(prompt(q)) && n.length >= 1) {
      return card('volume', 'Length × width × height', 'Volume counts the little cubes inside. A cube is as long, wide and high.',
        `The bottom layer: ${show(n[0])} × ${show(n[0])} = ${show(n[0] * n[0])} cubes.`, `There are ${show(n[0])} layers: ${show(n[0] * n[0])} × ${show(n[0])} = ?`);
    }
    if (n.length >= 3) {
      return card('volume', 'Bottom layer, then the layers', 'Volume counts the little cubes inside: length × width × height.',
        `The bottom layer: ${show(n[0])} × ${show(n[1])} = ${show(n[0] * n[1])} cubes.`, `Height ${show(n[2])} means ${show(n[2])} ${plural(n[2], 'layer', 'layers')}: ${show(n[0] * n[1])} × ${show(n[2])} = ?`);
    }
  }
  return null;
};

const circle: Helper = (q) => {
  const pr = prompt(q);
  const n = numbersIn(pr)[0];
  if (!/circle/i.test(pr) || n === undefined) return null;
  if (q.parts[0] === 'Diameter') return card('circle', 'Diameter is two radii', 'The radius goes from the centre to the edge.', 'The diameter goes right across, through the centre: two radii end to end.', `Double ${show(n)} = ?`);
  if (q.parts[0] === 'Radius') return card('circle', 'Radius is half the diameter', 'The diameter goes right across the circle, through the centre.', 'The radius is only to the centre: half way.', `Half of ${show(n)} = ?`);
  return null;
};

// ---------------------------------------------------------------- angles

const angleNames: Helper = (q) => {
  const pr = prompt(q);
  if (!/kind of angle/.test(pr) || q.parts.length < 3) return null;
  const t = q.parts[0];
  const n = /(\d+)°/.exec(t);
  const list = 'Acute: less than 90°. Right: exactly 90°. Obtuse: between 90° and 180°. Straight: exactly 180°. Reflex: more than 180°.';
  if (/^(Between|Less|More|Exactly)/.test(t)) {
    const clue = /^Less/.test(t) ? 'smaller than a square corner' : /^Exactly 90/.test(t) ? 'exactly a square corner' : /^Between/.test(t) ? 'bigger than a square corner but smaller than a straight line'
      : /^Exactly 180/.test(t) ? 'exactly a straight line' : 'bigger than a straight line';
    return card('angle-names', 'Match the clue to a picture', 'A square corner is 90° and a straight line is 180°.',
      `"${t.replace(/ is$/, '')}" means ${clue}. Look at the five pictures below: which one is that?`, 'What name is under that picture? ?');
  }
  if (!n) return null;
  return card('angle-names', 'Compare with 90° and 180°', list, `A square corner is 90° and a straight line is 180°. Is ${n[1]}° smaller than, equal to, or bigger than those?`, `Which name fits ${n[1]}°? ?`);
};

const angleSum: Helper = (q) => {
  const p = q.parts;
  const last = p[p.length - 1];
  if (!p.includes('?°') || p[p.length - 2] !== '=' || (last !== '180°' && last !== '360°')) return null;
  const known = p.slice(0, -2).filter((t) => t !== '+' && t !== '?°').map((t) => parseInt(t, 10));
  if (!known.length || known.some((n) => Number.isNaN(n))) return null;
  const total = parseInt(last, 10);
  const pr = prompt(q);
  const rule = /triangle/i.test(pr) ? 'The angles in a triangle add up to 180°.'
    : /point/i.test(pr) ? 'Angles round a point add up to 360°, a full turn.'
    : 'Angles on a straight line add up to 180°.';
  const steps: string[] = [rule];
  if (/isosceles/i.test(pr)) steps.push('An isosceles triangle has two equal base angles, and you can see both.');
  const have = known.reduce((a, b) => a + b, 0);
  if (known.length > 1) steps.push(`Add the angles you know: ${known.join(' + ')} = ${have}.`);
  steps.push(`${total} − ${have} = ?`);
  return card('angle-sum', 'Take the known angles from the total', ...steps);
};

const angleNext: Helper = (q) => {
  const pr = prompt(q);
  const n = numbersIn(pr)[0];
  if (q.parts[0] === 'Next angle' && n !== undefined) return card('angle-sum', 'Angles on a line add to 180°', 'Two angles side by side on a straight line make 180°.', `180 − ${show(n)} = ?`);
  if (q.parts[0] === 'Opposite angle' && n !== undefined) return card('angle-opposite', 'Opposite angles are equal', 'The lines cross in the middle.', `The ${show(n)}° angle and the ? angle are across from each other.`, 'Across angles are the same size. How big is the ? angle?');
  return null;
};

const polygons: Helper = (q) => {
  const pr = prompt(q);
  const m = /\((\d+) sides\)/.exec(pr);
  if (!m) return null;
  const n = Number(m[1]);
  if (q.parts[0] === 'Exterior angle') return card('polygon', 'Outside angles make a full turn', 'The outside (exterior) angles of any polygon add up to 360°.', `A regular shape has ${n} equal ones.`, `360 ÷ ${n} = ?`);
  if (q.parts[0] === 'Angle sum') return card('polygon', 'Cut into triangles', 'Split the shape into triangles from one corner.',
    `${n === 8 || n === 11 ? 'An' : 'A'} ${n}-sided shape makes ${n} − 2 = ${n - 2} triangles.`, `Each triangle has 180°: ${n - 2} × 180 = ?`);
  return null;
};

// ---------------------------------------------------------------- compass and coordinates

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const compass: Helper = (q) => {
  const p = q.parts;
  const pr = prompt(q);
  if (p.length === 5 && p[1] === 'to' && p[3] === '=' && p[4] === '?°' && DIRS.includes(p[0]) && DIRS.includes(p[2])) {
    const i = DIRS.indexOf(p[0]);
    const path: string[] = [p[0]];
    for (let k = 1; k <= 8 && path[path.length - 1] !== p[2]; k++) path.push(DIRS[(i + k) % 8]);
    return card('compass', 'Count the 45° steps', 'Compass points in order, clockwise: N, NE, E, SE, S, SW, W, NW. Each step is 45°.',
      `Go clockwise from ${p[0]}: ${path.join(' → ')}.`, 'Count the steps, then steps × 45 = ?');
  }
  if (p.length === 5 && p[1] === 'is' && p[2] === '?°' && DIRS.includes(p[0]) && /from north/.test(pr)) {
    const i = DIRS.indexOf(p[0]);
    if (i % 2 === 0) return card('compass', 'Quarter turns of 90°', 'Going clockwise from N, each quarter turn is 90°: N, then E, then S, then W.', `How many quarter turns from N to ${p[0]}?`, 'Quarter turns × 90 = ?');
    const base = 'Clockwise from N: E is 90°, S is 180°, W is 270°, and N is 360° after a full turn.';
    const lo = DIRS[i - 1], hi = DIRS[(i + 1) % 8];
    return card('compass', 'Halfway between', base, `${p[0]} is halfway between ${lo} and ${hi}.`, `Halfway between ${i === 7 ? 270 : (i - 1) * 45}° and ${i === 7 ? 360 : (i + 1) * 45}° is ?`);
  }
  return null;
};

const compassTurn: Helper = (q) => {
  if (!/Which way are you now facing/.test(prompt(q))) return null;
  const t = q.parts.join(' ');
  const face = /Face (\w+)/.exec(t);
  if (!face) return null;
  const anti = /anticlockwise/.test(t);
  const k = /half turn/.test(t) ? 2 : (/(\d+) quarter/.exec(t) ? Number(/(\d+) quarter/.exec(t)![1]) : /quarter/.test(t) ? 1 : 0);
  if (!k) return null;
  const k3 = k === 3;
  if (k === 2) {
    return card('compass', 'Half turn: the other way round', 'A half turn means you face the other way.', 'Look at the compass: north and south are opposite, east and west are opposite.', `What is opposite ${face[1]}? ?`);
  }
  if (k3) {
    const other = anti ? 'clockwise' : 'anticlockwise';
    return card('compass', '3 turns is 1 turn the other way',
      `Going ${other}: ${anti ? 'north → east → south → west → north' : 'north → west → south → east → north'}.`,
      `3 quarter turns ${anti ? 'anticlockwise' : 'clockwise'} is the same as 1 quarter turn ${other}.`,
      `Start at ${face[1]} and take 1 step ${other}: ?`);
  }
  const order = anti ? 'north → west → south → east → north' : 'north → east → south → west → north';
  const turnStep = /half/.test(t) ? 'A half turn is 2 quarter turns, so 2 steps.' : k === 1 ? 'A quarter turn is 1 step to the next point.' : `${k} quarter turns is ${k} steps.`;
  return card('compass', 'Step round the compass', `Going ${anti ? 'anticlockwise' : 'clockwise'}: ${order}.`, turnStep, `Start at ${face[1]} and take ${k} ${plural(k, 'step', 'steps')}: ?`);
};

const coord: Helper = (q) => {
  const pr = prompt(q);
  // One point on a grid: read its x value (across) or y value (up) (James, 26 Nov 2026).
  const value = /^What is the (x|y) value of the point\?/.exec(pr);
  if (value) {
    return value[1] === 'x'
      ? card('coord', 'Read across', 'A point is (across, up). x is how far across.', 'Put your finger on the point and slide straight down to the bottom line (the x-axis).', 'Read the number there: x = ?')
      : card('coord', 'Read up', 'A point is (across, up). y is how far up.', 'Put your finger on the point and slide straight across to the side line (the y-axis).', 'Read the number there: y = ?');
  }
  const ax = /(x|y)-axis/.exec(pr);
  if (ax) {
    return ax[1] === 'y'
      ? card('coord', 'On the y-axis, x is 0', 'A point is (across, up). The y-axis is the line going up, so you have not moved across at all.', 'That means the first number is 0.', 'Which point has 0 as its first number? ?')
      : card('coord', 'On the x-axis, y is 0', 'A point is (across, up). The x-axis is the line going across, so you have not moved up at all.', 'That means the second number is 0.', 'Which point has 0 as its second number? ?');
  }
  const move = /^Move (\d+) (left|right|up|down)$/.exec(q.parts[1] ?? '');
  const start = /^Start at \((\d+), (\d+)\)$/.exec(q.parts[0] ?? '');
  if (!move || !start) return null;
  const n = Number(move[1]);
  const horiz = move[2] === 'left' || move[2] === 'right';
  const v = Number(start[horiz ? 1 : 2]);
  const plus = move[2] === 'right' || move[2] === 'up';
  return card('coord', `Moving ${move[2]} changes ${horiz ? 'x' : 'y'}`,
    `A point is (across, up): the first number is x, the second is y.`,
    `Moving ${move[2]} changes the ${horiz ? 'first' : 'second'} number. ${plus ? 'Right and up add.' : 'Left and down take away.'}`,
    `${v} ${plus ? '+' : '−'} ${n} = ?`);
};

// ---------------------------------------------------------------- averages

const nums = (q: HelpQuestion): number[] | null => {
  const m = /^The numbers (.+)$/.exec(prompt(q));
  if (!m) return null;
  const v = m[1].split(',').map((s) => num(s.trim()));
  return v.length && v.every((x) => x !== null) ? (v as number[]) : null;
};

const averages: Helper = (q) => {
  const v = nums(q);
  const what = q.parts[0];
  if (!v || q.parts[1] !== '=' || q.parts[2] !== '?') return null;
  if (what === 'Mean') {
    const total = v.reduce((a, b) => a + b, 0);
    return card('mean', 'Add up, then share out', 'The mean is the fair share: if everyone got the same.', `Add all the numbers: ${v.map(show).join(' + ')} = ${show(total)}.`, `Share between ${v.length}: ${show(total)} ÷ ${v.length} = ?`);
  }
  if (what === 'Range') {
    return card('range', 'Biggest minus smallest', 'The range tells how spread out the numbers are.', `The biggest is ${show(Math.max(...v))} and the smallest is ${show(Math.min(...v))}.`, `${show(Math.max(...v))} − ${show(Math.min(...v))} = ?`);
  }
  if (what === 'Mode') return card('mode', 'The one that shows up most', 'The mode is the number that appears the most times.', `Count each number: ${[...new Set(v)].map((x) => `${show(x)} → ?`).join(', ')}.`, 'Which number has the biggest count? ?');
  if (what === 'Median') {
    return v.length % 2
      ? card('median', 'The middle number', `Put ${v.map(show).join(', ')} in order, smallest to biggest.`, 'Cross off the biggest and the smallest. Do it again.', 'Which number is left in the middle? ?')
      : card('median', 'Halfway between the middle two', 'Write the numbers in order, smallest to biggest.', 'Cross off the biggest and smallest until two are left in the middle.', 'Add those two, then halve: ?');
  }
  return null;
};

// ---------------------------------------------------------------- chance

const chance: Helper = (q) => {
  const pr = prompt(q);
  const t = q.parts[0] ?? '';
  const WORDS_LINE = 'About half is even chance. A few is unlikely. Most is likely.';
  if (/How likely is it/.test(pr)) {
    if (/dice/i.test(t)) {
      return card('chance', 'Count the faces that fit', 'A dice has 6 faces: 1, 2, 3, 4, 5, 6.', `How many faces fit "${t.replace(/ on a dice$/, '').toLowerCase()}"? Out of 6.`,
        'None is impossible. All is certain.', `${WORDS_LINE} Which word fits? ?`);
    }
    const side = /landing (\w+)/.exec(t)?.[1];
    return card('chance', 'Count the ways', 'A coin has 2 sides: heads and tails.', side ? `How many of them are ${side}? Out of 2.` : 'How many of them fit? Out of 2.',
      'None is impossible. All is certain.', `${WORDS_LINE} Which word fits? ?`);
  }
  if (/Which number fits/.test(pr)) {
    const w = t.replace(/ means.*$/, '').toLowerCase();
    const near = w === 'likely' ? ['On the line, 0 is impossible and 1 is certain.', 'Likely is on the right side, close to 1 but not at 1.']
      : w === 'unlikely' ? ['On the line, 0 is impossible and 1 is certain.', 'Unlikely is on the left side, close to 0 but not at 0.']
      : w === 'even chance' ? ['The line runs from 0 at the left end to 1 at the right end.', 'Even chance is exactly halfway along the line.']
      : ['The line runs from 0 at the left end to 1 at the right end.', `${w === 'impossible' ? 'Impossible means it can never happen' : 'Certain means it always happens'}. Which end of the line is that?`];
    return card('chance', `${w.charAt(0).toUpperCase()}${w.slice(1)} means P = ?`, ...near, 'Which choice sits there? ?');
  }
  if (/Which chance word fits/.test(pr)) {
    const v = /P = ([\d.]+)/.exec(t)?.[1];
    if (v === '1') return card('chance', 'P = 1 means ?', '0 is impossible: it can never happen.', 'Is P = 1 at the start or the end of the line?', 'The end is the opposite of impossible. Which word is that? ?');
    if (v === '0') return card('chance', 'P = 0 means ?', '1 is certain: it always happens.', 'Is P = 0 at the start or the end of the line?', 'The start is the opposite of certain. Which word is that? ?');
    if (v === '0.5') return card('chance', 'P = 0.5 means ?', 'The line runs from 0 to 1.', 'Is 0.5 close to an end, or halfway?', 'Which word is that? ?');
    if (v) return card('chance', `P = ${v} means ?`, 'On the line, 0 is impossible and 1 is certain.', `${v} is close to ${Number(v) < 0.5 ? '0' : '1'} but not at ${Number(v) < 0.5 ? '0' : '1'}.`, 'Which word fits? ?');
  }
  return null;
};

const probability: Helper = (q) => {
  const pr = prompt(q);
  const t = q.parts[0] ?? '';
  if (q.parts[1] !== '=' || q.parts.length < 3) return null;
  if (/^P\(no/.test(t) || /^P\(not/.test(t)) {
    const given = /= ([\d.]+\/\d+|[\d.]+)\s*$/.exec(pr);
    if (given && !/dice/i.test(pr)) {
      const v = given[1];
      if (v.includes('/')) {
        const d = v.split('/')[1];
        return card('chance', 'It happens or it does not: they make 1', 'The chances of "happens" and "does not happen" add to 1, a whole.', `1 is the same as ${d}/${d}.`, `${d}/${d} − ${v} = ?`);
      }
      return card('chance', 'It happens or it does not: they make 1', 'The chances of "happens" and "does not happen" add to 1, a whole.', `1 − ${v} = ?`);
    }
  }
  if (/dice/i.test(pr)) {
    const keep = /^P\((.+)\)$/.exec(t);
    if (!keep) return null;
    return card('chance', 'Faces that fit, out of 6', 'A fair dice has 6 faces, all equally likely: 1, 2, 3, 4, 5, 6.', `Write down the faces that fit "${keep[1]}".`, 'Fraction = (faces that fit) / 6 = ?');
  }
  const bag = /(\d+) (\w+) and (\d+) (\w+)/.exec(pr);
  if (bag && /^P\(/.test(t)) {
    const total = Number(bag[1]) + Number(bag[3]);
    return card('chance', 'Wanted over all', 'Probability is a fraction: the ones you want, over all the ones there are.',
      `Count all the counters: ${bag[1]} + ${bag[3]} = ${total}. That is the bottom number.`, `The top is the number of ${t.slice(2, -1)} counters. P${t.slice(1)} = ?/${total}`);
  }
  const spin = /(\d+) equal parts\. (\d+) are (\w+)/.exec(pr);
  if (spin && /^P\(/.test(t)) {
    return card('chance', 'Wanted over all', 'Probability is a fraction: the ones you want, over all the parts.',
      `All the parts are the bottom number: ${spin[1]}.`, `The top is how many parts are ${spin[3]}. P(${spin[3]}) = ?/${spin[1]}`);
  }
  return null;
};

const percentOf: Helper = (q) => {
  const m = /^(\d+) in (\d+)$/.exec(q.parts[0] ?? '');
  if (!m || q.parts[1] !== '=' || q.parts[3] !== '%') return null;
  const a = Number(m[1]), d = Number(m[2]);
  if (100 % d === 0 && a === 1) return card('percent', 'Make it out of 100', 'Per cent means "out of 100".', `1 in ${d} means 1 share out of ${d} equal shares.`, `Share 100 into ${d} equal parts: 100 ÷ ${d} = ?`);
  if (100 % d === 0) return card('percent', 'Make it out of 100', 'Per cent means "out of 100".', `Out of ${d} to out of 100: ${d} × ${100 / d} = 100.`, `Do the same to the top: ${a} × ${100 / d} = ?`);
  return card('percent', 'Divide, then times 100', 'Per cent means "out of 100".', `Find 1 share: 100 ÷ ${d} = ${show(100 / d)}.`, `${a} × ${show(100 / d)} = ?`);
};

export const MEASURE_HELPERS: Helper[] = [
  convert, elapsed, time24, clockFace, shapes, circle, angleNames, angleSum, angleNext, polygons, compass, compassTurn,
  coord, averages, chance, probability, percentOf,
];
