import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { BandedPack, sameAnswer } from './banded';
import type { Question } from './skillPack';
import { BANDED_PACKS, EXTRA_PACKS, makePack } from './skillPacks';

const PACKS = [...Object.values(BANDED_PACKS), ...Object.values(EXTRA_PACKS)];

/** Reads a number as shown on screen: "12 500", "$2.40", "−3". */
const num = (text: string) => Number(text.replace(/^\$/, '').replace(/ /g, '').replace('−', '-'));
const fracValue = (text: string) => {
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(text);
  return m ? Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]) : NaN;
};

/** A pick-one question: the answer is the bigger of its two labels, or the deal that is cheaper for each one. */
function pickedRight(q: Pick<Question, 'parts' | 'answer' | 'choiceLabels'>): boolean {
  const deals = [...q.parts.join(' ').matchAll(/(\d+) [a-z ]+ for (\d+) gold/g)].map((m) => Number(m[2]) / Number(m[1]));
  if (deals.length === 2) return deals[q.answer] < deals[1 - q.answer];
  const values = q.choiceLabels!.map((l) => (l.includes('/') ? fracValue(l) : num(l)));
  return values.length === 2 && values[q.answer] > values[1 - q.answer];
}

/**
 * Works a question out from what's on screen alone, for the plain sums ("47 + 36 = ?",
 * "$10.00 − $3.65 = $ ?", "? ÷ 4 = 7"). Undefined for anything else (words, fractions).
 */
function solveFromScreen(parts: string[]): number | undefined {
  const p = parts.filter((x) => x !== '$');
  if (p.length !== 5 || p[3] !== '=' || !['+', '−', '×', '÷'].includes(p[1])) return undefined;
  const [a, op, b, , c] = p;
  if ([a, b, c].some((x) => x !== '?' && Number.isNaN(num(x)))) return undefined;
  const apply = (x: number, y: number) => (op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y);
  const undo = (target: number, known: number, blankFirst: boolean) => {
    if (op === '+') return target - known;
    if (op === '×') return target / known;
    if (op === '−') return blankFirst ? target + known : known - target;
    return blankFirst ? target * known : known / target;
  };
  if (c === '?') return apply(num(a), num(b));
  if (a === '?') return undo(num(c), num(b), true);
  if (b === '?') return undo(num(c), num(a), false);
  return undefined;
}

describe('the topic packs (Maths Monsters, and money and patterns)', () => {
  it('every family makes sound questions, right when worked out from the screen, and the same again from its numbers', () => {
    const bad: string[] = [];
    for (const def of PACKS) {
      const pack = new BandedPack(def);
      const random = randomFromSeed(`pack-test:${def.id}`);
      for (const family of Object.values(def.families)) {
        // Fact families: every key a few times. Others: lots of rolls of their one key.
        const keys = family.keys.length > 1 ? family.keys.flatMap((k) => [k, k]) : Array(100).fill(family.keys[0]);
        for (const key of keys) {
          const params = family.roll(key, random);
          const q = pack.rebuild(key, params, true, random);
          if (!q) {
            bad.push(`${key} ${JSON.stringify(params)}: no question`);
            continue;
          }
          const solved = solveFromScreen(q.parts);
          const again = pack.rebuild(key, params);
          const sound =
            Number.isFinite(q.answer) &&
            q.answer >= 0 &&
            (q.input === 'decimal' || Number.isInteger(q.answer)) &&
            // Different choices, exactly one of them right (a pick question's labels are its choices).
            new Set(q.choices).size === q.choices?.length &&
            q.choices.filter((c) => sameAnswer(c, q.answer)).length === 1 &&
            (!q.choiceLabels || pickedRight(q)) &&
            !pack.factText({ ...q }).includes('?') &&
            (solved === undefined || sameAnswer(solved, q.answer)) &&
            again?.answer === q.answer &&
            again.parts.join(' ') === q.parts.join(' ');
          if (!sound) bad.push(`${key} ${JSON.stringify(params)} → ${q.parts.join(' ')} = ${q.answer}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('decimal answers are marked right however the float lands', () => {
    const pack = makePack('decimals', [], randomFromSeed('float'));
    const q = pack.nextQuestion({ level: 1 })!;
    expect(pack.recordAnswer(q, q.answer + 1e-12, 1000).correct).toBe(true);
    expect(pack.recordAnswer(q, q.answer + 0.1, 1000).correct).toBe(false);
  });
});
