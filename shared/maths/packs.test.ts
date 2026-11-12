import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { BandedPack, sameAnswer, type PackDefinition } from './banded';
import { CHOICES } from './config';
import { BANDED_PACKS, EXTRA_PACKS } from './skillPacks';

const PACKS: PackDefinition[] = [...Object.values(BANDED_PACKS), ...Object.values(EXTRA_PACKS)];

/** Reads a number as shown on screen: "12 500", "$2.40", "−3". */
const num = (text: string) => Number(text.replace(/^\$/, '').replace(/ /g, '').replace('−', '-'));
const fracValue = (text: string) => {
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(text);
  return m ? Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]) : NaN;
};

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

describe('banded maths packs', () => {
  it('every roll of every family makes a sound question the server can rebuild and refuse to fake', () => {
    for (const def of PACKS) {
      const pack = new BandedPack(def);
      const inBands = [...def.bands.flat(), ...(def.ladderOnly ?? [])];
      expect(new Set(inBands), def.id).toEqual(new Set(Object.keys(def.families)));
      const allKeys = Object.values(def.families).flatMap((f) => f.keys);
      expect(new Set(allKeys).size, def.id).toBe(allKeys.length);

      for (const [name, family] of Object.entries(def.families)) {
        const random = randomFromSeed(`pack-test:${name}`);
        const keys = family.keys.length > 1 ? family.keys.flatMap((k) => [k, k, k]) : Array(60).fill(family.keys[0]);
        for (const key of keys) {
          const params = family.roll(key, random);
          const q = pack.rebuild(key, params, true, random)!;
          const where = `${def.id}/${key} ${JSON.stringify(params)}`;
          expect(q, where).not.toBeNull();
          expect(Number.isFinite(q.answer), where).toBe(true);
          expect(q.answer, where).toBeGreaterThanOrEqual(0);
          if (q.input !== 'decimal') expect(Number.isInteger(q.answer), where).toBe(true);
          if (q.choiceLabels) {
            expect(q.choices, where).toEqual([0, 1]);
            expect(new Set(q.choiceLabels).size, where).toBe(2);
            const values = q.choiceLabels.map((l) => (l.includes('/') ? fracValue(l) : num(l)));
            if (values.every((v) => !Number.isNaN(v))) expect(values[q.answer], where).toBeGreaterThan(values[1 - q.answer]);
          } else {
            expect(q.parts.filter((p) => p.includes('?')).length, where).toBeGreaterThanOrEqual(1);
            expect(pack.factText({ ...q }), where).not.toContain('?');
            expect(q.choices, where).toHaveLength(CHOICES);
            expect(new Set(q.choices).size, where).toBe(CHOICES);
            expect(q.choices!.filter((c) => sameAnswer(c, q.answer)), where).toHaveLength(1);
          }
          const solved = solveFromScreen(q.parts);
          if (solved !== undefined) expect(sameAnswer(solved, q.answer), where).toBe(true);
          const again = pack.rebuild(key, params)!;
          expect(again.parts, where).toEqual(q.parts);
          expect(again.answer, where).toBe(q.answer);
        }
        const key = family.keys[0];
        for (const params of [[], [-1, -1, -1, -1], [1.5, 2.5, 0.5, 0.5], [1e6, 1e6, 1e6, 1e6], [NaN, NaN, NaN, NaN]]) {
          expect(pack.rebuild(key, params), `${key} ${JSON.stringify(params)}`).toBeNull();
        }
        expect(pack.rebuild('not-a-key', family.roll(key, random))).toBeNull();
      }
    }
  });
});
