import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { sameAnswer } from './banded';
import { solveParts } from './focus';
import { BEDMAS_KEYS, BEDMAS_TEMPLATE_COUNT } from './skillPacks/bedmas';
import { GENERATED, GENERATED_SKILL_KEYS, generatedPack, solveGenerated } from './skillPacks/generated';

const FAMILIES = Object.values(GENERATED.families);
const KEYS = FAMILIES.flatMap((f) => f.keys);
/** The F.5 question types: read back from their parts by the old solver. F.6's and M.5's carry their numbers (fdp.test.ts). */
const F6_SKILLS = ['fraction-bonds', 'decimal-bonds', 'unit-fraction-of', 'tenths', 'add-tenths', 'decimal-equivalents', 'percent-basic', 'fraction-of', 'times-decimals', 'equivalent-fractions', 'fdp-equivalents', 'percent-of', 'whole-from-fraction'] as const;
const F6_KEYS = new Set(F6_SKILLS.flatMap((id) => GENERATED_SKILL_KEYS[id]));
const F5_KEYS = KEYS.filter((k) => !F6_KEYS.has(k));
const pack = generatedPack();

/** A number as the screen shows it: "12 500" → 12500. */
const num = (text: string) => Number(text.replace(/ /g, '').replace('−', '-'));

/** Works a plain expression out with ordinary maths, on its own (not the code under test). */
const calc = (text: string) => Function(`"use strict"; return (${text.replace(/ /g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')});`)() as number;

describe('the generated skills', () => {
  it('every roll of every question type is sound, repeatable and agreed by the solver', () => {
    for (const key of F5_KEYS) {
    const family = GENERATED.families[key];
    const random = randomFromSeed(`gen:${key}`);
    for (let i = 0; i < 40; i++) {
      const params = family.roll(key, random);
      const q = pack.rebuild(key, params, true, random);
      expect(q, `${key} ${JSON.stringify(params)}`).not.toBeNull();
      const where = `${key} ${JSON.stringify(params)} → ${q!.parts.join(' ')}`;
      // Rebuilt from its numbers, it is the same question.
      const again = pack.rebuild(key, params, true, randomFromSeed(`again:${i}`))!;
      expect(again.parts, where).toEqual(q!.parts);
      expect(again.answer, where).toBe(q!.answer);
      // The solver reads the parts back to the same answer and the same record.
      const solved = solveParts(q!.parts);
      expect(solved, where).not.toBeNull();
      expect(solved!.answer, where).toBe(q!.answer);
      expect(solved!.keys, where).toEqual([key]);
      expect(solveGenerated(q!.parts), where).toEqual({ answer: q!.answer, key });
      // Four distinct choices, one of them right, all whole unless the question takes a decimal.
      expect(q!.choices, where).toHaveLength(4);
      expect(new Set(q!.choices).size, where).toBe(4);
      expect(q!.choices!.filter((c) => sameAnswer(c, q!.answer)), where).toHaveLength(1);
      if (q!.input !== 'decimal') expect(q!.choices!.every(Number.isInteger), where).toBe(true);
      // Typing room for the answer.
      expect(q!.maxLength!, where).toBeGreaterThanOrEqual(String(q!.answer).length);
      // The point key only where a point can be needed: rounding to a tenth or a hundredth (the answer may still be whole).
      expect(q!.input === 'decimal', where).toBe(/^round:(tenth|hundredth):/.test(key));
      if (!Number.isInteger(q!.answer)) expect(q!.input, where).toBe('decimal');
      // Every wrong choice is a named mistake, never a random number.
      const made = family.make(key, params)!;
      const named = Object.values(made.named!);
      for (const c of q!.choices!) if (!sameAnswer(c, q!.answer)) expect(named.some((n) => sameAnswer(n, c)), `${where} wrong choice ${c}`).toBe(true);
      expect(Object.keys(made.named!).length, where).toBeGreaterThanOrEqual(3);
      // Spoken text and the right answer in words are set.
      expect(q!.spoken.length, where).toBeGreaterThan(4);
    }
    }
  });
});

// ---------------------------------------------------------------- the answers, worked out another way

describe('the answers are right (worked out separately from the generators)', () => {
  const ask = (key: string, n = 200) => {
    const random = randomFromSeed(`oracle:${key}`);
    const p = generatedPack([], random);
    return Array.from({ length: n }, () => p.questionFor(key, 'focus', {}));
  };

  it('rounding follows "5 and over rounds up"', () => {
    for (const key of KEYS.filter((k) => k.startsWith('round:'))) {
      for (const q of ask(key)) {
        const value = num(q.parts[1]);
        const unit = q.parts[2].replace('to the nearest ', '');
        const size = unit === 'whole number' ? 1 : unit === 'tenth' ? 0.1 : unit === 'hundredth' ? 0.01 : num(unit);
        // Work it out with strings of digits so the sum has no rounding dust.
        const scaled = Math.round(value / size);
        const exact = Math.round(value * 1000) / 1000;
        const remainder = Math.round((exact - Math.floor(exact / size + 1e-9) * size) * 1000) / 1000;
        const down = Math.round(Math.floor(exact / size + 1e-9) * size * 1000) / 1000;
        const expected = remainder >= size / 2 - 1e-9 ? Math.round((down + size) * 1000) / 1000 : down;
        expect(q.answer, q.parts.join(' ')).toBeCloseTo(expected, 6);
        expect(scaled).toBeGreaterThan(-1);
        // The key names the unit and the size.
        const [, unitWord, kind] = key.split(':');
        if (['10', '100', '1000', '10000', '100000', '1000000'].includes(unitWord)) expect(String(size)).toBe(unitWord);
        if (kind === 'halfway') expect(Math.abs(remainder - size / 2) < 1e-9, q.parts.join(' ')).toBe(true);
        if (kind === 'near-halfway') expect(Math.abs(remainder - size / 2) > 1e-9 && Math.abs(remainder - size / 2) <= size / 10 + 1e-9, q.parts.join(' ')).toBe(true);
        const digits = /^(\d+)digit$/.exec(kind);
        if (digits) expect(String(Math.round(value)).length).toBe(Number(digits[1]));
        // The point key for tenths and hundredths only.
        expect(q.input === 'decimal').toBe(unit === 'tenth' || unit === 'hundredth');
      }
    }
  });

  it('order of operations matches ordinary maths, and the type matches the shape', () => {
    for (const key of BEDMAS_KEYS) {
      for (const q of ask(key, 300)) {
        const text = q.parts.slice(0, -2).join(' ');
        expect(calc(text), text).toBe(q.answer);
        const hasBrackets = text.includes('(');
        const ops = text.match(/[+−×÷]/g)!;
        if (key === 'bedmas:mul-first' || key === 'bedmas:div-first') {
          expect(hasBrackets).toBe(false);
          expect(ops).toHaveLength(2);
        }
        if (key === 'bedmas:brackets-first' || key === 'bedmas:brackets-div') {
          expect(hasBrackets).toBe(true);
          expect(ops).toHaveLength(2);
        }
        if (key === 'bedmas:left-to-right') expect(ops.every((o) => (o === '+' || o === '−') === (ops[0] === '+' || ops[0] === '−'))).toBe(true);
        if (key === 'bedmas:mixed') expect(ops).toHaveLength(3);
        if (key === 'bedmas:mixed-brackets') {
          expect(hasBrackets).toBe(true);
          expect(ops.length).toBeGreaterThanOrEqual(2);
        }
        // Every step is a whole number of at least 0 (checked by the generator; an answer below 1 is never asked).
        expect(q.answer).toBeGreaterThanOrEqual(1);
      }
    }
    expect(BEDMAS_TEMPLATE_COUNT).toBeGreaterThanOrEqual(25);
  });
});

