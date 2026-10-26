/**
 * Every question the ladder can ask: every question type of every built skill, many rolls each. Each one is well formed,
 * the server marks it the same way, and the answer is right when it is put back into the sum and worked out with plain
 * arithmetic (separately from the generators). No wrong choice works.
 */
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { BandedPack, sameAnswer } from './banded';
import { solveClaim } from './claim';
import { solveParts } from './focus';
import { LADDER } from './ladder';
import type { Question, QuestionContext } from './skillPack';
import { BANDED_PACKS } from './skillPacks';
import { earlyFactsPack } from './skillPacks/earlyFacts';
import { GENERATED, generatedPack } from './skillPacks/generated';
import { labelValue } from './skillPacks/pickKit';
import { TimesTables } from './skillPacks/timesTables';

/** Rolls of each question type (a times-table or adding fact is always the same sum, so it needs few). */
const ROLLS = { generated: 50, fact: 2 };

function askEverything(): Question[] {
  const random = randomFromSeed('every-question');
  const generated = generatedPack([], random);
  const packs = [earlyFactsPack([], random), new BandedPack(BANDED_PACKS['add-sub'], [], random), new TimesTables([], random), new BandedPack(BANDED_PACKS.division, [], random), generated];
  const ctx: QuestionContext = { multipleChoice: true, missingFactor: true };
  return LADDER.filter((s) => s.built).flatMap((s) => s.keys).flatMap((key) => {
    const pack = packs.find((p) => p.owns(key));
    if (!pack) throw new Error(`no pack asks ${key}`);
    return Array.from({ length: pack === generated ? ROLLS.generated : ROLLS.fact }, () => pack.questionFor(key, 'focus', ctx));
  });
}
const QUESTIONS = askEverything();

/** A number as the screen shows it: "12 500" → 12500. */
const num = (text = '') => Number(text.replace(/ /g, ''));
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const calc = (text: string) => Function(`"use strict"; return (${text});`)() as number;
const WORDS: Record<string, string> = { of: '*', Double: '2 *', Half: '0.5', squared: '** 2', cubed: '** 3', };

/** Whether the question is true with `blank` written in for the "?" (a number, or a choice's label). */
function holds(parts: string[], blank: string, choices: string[]): boolean {
  const p = parts.map((part) => part.replace('?', blank));
  const [n, m, a] = [num(p[1]), num(p[3]), Number(blank)];
  switch (parts[0]) {
    case 'Which is bigger?':
      return choices.every((c) => labelValue(c)! <= labelValue(blank)!);
    case 'Round': {
      // 5 and over rounds up.
      const unit = parts[2].replace('to the nearest ', '');
      const size = unit === 'whole number' ? 1 : unit === 'tenth' ? 0.1 : unit === 'hundredth' ? 0.01 : num(unit);
      return sameAnswer(a, Math.floor(n / size + 0.5 + 1e-9) * size);
    }
    case 'Simplify': {
      const [top, bottom] = blank.split('/').map(Number);
      return gcd(top, bottom) === 1 && sameAnswer(labelValue(blank)!, labelValue(parts[1])!);
    }
    case 'Square root of':
      return a * a === n;
    case 'Cube root of':
      return a ** 3 === n;
    case 'The next square number after':
      return Number.isInteger(Math.sqrt(a)) && a > n && (Math.sqrt(a) - 1) ** 2 <= n;
    case 'Biggest factor of':
      return a === Math.max(...divisors(n).filter((d) => d < n));
    case 'Biggest number that goes into':
      return a === Math.max(...divisors(n).filter((d) => m % d === 0));
    case 'How many factors does':
      return a === divisors(n).length;
  }
  if (parts[3] === 'are a factor pair of') return num(p[0]) * num(p[2]) === num(p[4]);
  const text = p
    .map((part) => WORDS[part] ?? (/^[\d ]+$/.test(part) ? part.replace(/ /g, '') : part.replace(/%/g, ' / 100')))
    .join(' ')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
  const [left, right] = text.split('=');
  return Math.abs(calc(left) - calc(right)) < 1e-9;
}

describe('every question the ladder asks', () => {
  // Each test lists the questions that fail (one expect each, so thousands of questions stay quick).
  const shown = (q: Question) => `${q.factKey}: ${q.parts.join(' ')} → ${q.answer}`;

  it('is well formed, and the server marks it the same way from what the browser sends', () => {
    const sound = (q: Question) => {
      const solved = solveClaim({ parts: q.parts, key: q.factKey, params: q.params });
      return (
        Number.isFinite(q.answer) &&
        q.answer >= 0 &&
        (q.input === 'decimal' || Number.isInteger(q.answer)) &&
        q.spoken.length > 4 &&
        // Different choices, exactly one of them right.
        new Set(q.choices).size === q.choices?.length &&
        q.choices.filter((c) => sameAnswer(c, q.answer)).length === 1 &&
        solved?.answer === q.answer &&
        solved.keys.includes(q.factKey)
      );
    };
    expect(QUESTIONS.filter((q) => !sound(q)).map(shown)).toEqual([]);
  });

  it('has a right answer worked out separately, and no wrong choice that also works', () => {
    const right = (q: Question) => {
      const choices = q.choiceLabels ?? q.choices!.map(String);
      const answer = q.choiceLabels ? q.choiceLabels[q.answer] : String(q.answer);
      return holds(q.parts, answer, choices) && !choices.some((c) => c !== answer && holds(q.parts, c, choices));
    };
    expect(QUESTIONS.filter((q) => !right(q)).map(shown)).toEqual([]);
  });

  it('gets the famous ones right: 2 + 3 × 4 = 14, and halves round up (65 → 70, 350 → 400, 4.15 → 4.2)', () => {
    expect(solveParts(['2', '+', '3', '×', '4', '=', '?'])!.answer).toBe(14);
    const fam = GENERATED.families;
    expect(fam['round:10:halfway'].make('round:10:halfway', [65])!.answer).toBe(70);
    expect(fam['round:100:halfway'].make('round:100:halfway', [350])!.answer).toBe(400);
    expect(fam['round:tenth:halfway'].make('round:tenth:halfway', [415])!.answer).toBe(4.2);
  });

  it('the server refuses questions it would never ask, other records and changed numbers', () => {
    const pack = generatedPack();
    for (const family of Object.values(GENERATED.families)) {
      for (const key of family.keys) {
        const params = family.roll(key, randomFromSeed(key));
        expect(pack.rebuild(key, params.map(() => -5), false), key).toBeNull();
        expect(pack.rebuild(key, [...params, 1], false), key).toBeNull();
      }
    }
    expect(solveParts(['7', '+', '3', '=', '10'])).toBeNull(); // nothing to answer
    expect(solveParts(['3', '−', '7', '=', '?'])).toBeNull(); // negative
    expect(solveParts(['7', '÷', '2', '=', '?'])).toBeNull(); // not whole
    expect(solveParts(['999', '+', '999', '=', '?'])).toBeNull(); // no skill asks it
    expect(solveParts('7 + 3 = ?')).toBeNull();
    const q = generatedPack([], randomFromSeed('claim')).questionFor('pct:to-fraction', 'focus', {});
    const ok = { parts: q.parts, key: 'pct:to-fraction', params: q.params };
    expect(solveClaim(ok)!.answer).toBe(q.answer);
    expect(solveClaim({ ...ok, key: 'fdp:pct-to-frac' })).toBeNull();
    expect(solveClaim({ ...ok, params: [999, 0, 0] })).toBeNull();
    expect(solveClaim({ ...ok, parts: ['99%', '=', '?'] })).toBeNull();
  });
});
