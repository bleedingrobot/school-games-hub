import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { BandedPack, sameAnswer } from './banded';
import { solveParts } from './focus';
import { LADDER, ladderKeyPacks, packIdOfKey, questionForKey } from './ladder';
import { BEDMAS_KEYS, BEDMAS_TEMPLATE_COUNT } from './skillPacks/bedmas';
import { GENERATED, GENERATED_KEYS, GENERATED_SKILL_KEYS, generatedPack, solveGenerated } from './skillPacks/generated';
import { RECORD_KEY } from './skillPacks/generatedKit';

const FAMILIES = Object.values(GENERATED.families);
const KEYS = FAMILIES.flatMap((f) => f.keys);
const pack = generatedPack();

/** A number as the screen shows it: "12 500" → 12500. */
const num = (text: string) => Number(text.replace(/ /g, '').replace('−', '-'));

/** Works a plain expression out with ordinary maths, on its own (not the code under test). */
const calc = (text: string) => Function(`"use strict"; return (${text.replace(/ /g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')});`)() as number;

describe('the generated skills in the ladder', () => {
  it('every key is a valid record key, owned once, and in exactly one skill', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
    for (const key of KEYS) expect(RECORD_KEY.test(key), key).toBe(true);
    const fromSkills = Object.values(GENERATED_SKILL_KEYS).flat();
    expect(new Set(fromSkills).size).toBe(fromSkills.length);
    expect(new Set(fromSkills)).toEqual(new Set(KEYS));
  });

  it('the ten stubs are built, with at least four question types each, in the ladder order', () => {
    const ids = ['bonds-100', 'round-10-100', 'bonds-1000', 'times-tens', 'round-1000', 'factor-pairs', 'round-big', 'squares-cubes', 'round-million', 'bedmas'];
    const positions = ids.map((id) => LADDER.findIndex((s) => s.id === id));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions.slice().sort((a, b) => a - b));
    for (const id of ids) {
      const skill = LADDER.find((s) => s.id === id)!;
      expect(skill.built, id).toBe(true);
      expect(skill.keys.length, id).toBeGreaterThanOrEqual(4);
      for (const key of skill.keys) expect(packIdOfKey(key), key).toBe('generated');
    }
    expect(LADDER.filter((s) => s.built)).toHaveLength(19);
    // The fraction, decimal and percentage stubs wait for F.6.
    for (const id of ['unit-fraction-of', 'tenths', 'add-tenths', 'decimal-equivalents', 'percent-basic', 'fraction-of', 'times-decimals', 'equivalent-fractions', 'fdp-equivalents', 'percent-of', 'whole-from-fraction', 'ten-and']) {
      expect(LADDER.find((s) => s.id === id)!.built, id).toBe(false);
    }
  });

  it('every generated key has a pack in ladderKeyPacks', () => {
    const map = ladderKeyPacks();
    for (const key of KEYS) expect(map.get(key), key).toBe('generated');
  });

  it('the plain ones from before keep their packs', () => {
    expect(packIdOfKey('bond10:3+7')).toBe('early-facts');
    expect(packIdOfKey('bond100:tens')).toBe('generated');
    expect(packIdOfKey('mul:6x7')).toBe('times-tables');
    expect(packIdOfKey('pv:round10')).toBeNull(); // Maths Monsters keeps its own
    expect(packIdOfKey('round:10:2digit')).toBe('generated');
    expect(GENERATED_KEYS.has('pv:round10')).toBe(false);
  });
});

describe.each(KEYS.map((k) => [k] as const))('%s', (key) => {
  const family = GENERATED.families[key];

  it('every roll makes a sound, repeatable question the solver agrees with', () => {
    const random = randomFromSeed(`gen:${key}`);
    for (let i = 0; i < 300; i++) {
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
  });

  it('is the same every time for the same seed, and differs for another', () => {
    const run = (seed: string) => {
      const p = generatedPack([], randomFromSeed(seed));
      return Array.from({ length: 12 }, () => p.questionFor(key, 'focus', { multipleChoice: true })).map((q) => [q.parts.join(' '), q.choices!.join(',')]);
    };
    expect(run('s1')).toEqual(run('s1'));
    expect(run('s1')).not.toEqual(run('s2'));
  });

  it('refuses numbers it would never roll', () => {
    const random = randomFromSeed(`bad:${key}`);
    const params = family.roll(key, random);
    expect(pack.rebuild(key, [...params, 1], false)).toBeNull(); // wrong count (or bad number)
    expect(pack.rebuild(key, params.map(() => NaN), false)).toBeNull();
    expect(pack.rebuild(key, params.map(() => -5), false)).toBeNull();
    expect(pack.rebuild(key, params.map(() => 10 ** 9 + 0.5), false)).toBeNull();
  });

  it('asks a typed question when the class has multiple choice off (except order of operations)', () => {
    const q = generatedPack([], randomFromSeed(`t:${key}`)).questionFor(key, 'focus', {});
    expect(Boolean(q.choices)).toBe(key.startsWith('bedmas:'));
  });
});

// ---------------------------------------------------------------- the answers, worked out another way

describe('the answers are right (worked out separately from the generators)', () => {
  const ask = (key: string, n = 200) => {
    const random = randomFromSeed(`oracle:${key}`);
    const p = generatedPack([], random);
    return Array.from({ length: n }, () => p.questionFor(key, 'focus', {}));
  };

  it('bonds to 100 and 1000', () => {
    for (const total of [100, 1000]) {
      for (const key of KEYS.filter((k) => k.startsWith(`bond${total}:`))) {
        for (const q of ask(key)) {
          const [x, op, y, , z] = q.parts;
          if (op === '−') {
            expect(num(x) - num(y)).toBe(q.answer);
            expect(x).toBe(String(total));
          } else {
            const known = num(x === '?' ? y : x);
            expect(known + q.answer, q.parts.join(' ')).toBe(total);
            expect(z).toBe(String(total));
            // The type matches the number: tens end in 0, fives in 5 (for 100); hundreds, fifties, tens (for 1000).
            if (key === 'bond100:tens') expect(known % 10).toBe(0);
            if (key === 'bond100:fives') expect(known % 10).toBe(5);
            if (key === 'bond100:any') expect(known % 5).not.toBe(0);
            if (key === 'bond1000:hundreds') expect(known % 100).toBe(0);
            if (key === 'bond1000:fifties') expect(known % 100).toBe(50);
            if (key === 'bond1000:tens') expect(known % 50).not.toBe(0);
          }
        }
      }
    }
  });

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

  it('rounds the famous halves up: 65 → 70, 4.15 → 4.2, 350 → 400', () => {
    const fam = GENERATED.families;
    expect(fam['round:10:halfway'].make('round:10:halfway', [65])!.answer).toBe(70);
    expect(fam['round:100:halfway'].make('round:100:halfway', [350])!.answer).toBe(400);
    expect(fam['round:tenth:halfway'].make('round:tenth:halfway', [415])!.answer).toBe(4.2);
    expect(fam['round:whole:halfway'].make('round:whole:halfway', [45])!.answer).toBe(5);
    expect(fam['round:10:near-halfway'].make('round:10:near-halfway', [64])!.answer).toBe(60);
    expect(fam['round:10:near-halfway'].make('round:10:near-halfway', [66])!.answer).toBe(70);
    expect(fam['round:1000000:7digit'].make('round:1000000:7digit', [3256789])!.answer).toBe(3000000);
    expect(fam['round:hundredth:thousandths'].make('round:hundredth:thousandths', [3456])!.answer).toBe(3.46);
  });

  it('times with tens and hundreds', () => {
    for (const key of KEYS.filter((k) => k.startsWith('times:'))) {
      for (const q of ask(key)) {
        const [x, op, y] = q.parts;
        expect(op === '×' ? num(x) * num(y) : num(x) / num(y), q.parts.join(' ')).toBe(q.answer);
        // Never a fact from the times tables, which have their own records.
        if (op === '×') expect(num(x) > 12 || num(y) > 12, q.parts.join(' ')).toBe(true);
      }
    }
  });

  it('factors', () => {
    const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
    for (const q of ask('factor:pair')) {
      const n = num(q.parts[4]);
      expect(num(q.parts[0]) * q.answer).toBe(n);
    }
    for (const q of ask('factor:count')) expect(divisors(num(q.parts[1]))).toHaveLength(q.answer);
    for (const q of ask('factor:largest')) {
      const n = num(q.parts[1]);
      expect(Math.max(...divisors(n).filter((d) => d < n))).toBe(q.answer);
    }
    for (const q of ask('factor:common')) {
      const a = num(q.parts[1]);
      const b = num(q.parts[3]);
      expect(Math.max(...divisors(a).filter((d) => b % d === 0))).toBe(q.answer);
    }
  });

  it('squares and cubes', () => {
    for (const q of ask('square:of')) expect(num(q.parts[0]) ** 2).toBe(q.answer);
    for (const q of ask('cube:of')) expect(num(q.parts[0]) ** 3).toBe(q.answer);
    for (const q of ask('square:root')) expect(q.answer ** 2).toBe(num(q.parts[1]));
    for (const q of ask('cube:root')) expect(q.answer ** 3).toBe(num(q.parts[1]));
    for (const q of ask('square:next')) {
      const x = num(q.parts[1]);
      expect(Math.sqrt(q.answer) % 1).toBe(0);
      expect(q.answer).toBeGreaterThan(x);
      expect((Math.sqrt(q.answer) - 1) ** 2).toBeLessThan(x);
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

  it('2 + 3 × 4 has 20 among its choices (working left to right) and 14 as the answer', () => {
    const fam = GENERATED.families['bedmas:mul-first'];
    const index = Array.from({ length: BEDMAS_TEMPLATE_COUNT }, (_, i) => i).find((i) => {
      const made = fam.make('bedmas:mul-first', [i, 2, 3, 4]);
      return made?.parts.join(' ') === '2 + 3 × 4 = ?';
    })!;
    const made = fam.make('bedmas:mul-first', [index, 2, 3, 4])!;
    expect(made.answer).toBe(14);
    expect(made.named!['worked left to right']).toBe(20);
    expect(made.choose).toBe(true);
    const q = pack.rebuild('bedmas:mul-first', [index, 2, 3, 4], false, randomFromSeed('x'))!;
    expect(q.choices).toHaveLength(4);
    expect(q.choices).toContain(14);
    expect(q.choices).toContain(20);
  });
});

describe('the solver does not take over other skills', () => {
  it('leaves times-table and adding facts alone', () => {
    expect(solveGenerated(['7', '×', '8', '=', '?'])).toBeNull();
    expect(solveGenerated(['10', '×', '10', '=', '?'])).toBeNull();
    expect(solveGenerated(['4', '×', '10', '=', '?'])).toBeNull();
    expect(solveGenerated(['120', '÷', '10', '=', '?'])).toBeNull();
    expect(solveGenerated(['7', '+', '?', '=', '10'])).toBeNull();
    expect(solveGenerated(['Double', '7', '=', '?'])).toBeNull();
    expect(solveParts(['7', '×', '8', '=', '?'])!.keys).toEqual(['mul:7x8']);
    expect(solveParts(['7', '+', '?', '=', '10'])!.keys).toContain('bond10:3+7');
  });

  it('refuses a question that is almost one of ours', () => {
    expect(solveGenerated(['Round', '347', 'to the nearest 100', '=', '?'])).toEqual({ answer: 300, key: 'round:100:near-halfway' });
    expect(solveGenerated(['Round', '312', 'to the nearest 100', '=', '?'])).toEqual({ answer: 300, key: 'round:100:3digit' });
    expect(solveGenerated(['Round', '347', 'to the nearest 7', '=', '?'])).toBeNull();
    expect(solveGenerated(['Round', '300', 'to the nearest 100', '=', '?'])).toBeNull(); // already round
    expect(solveGenerated(['Round', '3 4 7', 'to the nearest 100', '=', '?'])).toBeNull();
    expect(solveGenerated(['2', '+', '3', '×', '4', '=', '?'])).toEqual({ answer: 14, key: 'bedmas:mul-first' });
    expect(solveGenerated(['2', '+', '3', '×', '4', '=', '15'])).toBeNull();
    expect(solveGenerated(['3', '+', '2', '×', '1', '=', '?'])).toBeNull(); // 1 isn't used
    expect(solveGenerated(['12', '÷', '5', '+', '1', '=', '?'])).toBeNull(); // not a whole number
    expect(solveGenerated(['100', '−', '37', '=', '?'])).toEqual({ answer: 63, key: 'bond100:take' });
    expect(solveGenerated(['100', '−', '0', '=', '?'])).toBeNull();
    expect(solveGenerated(['34', '+', '?', '=', '99'])).toBeNull();
    expect(solveGenerated([])).toBeNull();
  });

  it('questionForKey (the placement check) asks every generated key', () => {
    for (const key of KEYS) {
      const q = questionForKey(key, 7, randomFromSeed(`q:${key}`));
      expect(q, key).not.toBeNull();
      expect(q!.factKey).toBe(key);
      expect(solveParts(q!.parts)!.keys).toEqual([key]);
    }
  });
});

describe('a generated pack keeps a record for each question type', () => {
  it('moves a type up a box for quick, correct answers and ignores keys it does not own', () => {
    let now = Date.UTC(2026, 9, 20, 1);
    const p = new BandedPack(GENERATED, [], randomFromSeed('rec'), () => now);
    const q = p.questionFor('round:100:3digit', 'focus', {});
    expect(p.recordAnswer(q, q.answer, 1500).boxAfter).toBe(1);
    now += 5000;
    expect(p.recordAnswer(q, q.answer, 1500).boxAfter).toBe(2);
    expect(p.stats()).toHaveLength(1);
    expect(p.owns('mul:6x7')).toBe(false);
    expect(p.owns('round:100:3digit')).toBe(true);
    const wrong = p.recordAnswer(q, q.answer + 100, 1500);
    expect(wrong.correct).toBe(false);
    expect(wrong.fact).toMatch(/rounded to the nearest 100 is/);
  });
});
