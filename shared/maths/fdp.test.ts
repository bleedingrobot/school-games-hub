/**
 * F.6: fractions, decimals and percentages (and the "ten and" facts). Every generator is checked with answers worked out
 * separately from the code under test (plain arithmetic on what is on screen), choices that come only from named mistakes,
 * the same questions for the same seed, and rebuilding from the numbers that travel with an answer (maths/claim.ts).
 */
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { sameAnswer } from './banded';
import { cleanParams, solveClaim } from './claim';
import { solveParts } from './focus';
import { LADDER, ladderKeyPacks, packIdOfKey, questionForKey } from './ladder';
import { EARLY_FACTS, earlyFactsPack } from './skillPacks/earlyFacts';
import { GENERATED, GENERATED_SKILL_KEYS, generatedPack, solveByNumbers } from './skillPacks/generated';
import { RECORD_KEY } from './skillPacks/generatedKit';
import { labelValue } from './skillPacks/pickKit';

const NEW_SKILLS = ['unit-fraction-of', 'tenths', 'add-tenths', 'decimal-equivalents', 'percent-basic', 'fraction-of', 'times-decimals', 'equivalent-fractions', 'fdp-equivalents', 'percent-of', 'whole-from-fraction'] as const;
const KEYS = NEW_SKILLS.flatMap((id) => GENERATED_SKILL_KEYS[id]);
const pack = generatedPack();

// ---------------------------------------------------------------- separate arithmetic

/** What a part on screen is worth: "3/4", "25%", "0.25", "12 500". */
const worth = (text: string): number => {
  const v = labelValue(text.replace(/ /g, ''));
  if (v === null) throw new Error(`cannot read "${text}"`);
  return v;
};
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

/** Solves "a op b = c" with one "?" in any place (plain numbers only). */
function solveSum(parts: string[]): number {
  const eq = parts.indexOf('=');
  const left = parts.slice(0, eq);
  const right = parts.slice(eq + 1);
  const val = (t: string) => (t === '?' ? NaN : worth(t));
  if (left.length === 1) return val(left[0]) === val(left[0]) ? worth(left[0]) : worth(right[0]);
  const [a, op, b] = [val(left[0]), left[1], val(left[2])];
  const c = val(right[0]);
  const apply = (x: number, y: number) => (op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y);
  if (Number.isNaN(c)) return clean(apply(a, b));
  if (Number.isNaN(a)) return clean(op === '+' ? c - b : op === '−' ? c + b : op === '×' ? c / b : c * b);
  return clean(op === '+' ? c - a : op === '−' ? a - c : op === '×' ? c / a : a / c);
}

/** The answer to a typed question, worked out from its parts, key by key. */
function oracle(key: string, parts: string[]): number {
  const [first, second, third, , fifth] = parts;
  const [n, d] = first.includes('/') ? first.split('/').map(Number) : [NaN, NaN];
  if (key.startsWith('fracof:')) return clean((Number(third.replace(/ /g, '')) * n) / d);
  if (key.startsWith('whole:')) return clean((Number(fifth) * d) / n);
  if (key === 'equiv:missing-top') return clean((n * Number(third.split('/')[0] === '?' ? third.split('/')[1] : 0)) / d);
  if (key === 'equiv:missing-bottom') return clean((Number(third.split('/')[0]) * d) / n);
  if (key === 'equiv:simplify-blank') {
    const [x, y] = third.split('/');
    return y === '?' ? clean((d * Number(x)) / n) : clean((n * Number(y)) / d);
  }
  if (/^pct:(half|ten|quarter|one|twenty|three-quarters|big)$/.test(key)) return clean((Number(third.replace(/ /g, '')) * Number(first.replace('%', ''))) / 100);
  if (key.startsWith('pct:whole:')) return clean((Number(fifth) * 100) / Number(first.replace('%', '')));
  if (key === 'pct:from-fraction' || key === 'fdp:frac-to-pct') return clean((n * 100) / d);
  if (key === 'pct:to-decimal' || key === 'fdp:pct-to-dec') return clean(Number(first.replace('%', '')) / 100);
  if (key === 'fdp:dec-to-pct') return clean(Number(first) * 100);
  if (key === 'deceq:common' || key === 'deceq:hundredths') return clean(n / d);
  if (key === 'tenth:count') return clean(Number(first) * 10);
  if (key === 'tenth:half') return first === 'Half' ? clean(Number(third) / 2) : clean(Number(second) * 2);
  return solveSum(parts);
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const PICK_KEYS = new Set(KEYS.filter((k) => /^(pct:to-fraction|tenth:to-fraction|tenth:to-decimal|deceq:pick|deceq:to-fraction|deceq:compare|equiv:same-as|equiv:simplify|fdp:pct-to-frac|fdp:match)$/.test(k)));

describe('the new skills in the ladder', () => {
  it('every stub from F.6 is built, with its question types, in the ladder order and with the right record packs', () => {
    for (const id of NEW_SKILLS) {
      const skill = LADDER.find((s) => s.id === id)!;
      expect(skill.built, id).toBe(true);
      expect(skill.keys.length, id).toBeGreaterThanOrEqual(5);
      expect(skill.stage, id).toBe('fractions-decimals-percentages');
      for (const key of skill.keys) expect(packIdOfKey(key), key).toBe('generated');
    }
    expect(LADDER.find((s) => s.id === 'ten-and')!.built).toBe(true);
    expect(LADDER.every((s) => s.built)).toBe(true);
    expect(LADDER.filter((s) => s.built)).toHaveLength(LADDER.length);
    // The order of section 12 is untouched.
    const ids = LADDER.map((s) => s.id);
    const before = (a: string, b: string) => expect(ids.indexOf(a), `${a} before ${b}`).toBeLessThan(ids.indexOf(b));
    before('ten-and', 'facts-20');
    before('unit-fraction-of', 'tenths');
    before('tenths', 'add-tenths');
    before('decimal-equivalents', 'percent-basic');
    before('percent-basic', 'fraction-of');
    before('fraction-of', 'times-decimals');
    before('times-decimals', 'equivalent-fractions');
    before('equivalent-fractions', 'squares-cubes');
    before('fdp-equivalents', 'percent-of');
    before('percent-of', 'whole-from-fraction');
    before('whole-from-fraction', 'bedmas');
  });

  it('every key is a valid record key, owned once, and in exactly one skill', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
    for (const key of KEYS) {
      expect(RECORD_KEY.test(key), key).toBe(true);
      expect(GENERATED.families[key], key).toBeDefined();
    }
    const map = ladderKeyPacks();
    for (const key of KEYS) expect(map.get(key), key).toBe('generated');
  });
});

describe('ten and facts', () => {
  const pack10 = earlyFactsPack();
  const keys = EARLY_FACTS.families.tenAnd.keys;

  it('nine facts, one record each, in the early-facts pack', () => {
    expect(keys).toEqual(Array.from({ length: 9 }, (_, i) => `tenand:${i + 1}`));
    for (const key of keys) {
      expect(RECORD_KEY.test(key)).toBe(true);
      expect(packIdOfKey(key)).toBe('early-facts');
    }
    expect(LADDER.find((s) => s.id === 'ten-and')!.keys).toEqual(keys);
  });

  it('every variant is a sum worked out the same by plain arithmetic, and the solver counts it towards the fact', () => {
    const random = randomFromSeed('tenand');
    for (const key of keys) {
      const n = Number(key.split(':')[1]);
      for (let v = 0; v < 4; v++) {
        const q = pack10.rebuild(key, [n, v], true, random)!;
        expect(q, `${key} ${v}`).not.toBeNull();
        expect(q.answer).toBe(solveSum(q.parts));
        expect(q.choices).toHaveLength(4);
        const solved = solveParts(q.parts)!;
        expect(solved.answer).toBe(q.answer);
        expect(solved.keys).toContain(key);
      }
    }
  });

  it('refuses numbers it would never roll', () => {
    expect(pack10.rebuild('tenand:4', [5, 0], false)).toBeNull();
    expect(pack10.rebuild('tenand:4', [4, 4], false)).toBeNull();
    expect(pack10.rebuild('tenand:10', [10, 0], false)).toBeNull();
  });
});

describe.each(KEYS.map((k) => [k] as const))('%s', (key) => {
  const family = GENERATED.families[key];
  const isPick = PICK_KEYS.has(key);

  it('every roll makes a sound question, worked out the same way by separate arithmetic, rebuilt from its numbers', () => {
    const random = randomFromSeed(`f6:${key}`);
    for (let i = 0; i < 300; i++) {
      const params = family.roll(key, random);
      const q = pack.rebuild(key, params, true, random);
      expect(q, `${key} ${JSON.stringify(params)}`).not.toBeNull();
      const where = `${key} ${JSON.stringify(params)} → ${q!.parts.join(' ')}`;
      const made = family.make(key, params)!;
      // The same numbers make the same question, in the same order.
      const again = pack.rebuild(key, params, true, randomFromSeed(`again:${i}`))!;
      expect(again.parts, where).toEqual(q!.parts);
      expect(again.answer, where).toBe(q!.answer);
      expect(again.choices, where).toEqual(isPick ? q!.choices : again.choices);
      expect(again.choiceLabels, where).toEqual(q!.choiceLabels);
      expect(q!.params, where).toEqual(params);
      expect(q!.spoken.length, where).toBeGreaterThan(4);
      expect(q!.spoken, where).not.toMatch(/\d\/\d|%/);
      // A made question has no lone "?" in the spoken text and says "what" for the blank.
      if (q!.parts.some((p) => p === '?' || /^(\d+|\?)\/(\d+|\?)$/.test(p) && p.includes('?'))) expect(q!.spoken, where).toMatch(/what/);
      if (isPick) {
        const labels = q!.choiceLabels!;
        expect(labels.length, where).toBe(key === 'deceq:compare' ? 2 : 4);
        expect(new Set(labels).size, where).toBe(labels.length);
        expect(q!.choices, where).toEqual(labels.map((_, k) => k));
        expect(q!.answer, where).toBeGreaterThanOrEqual(0);
        expect(q!.answer, where).toBeLessThan(labels.length);
        // Every wrong choice is one of the named mistakes, and the right one is not.
        const named = Object.values(made.namedLabels!);
        labels.forEach((label, k) => {
          if (k !== q!.answer) expect(named, `${where} wrong choice ${label}`).toContain(label);
        });
        expect(named, where).not.toContain(labels[q!.answer]);
        expect(made.fact, where).toBeTruthy();
        expect(made.fact, where).toContain(labels[q!.answer]);
        // The right choice is worth what the question says.
        const right = labels[q!.answer];
        const shown = q!.parts.filter((p) => /^[\d.]+(\/\d+)?%?$/.test(p));
        if (key === 'deceq:compare') {
          const [a, b] = labels.map(worth);
          expect(worth(right), where).toBe(Math.max(a, b));
        } else if (key === 'equiv:simplify') {
          const top = shown.find((p) => p.includes('/'))!;
          expect(worth(right), where).toBeCloseTo(worth(top), 9);
          const [rn, rd] = right.split('/').map(Number);
          expect(gcd(rn, rd), where).toBe(1);
        } else {
          const given = shown[0];
          expect(worth(right), where).toBeCloseTo(worth(given), 9);
          // No other choice is worth the same.
          labels.forEach((label, k) => {
            if (k !== q!.answer) expect(Math.abs(worth(label) - worth(right)), `${where} ${label}`).toBeGreaterThan(1e-9);
          });
        }
        // Fractions stay under one.
        for (const label of labels) if (/^\d+\/\d+$/.test(label)) expect(worth(label), `${where} ${label}`).toBeLessThanOrEqual(1);
        // Pick-one questions have no number pad.
        expect(q!.input === 'decimal' ? false : true, where).toBe(true);
      } else {
        expect(q!.answer, where).toBeCloseTo(oracle(key, q!.parts), 9);
        // Four distinct choices when multiple choice is on, one right, every wrong one a named mistake.
        expect(q!.choices, where).toHaveLength(4);
        expect(new Set(q!.choices).size, where).toBe(4);
        expect(q!.choices!.filter((c) => sameAnswer(c, q!.answer)), where).toHaveLength(1);
        const named = Object.values(made.named!);
        for (const c of q!.choices!) if (!sameAnswer(c, q!.answer)) expect(named.some((x) => sameAnswer(x, c)), `${where} wrong choice ${c}`).toBe(true);
        expect(Object.keys(made.named!).length, where).toBeGreaterThanOrEqual(3);
        // The point key exactly when a decimal can be in the answer or a choice.
        const anyDecimal = [q!.answer, ...q!.choices!].some((n) => !Number.isInteger(n));
        if (anyDecimal) expect(q!.input, where).toBe('decimal');
        if (q!.input !== 'decimal') expect(q!.choices!.every(Number.isInteger), where).toBe(true);
        expect(q!.maxLength!, where).toBeGreaterThan(String(q!.answer).length - 1);
        // No question is made from floating-point dust.
        expect(String(q!.answer), where).not.toMatch(/\d{7}/);
      }
      // The server rebuilds the question from the key and numbers and marks against it.
      const claim = solveClaim({ parts: q!.parts, key, params });
      expect(claim, where).toEqual({ answer: q!.answer, keys: [key] });
      expect(solveByNumbers(key, params, q!.parts), where).toEqual({ answer: q!.answer, key });
      // ...and refuses a question that is not the one shown, or another key's numbers.
      expect(solveByNumbers(key, params, [...q!.parts.slice(0, -1), 'x']), where).toBeNull();
      expect(solveClaim({ parts: [...q!.parts, '9'], key, params }), where).toBeNull();
    }
  });

  it('is the same every time for the same seed, and differs for another', () => {
    const run = (seed: string) => {
      const p = generatedPack([], randomFromSeed(seed));
      return Array.from({ length: 12 }, () => p.questionFor(key, 'focus', { multipleChoice: true })).map((q) => [q.parts.join(' '), (q.choiceLabels ?? q.choices!).join(',')]);
    };
    expect(run('s1')).toEqual(run('s1'));
    expect(run('s1')).not.toEqual(run('s2'));
  });

  it('refuses numbers it would never roll', () => {
    const random = randomFromSeed(`bad:${key}`);
    const params = family.roll(key, random);
    expect(pack.rebuild(key, [...params, 1], false)).toBeNull();
    expect(pack.rebuild(key, params.map(() => NaN), false)).toBeNull();
    expect(pack.rebuild(key, params.map(() => -5), false)).toBeNull();
    expect(pack.rebuild(key, params.map(() => 10 ** 9 + 0.5), false)).toBeNull();
    expect(pack.rebuild(key, params.slice(0, -1), false)).toBeNull();
  });

  it('is asked by the ladder with a record for the placement walk', () => {
    const q = questionForKey(key, 7, randomFromSeed(`q:${key}`))!;
    expect(q.factKey).toBe(key);
    expect(q.params?.length).toBeGreaterThan(0);
  });
});

describe('answers that carry their numbers', () => {
  it('cleanParams takes 1 to 12 finite numbers up to a billion, nothing else', () => {
    expect(cleanParams([1, 2.5])).toEqual([1, 2.5]);
    expect(cleanParams([])).toBeNull();
    expect(cleanParams(Array(13).fill(1))).toBeNull();
    expect(cleanParams([1, NaN])).toBeNull();
    expect(cleanParams([1e9 + 1])).toBeNull();
    expect(cleanParams(['1'])).toBeNull();
    expect(cleanParams('1')).toBeNull();
  });

  it('a pick-one question cannot be marked from its parts alone, but can from its key and numbers', () => {
    const random = randomFromSeed('claim');
    const q = pack.rebuild('tenth:to-fraction', GENERATED.families['tenth:to-fraction'].roll('tenth:to-fraction', random), false, random)!;
    expect(solveParts(q.parts)).toBeNull();
    expect(solveClaim({ parts: q.parts })).toBeNull();
    expect(solveClaim({ parts: q.parts, key: 'tenth:to-fraction', params: q.params })!.answer).toBe(q.answer);
  });

  it('a made-up question, a wrong key or changed numbers are refused', () => {
    const q = pack.questionFor('pct:to-fraction', 'focus', {});
    const ok = { parts: q.parts, key: 'pct:to-fraction', params: q.params };
    expect(solveClaim(ok)).not.toBeNull();
    expect(solveClaim({ ...ok, key: 'fdp:pct-to-frac' })).toBeNull();
    // Other numbers that make the same sum make a real question with the choices in another order: it is marked against that one.
    const moved = solveClaim({ ...ok, params: [q.params![0], (q.params![1] + 1) % 4, q.params![2]] });
    expect(moved?.answer === q.answer).toBe(false);
    expect(solveClaim({ ...ok, parts: ['99%', '=', '?'] })).toBeNull();
    expect(solveClaim({ ...ok, params: [999, 0, 0] })).toBeNull();
    expect(solveClaim({ ...ok, key: 'mul:6x7' })).toBeNull();
  });

  it('the old way (parts only) still marks everything before F.6, with or without numbers', () => {
    for (const key of ['round:100:3digit', 'bedmas:brackets-first', 'bond100:fives']) {
      const q = pack.questionFor(key, 'focus', {});
      expect(solveClaim({ parts: q.parts })!.answer).toBe(q.answer);
      expect(solveClaim({ parts: q.parts, key, params: q.params })!.answer).toBe(q.answer);
      // Numbers that do not fit fall back to reading the parts, which still has to match exactly.
      expect(solveClaim({ parts: q.parts, key, params: [1] })!.answer).toBe(q.answer);
    }
    expect(solveClaim({ parts: ['7', '×', '8', '=', '?'], key: 'mul:7x8', params: [7, 8] })!.answer).toBe(56);
  });
});
