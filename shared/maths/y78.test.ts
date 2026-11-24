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
import { labelValue } from './skillPacks/pickKit';

const pack = generatedPack();
const Y78 = LADDER.filter(pastYear6);
const KEYS = Y78.flatMap((s) => s.keys);

/** A number as the screen shows it: "−4" → -4, "8°" → 8, "0.5" → 0.5. */
const num = (text: string) => Number(text.replace(/°C?$/, '').replace('−', '-'));

/** Each card's answers worked out from the screen text alone (shared/maths/y78/*.oracle.ts). */
const ORACLES = Object.values(import.meta.glob<{ oracle: (key: string, parts: string[], prompt: string | undefined) => number | null }>('./y78/*.oracle.ts', { eager: true })).map((m) => m.oracle);
/** Each card's checks of pick questions whose right choice isn't a number (shared/maths/y78/*.picks.ts). */
type PickCheck = (parts: string[], prompt: string, right: string, wrong: string[]) => void;
const PICK_CHECKS: Record<string, PickCheck> = Object.assign({}, ...Object.values(import.meta.glob<{ PICK_CHECKS: Record<string, PickCheck> }>('./y78/*.picks.ts', { eager: true })).map((m) => m.PICK_CHECKS));
const oracle = (key: string, parts: string[], prompt?: string) => {
  for (const o of ORACLES) {
    const found = o(key, parts, prompt);
    if (found !== null) return found;
  }
  return null;
};

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
          worth = Number.isNaN(num(labels[q.answer])) ? (labelValue(labels[q.answer]) ?? NaN) : num(labels[q.answer]);
          PICK_CHECKS[key]?.(q.parts, made.prompt ?? '', labels[q.answer], labels.filter((_, k) => k !== q.answer));
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
