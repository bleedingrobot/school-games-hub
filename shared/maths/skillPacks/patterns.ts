/**
 * Number patterns (Dragon Maths: riddles, the old woman in the forest, the inn).
 *
 * Band 1: next number when counting on by 2 to 10 ("3, 7, 11, 15, ?").
 * Band 2: counting back, and doubling.
 * Band 3: a missing number in the middle, and "what is the step?".
 * Band 4: growing steps (+1, +2, +3 ...) and rules like "n × 3 + 1".
 */
import { BandedPack, int, isInt, pickOne, show, speak, type Family, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';

const TODO = (what: string) => [`TODO-${what}`];
const seq = (nums: number[]) => nums.map((n) => show(n) + ',').join(' ');

/** The terms of an arithmetic pattern. */
const arithmetic = (start: number, step: number, count: number) => Array.from({ length: count }, (_, i) => start + step * i);

const families: Record<string, Family> = {
  'pat:add': {
    label: 'Next number, counting on (3, 7, 11, 15, ?)',
    curriculumTags: TODO('pattern-add'),
    keys: ['pat:add'],
    roll: (_k, r) => [int(r, 1, 30), pickOne(r, [2, 3, 4, 5, 6, 7, 8, 9, 10])],
    make: (_k, [start, step]) => {
      if (!isInt(start, 1, 30) || !isInt(step, 2, 10)) return null;
      const terms = arithmetic(start, step, 5);
      const parts = ['What comes next?', seq(terms.slice(0, 4)), '?'];
      return {
        parts, spoken: speak(parts), answer: terms[4],
        wrong: [terms[3] + step + 1, terms[3] + step - 1, terms[3] + 1, terms[3] + step * 2],
        fact: `It goes up by ${step} each time: ${terms[3]} + ${step} = ${terms[4]}`,
      };
    },
  },
  'pat:down': {
    label: 'Next number, counting back (50, 45, 40, 35, ?)',
    curriculumTags: TODO('pattern-down'),
    keys: ['pat:down'],
    roll: (_k, r) => {
      const step = pickOne(r, [2, 3, 4, 5, 6, 10]);
      return [step, step * 4 + int(r, 2, 40)];
    },
    make: (_k, [step, start]) => {
      if (!isInt(step, 2, 10) || !isInt(start, step * 4 + 2, step * 4 + 40)) return null;
      const terms = arithmetic(start, -step, 5);
      const parts = ['What comes next?', seq(terms.slice(0, 4)), '?'];
      return {
        parts, spoken: speak(parts), answer: terms[4],
        wrong: [terms[3] - step - 1, terms[3] - step + 1, terms[3] + step, terms[3] - 1],
        fact: `It goes down by ${step} each time: ${terms[3]} − ${step} = ${terms[4]}`,
      };
    },
  },
  'pat:double': {
    label: 'Doubling (2, 4, 8, 16, ?)',
    curriculumTags: TODO('pattern-double'),
    keys: ['pat:double'],
    roll: (_k, r) => [pickOne(r, [1, 2, 3, 5]), int(r, 3, 4)],
    make: (_k, [start, shown]) => {
      if (![1, 2, 3, 5].includes(start) || !isInt(shown, 3, 4)) return null;
      const terms = Array.from({ length: shown + 1 }, (_, i) => start * 2 ** i);
      const parts = ['What comes next?', seq(terms.slice(0, shown)), '?'];
      const last = terms[shown - 1];
      return {
        parts, spoken: speak(parts), answer: terms[shown],
        wrong: [last + 2, last + (last - terms[shown - 2]), last * 3, last + 1],
        fact: `Each number is doubled: ${last} × 2 = ${terms[shown]}`,
      };
    },
  },
  'pat:missing': {
    label: 'A missing number in the middle (5, 9, ?, 17, 21)',
    curriculumTags: TODO('pattern-missing'),
    keys: ['pat:missing'],
    roll: (_k, r) => [int(r, 1, 40), pickOne(r, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]), int(r, 1, 3)],
    make: (_k, [start, step, hole]) => {
      if (!isInt(start, 1, 40) || !isInt(step, 2, 12) || !isInt(hole, 1, 3)) return null;
      const terms = arithmetic(start, step, 5);
      const shown = terms.map((n, i) => (i === hole ? '?' : show(n) + (i < 4 ? ',' : '')));
      const parts = ['Fill the gap:', ...shown];
      return {
        parts, spoken: speak(parts), answer: terms[hole],
        wrong: [terms[hole] + 1, terms[hole] - 1, terms[hole] + step, terms[hole] - step],
        fact: `It goes up by ${step} each time, so the gap is ${terms[hole - 1]} + ${step} = ${terms[hole]}`,
      };
    },
  },
  'pat:step': {
    label: 'What is the step? (4, 9, 14, 19: it goes up by ?)',
    curriculumTags: TODO('pattern-step'),
    keys: ['pat:step'],
    roll: (_k, r) => [int(r, 1, 40), pickOne(r, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25])],
    make: (_k, [start, step]) => {
      if (!isInt(start, 1, 40) || !isInt(step, 2, 25)) return null;
      const terms = arithmetic(start, step, 4);
      const parts = [seq(terms), 'it goes up by', '?'];
      return {
        parts, spoken: speak(parts), answer: step,
        wrong: [step + 1, step - 1, step + 2, step * 2],
        fact: `${terms[1]} − ${terms[0]} = ${step}, so it goes up by ${step}`,
      };
    },
  },
  'pat:grow': {
    label: 'Growing steps (1, 2, 4, 7, 11, ?)',
    curriculumTags: TODO('pattern-grow'),
    keys: ['pat:grow'],
    roll: (_k, r) => [int(r, 1, 10), int(r, 1, 3)],
    make: (_k, [start, firstStep]) => {
      if (!isInt(start, 1, 10) || !isInt(firstStep, 1, 3)) return null;
      const terms = [start];
      for (let i = 0; i < 5; i++) terms.push(terms[i] + firstStep + i);
      const parts = ['What comes next?', seq(terms.slice(0, 5)), '?'];
      const lastStep = firstStep + 3;
      return {
        parts, spoken: speak(parts), answer: terms[5],
        wrong: [terms[4] + lastStep, terms[4] + lastStep + 2, terms[4] + lastStep - 2, terms[4] + firstStep],
        fact: `The jumps grow by 1 each time: ${firstStep}, ${firstStep + 1}, ${firstStep + 2}, ${lastStep}, so next is ${terms[4]} + ${lastStep + 1} = ${terms[5]}`,
      };
    },
  },
  'pat:rule': {
    label: 'A rule (n × 3 + 1: what is it when n is 6?)',
    curriculumTags: TODO('pattern-rule'),
    keys: ['pat:rule'],
    roll: (_k, r) => [int(r, 2, 6), int(r, 0, 5), int(r, 3, 10)],
    make: (_k, [times, plus, n]) => {
      if (!isInt(times, 2, 6) || !isInt(plus, 0, 5) || !isInt(n, 3, 10)) return null;
      const parts = [`Rule: n × ${times}${plus ? ` + ${plus}` : ''}. When n is ${n}, the answer is`, '?'];
      return {
        parts, spoken: speak(parts), answer: n * times + plus,
        wrong: [n * times, n + times + plus, n * (times + plus), n * times + plus + 1, n * times + plus - 1],
        fact: `${n} × ${times}${plus ? ` + ${plus}` : ''} = ${n * times + plus}`,
      };
    },
  },
};

export const PATTERNS: PackDefinition = {
  id: 'patterns',
  label: 'Number patterns',
  families,
  bands: [['pat:add'], ['pat:down', 'pat:double'], ['pat:missing', 'pat:step'], ['pat:grow', 'pat:rule']],
};

export const patternsPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(PATTERNS, saved, random, now);
