/**
 * Place value and rounding (the Leaf topic in Maths Monsters).
 *
 * Band 1: 3-digit numbers: what a digit is worth, partitioning (362 = 300 + ? + 2), 10 more/less.
 * Band 2: the same with 4-digit numbers, and 100 or 1000 more/less.
 * Band 3: rounding to the nearest 10 and 100.
 * Band 4: rounding to the nearest 1000, 5-digit numbers, and × 10, 100, 1000.
 */
import { BandedPack, int, isInt, show, speak, type Family, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';

const TODO = (what: string) => [`TODO-${what}`];

/** The digit in a place: place 0 = ones, 1 = tens, 2 = hundreds... */
const digitAt = (n: number, place: number) => Math.floor(n / 10 ** place) % 10;
const digitCount = (n: number) => String(n).length;
/** The places whose digit is not 0 and appears only once (so "the 6" can only mean one digit). */
const askablePlaces = (n: number, minPlace: number) =>
  Array.from({ length: digitCount(n) }, (_, p) => p).filter(
    (p) => p >= minPlace && digitAt(n, p) !== 0 && String(n).split('').filter((c) => Number(c) === digitAt(n, p)).length === 1,
  );

function digitWorth(key: string, label: string, lo: number, hi: number): Family {
  return {
    label,
    curriculumTags: TODO('place-value-digit'),
    keys: [key],
    roll: (_k, r) => {
      for (;;) {
        const n = int(r, lo, hi);
        const places = askablePlaces(n, 1);
        if (places.length) return [n, places[int(r, 0, places.length - 1)]];
      }
    },
    make: (_k, [n, place]) => {
      if (!isInt(n, lo, hi) || !askablePlaces(n, 1).includes(place)) return null;
      const d = digitAt(n, place);
      const parts = ['In', show(n) + ',', 'the', String(d), 'is worth', '?'];
      return {
        parts,
        spoken: speak(parts),
        answer: d * 10 ** place,
        wrong: [d, d * 10 ** (place + 1), d * 10 ** (place - 1), d * 10 ** (place + 2)],
        fact: `In ${show(n)}, the ${d} is worth ${show(d * 10 ** place)}`,
      };
    },
  };
}

function partition(key: string, label: string, lo: number, hi: number): Family {
  // The blank can be any non-zero place except the ones (which would just be copying a digit).
  const ok = (n: number, place: number) =>
    isInt(n, lo, hi) && isInt(place, 1, digitCount(n) - 1) && digitAt(n, place) !== 0 && String(n).replace(/0/g, '').length >= 2;
  return {
    label,
    curriculumTags: TODO('place-value-partition'),
    keys: [key],
    roll: (_k, r) => {
      for (;;) {
        const n = int(r, lo, hi);
        const place = int(r, 1, digitCount(n) - 1);
        if (ok(n, place)) return [n, place];
      }
    },
    make: (_k, [n, place]) => {
      if (!ok(n, place)) return null;
      const terms: string[] = [];
      for (let p = digitCount(n) - 1; p >= 0; p--) {
        const d = digitAt(n, p);
        if (d === 0) continue;
        if (terms.length) terms.push('+');
        terms.push(p === place ? '?' : show(d * 10 ** p));
      }
      const parts = [show(n), '=', ...terms];
      const d = digitAt(n, place);
      return { parts, spoken: speak(parts), answer: d * 10 ** place, wrong: [d, d * 10 ** (place + 1), d * 10 ** (place - 1)] };
    },
  };
}

/** "10 more than 395": steps are 10s (band 1) or 100s and 1000s (band 2). Half the questions cross into the next place. */
function moreLess(key: string, label: string, steps: number[], lo: number, hi: number): Family {
  const ok = (n: number, v: number, step: number) =>
    isInt(v, 0, 1) && steps.includes(step) && isInt(n, lo, hi) && isInt(v === 0 ? n + step : n - step, lo - step, hi + step);
  return {
    label,
    curriculumTags: TODO('place-value-more-less'),
    keys: [key],
    roll: (_k, r) => {
      const step = steps[int(r, 0, steps.length - 1)];
      const v = int(r, 0, 1);
      for (;;) {
        let n = int(r, lo, hi);
        // Make it cross the next place half the time (395 + 10, 2045 − 100).
        if (r() < 0.5) {
          const digit = v === 0 ? 9 : 0;
          n = n - digitAt(n, Math.log10(step)) * step + digit * step;
        }
        if (ok(n, v, step)) return [n, v, step];
      }
    },
    make: (_k, [n, v, step]) => {
      if (!ok(n, v, step)) return null;
      const parts = [`${show(step)} ${v === 0 ? 'more' : 'less'} than`, show(n), '=', '?'];
      const answer = v === 0 ? n + step : n - step;
      // The slip: only the one digit changes, without carrying (395 + 10 → 305).
      const place = Math.log10(step);
      const slip = n - digitAt(n, place) * step + ((digitAt(n, place) + (v === 0 ? 1 : 9)) % 10) * step;
      return { parts, spoken: speak(parts), answer, wrong: [slip, v === 0 ? n + 1 : n - 1, v === 0 ? n + step * 10 : n - step * 10, v === 0 ? n - step : n + step] };
    },
  };
}

function rounding(key: string, label: string, to: number, lo: number, hi: number): Family {
  const ok = (n: number) => isInt(n, lo, hi) && n % to !== 0;
  return {
    label,
    curriculumTags: TODO('rounding'),
    keys: [key],
    roll: (_k, r) => {
      for (;;) {
        // One in five lands exactly halfway (365 → 370), the case that needs the rule.
        let n = int(r, lo, hi);
        if (r() < 0.2) n = n - (n % to) + to / 2;
        if (ok(n)) return [n];
      }
    },
    make: (_k, [n]) => {
      if (!ok(n)) return null;
      const down = n - (n % to);
      const answer = n % to >= to / 2 ? down + to : down;
      const parts = ['Round', show(n), `to the nearest ${show(to)}:`, '?'];
      return {
        parts,
        spoken: speak(parts),
        answer,
        wrong: [answer === down ? down + to : down, Math.round(n / (to * 10)) * to * 10, Math.round(n / (to / 10 || 1)) * (to / 10 || 1), answer + to],
        fact: `${show(n)} rounded to the nearest ${show(to)} is ${show(answer)}`,
      };
    },
  };
}

const families: Record<string, Family> = {
  'pv:digit:3d': digitWorth('pv:digit:3d', 'What a digit is worth (3-digit numbers)', 100, 999),
  'pv:partition:3d': partition('pv:partition:3d', 'Splitting 3-digit numbers (362 = 300 + 60 + 2)', 101, 999),
  'pv:10more': moreLess('pv:10more', '10 more and 10 less', [10], 100, 989),

  'pv:digit:4d': digitWorth('pv:digit:4d', 'What a digit is worth (4-digit numbers)', 1000, 9999),
  'pv:partition:4d': partition('pv:partition:4d', 'Splitting 4-digit numbers', 1001, 9999),
  'pv:100more': moreLess('pv:100more', '100 and 1000 more and less', [100, 1000], 1000, 8999),

  'pv:round10': rounding('pv:round10', 'Rounding to the nearest 10', 10, 101, 999),
  'pv:round100': rounding('pv:round100', 'Rounding to the nearest 100', 100, 101, 9999),

  'pv:round1000': rounding('pv:round1000', 'Rounding to the nearest 1000', 1000, 1001, 99999),
  'pv:digit:5d': digitWorth('pv:digit:5d', 'What a digit is worth (5-digit numbers)', 10000, 99999),
  'pv:times10': {
    label: 'Multiplying by 10, 100 and 1000',
    curriculumTags: TODO('multiply-by-powers-of-ten'),
    keys: ['pv:times10'],
    roll: (_k, r) => [int(r, 2, 99), int(r, 1, 3)],
    make: (_k, [n, p]) => {
      if (!isInt(n, 2, 99) || !isInt(p, 1, 3)) return null;
      const m = 10 ** p;
      const parts = [String(n), '×', show(m), '=', '?'];
      return { parts, spoken: speak(parts), answer: n * m, wrong: [n * m * 10, (n * m) / 10, n + m, n * 10 ** (p + 2)] };
    },
  },
};

export const PLACE_VALUE: PackDefinition = {
  id: 'place-value',
  label: 'Place value and rounding',
  families,
  bands: [
    ['pv:digit:3d', 'pv:partition:3d', 'pv:10more'],
    ['pv:digit:4d', 'pv:partition:4d', 'pv:100more'],
    ['pv:round10', 'pv:round100'],
    ['pv:round1000', 'pv:digit:5d', 'pv:times10'],
  ],
};

export const placeValuePack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(PLACE_VALUE, saved, random, now);
