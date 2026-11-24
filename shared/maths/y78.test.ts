/**
 * The Year 7 and 8 skills (docs/plans/ladder-7-8/PLAN.md). Every question type of every Y7-8 skill on the ladder is checked
 * roll by roll: rebuilt the same from its numbers, marked by the server from its numbers, negative answers only ever as four
 * choices to tap (no minus key), wrong choices only from named mistakes, and the right answer worked out separately from the
 * screen text. Also the teacher's "Stop at Year 6" switch.
 */
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { autoPools, LADDER, ladderProgress, pastYear6 } from './ladder';
import { GENERATED, generatedPack, solveByNumbers } from './skillPacks/generated';

const pack = generatedPack();
const Y78 = LADDER.filter(pastYear6);
const KEYS = Y78.flatMap((s) => s.keys);

/** A number as the screen shows it: "−4" → -4, "−3°C" → -3, "8°" → 8. */
const num = (text: string) => Number(text.replace(/°C?$/, '').replace('−', '-'));

/** The right answer worked out from what is on screen, without the generators. Null when a key has no check here yet. */
function oracle(key: string, parts: string[], prompt?: string): number | null {
  if (key === 'int:smallest') return Math.min(...prompt!.replace(/^Which is the smallest\? /, '').split(', ').map(num));
  if (key === 'int:compare-dec') return null; // checked against its choices below
  if (key.startsWith('int:')) {
    const [a, op, b, , c] = parts;
    if (c !== '?' && !c.startsWith('?')) return num(c) - num(a); // a + ? = c
    return op === '+' ? num(a) + num(b) : num(a) - num(b);
  }
  return null;
}

describe('Year 7 and 8 skills', () => {
  it('every roll is sound, repeatable, marked from its numbers, and right by separate arithmetic', () => {
    expect(KEYS.length).toBeGreaterThan(0);
    for (const key of KEYS) {
      const family = GENERATED.families[key];
      expect(family, key).toBeTruthy();
      const random = randomFromSeed(`y78:${key}`);
      for (let i = 0; i < 40; i++) {
        const params = family.roll(key, random);
        const q = pack.rebuild(key, params, false, random)!;
        const where = `${key} ${JSON.stringify(params)} → ${q?.parts.join(' ')}`;
        expect(q, where).not.toBeNull();
        const made = family.make(key, params)!;
        const again = pack.rebuild(key, params, false, randomFromSeed(`again:${i}`))!;
        expect(again.parts, where).toEqual(q.parts);
        expect(again.choiceLabels, where).toEqual(q.choiceLabels);
        expect(q.spoken, where).not.toMatch(/−|\?\s*\?/);
        // The server marks the same question from the numbers it travels with.
        expect(solveByNumbers(key, params, q.parts)?.answer, where).toBe(q.answer);
        let worth: number;
        if (made.pick) {
          const labels = q.choiceLabels!;
          expect(labels.length, where).toBe(4);
          expect(new Set(labels).size, where).toBe(4);
          const named = Object.values(made.namedLabels!);
          labels.forEach((label, k) => {
            if (k !== q.answer) expect(named, `${where} wrong choice ${label}`).toContain(label);
          });
          expect(made.fact, where).toContain(labels[q.answer]);
          worth = num(labels[q.answer]);
          if (key === 'int:compare-dec') expect(worth, where).toBe(Math.min(...labels.map(num)));
        } else {
          // Typed answers are never below zero: the pad has no minus key.
          expect(q.answer, where).toBeGreaterThanOrEqual(0);
          worth = q.answer;
        }
        const expected = oracle(key, q.parts, made.prompt);
        if (expected !== null) expect(worth, where).toBe(expected);
      }
    }
  });

  it('"Stop at Year 6" keeps a pupil off Year 7 and 8: none asked, none counted', () => {
    // A pupil placed just past the Year 6 top: their next skill is the first Year 7 one, unless they are stopped at Year 6.
    const floor = LADDER.indexOf(Y78[0]);
    expect(LADDER[floor - 1].id).toBe('bedmas');
    const open = ladderProgress([], { floor });
    const capped = ladderProgress([], { floor, capAtYear6: true });
    expect(open.skills.find((p) => p.skill.id === Y78[0].id)?.status).toBe('current');
    for (const p of capped.skills.filter((p) => pastYear6(p.skill))) expect(p.status, p.skill.id).toBe('later');
    const asked = (pools: ReturnType<typeof autoPools>) => [...pools.focus, ...pools.review, ...pools.stretch];
    expect(asked(autoPools(open)).some((k) => KEYS.includes(k))).toBe(true);
    expect(asked(autoPools(capped)).some((k) => KEYS.includes(k))).toBe(false);
  });
});
