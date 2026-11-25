/**
 * The Year 6 skills (docs/plans/ladder-y6/PLAN.md) and the Year 7 and 8 skills (docs/plans/ladder-7-8/PLAN.md). Every question type of every Y7-8 skill on the ladder is checked
 * roll by roll: rebuilt the same from its numbers, marked by the server from its numbers, negative answers only ever as four
 * choices to tap (no minus key), wrong choices only from named mistakes, and the right answer worked out separately from the
 * screen text. Also the teacher's "Stop at Year 6" switch.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { autoPools, LADDER, ladderProgress, pastYear6 } from './ladder';
import { GENERATED, generatedPack, solveByNumbers } from './skillPacks/generated';
import { Y6_LADDER } from './skillPacks/y6';
import { labelValue } from './skillPacks/pickKit';

const pack = generatedPack();
const Y78 = LADDER.filter(pastYear6);
/** Every question type of the Year 6, 7 and 8 skills, checked roll by roll below. */
const KEYS = LADDER.filter((s) => (s.year ?? 0) >= 6).flatMap((s) => s.keys);
const Y78_KEYS = Y78.flatMap((s) => s.keys);

/** A number as the screen shows it: "−4" → -4, "8°" → 8, "0.5" → 0.5. */
const num = (text: string) => Number(text.replace(/°C?$/, '').replace('−', '-'));

/** Each card's answers worked out from the screen text alone (shared/maths/y78/*.oracle.ts). */
const ORACLES = Object.values(import.meta.glob<{ oracle: (key: string, parts: string[], prompt: string | undefined) => number | null }>(['./y78/*.oracle.ts', './y6/*.oracle.ts'], { eager: true })).map((m) => m.oracle);
/** Each card's checks of pick questions whose right choice isn't a number (shared/maths/y78/*.picks.ts). */
type PickCheck = (parts: string[], prompt: string, right: string, wrong: string[]) => void;
const PICK_CHECKS: Record<string, PickCheck> = Object.assign({}, ...Object.values(import.meta.glob<{ PICK_CHECKS: Record<string, PickCheck> }>(['./y78/*.picks.ts', './y6/*.picks.ts'], { eager: true })).map((m) => m.PICK_CHECKS));
const oracle = (key: string, parts: string[], prompt?: string) => {
  for (const o of ORACLES) {
    const found = o(key, parts, prompt);
    if (found !== null) return found;
  }
  return null;
};

describe('Year 6 skills', () => {
  it('each sits straight after the skill its row names, is on auto, and stays out of the warm-up', () => {
    for (const row of Y6_LADDER) {
      const at = LADDER.findIndex((s) => s.id === row.id);
      expect(at, row.id).toBeGreaterThan(0);
      expect(LADDER[at - 1].id, row.id).toBe(row.after);
      expect(LADDER[at]).toMatchObject({ year: 6, built: true, inWarmUp: false });
      expect(LADDER[at].inAuto, row.id).toBeUndefined();
      expect(LADDER[at].keys.length, row.id).toBeGreaterThan(0);
      expect(pastYear6(LADDER[at]), row.id).toBe(false);
    }
  });
});

describe('Year 7 and 8 skills', () => {
  it('every roll is sound, repeatable, marked from its numbers, and right by separate arithmetic', () => {
    expect(KEYS.length).toBeGreaterThan(0);
    // Every Year 7-8 question type is tagged with its skill and year in the database (maths_content_years), and nothing else.
    const tagged = [...readFileSync(resolve(__dirname, '../../supabase/migrations/20261126000500_maths_content_years.sql'), 'utf8').matchAll(/^  \('([^']+)', '([^']+)', '(?:[^']|'')+', ([78])\)/gm)].map((m) => `${m[1]} ${m[2]} ${m[3]}`);
    expect(tagged.sort()).toEqual(Y78.flatMap((s) => s.keys.map((k) => `${k} ${s.id} ${s.year}`)).sort());
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

  it('Year 7-8 skills are only asked once the class is taught them, and never for a pupil stopped at Year 6', () => {
    // A pupil placed just past the Year 6 top.
    const floor = LADDER.indexOf(Y78[0]);
    expect(LADDER[floor - 1].year ?? 6).toBe(6); // the Year 6 top (order of operations, or a Year 6 skill slotted after it)
    const first = Y78[0].id;
    const later = (opts: Parameters<typeof ladderProgress>[1]) => ladderProgress([], { floor, ...opts }).skills.filter((p) => pastYear6(p.skill) && p.status !== 'later').map((p) => p.skill.id);
    const asked = (opts: Parameters<typeof ladderProgress>[1]) => {
      const pools = autoPools(ladderProgress([], { floor, ...opts }), opts);
      return [...pools.focus, ...pools.review, ...pools.stretch];
    };
    // Nothing taught: no Year 7-8 skill is on the path or asked.
    expect(later({})).toEqual([]);
    expect(asked({}).some((k) => Y78_KEYS.includes(k))).toBe(false);
    // Taught: only that skill, and it is the next one.
    expect(later({ y78Taught: [first] })).toEqual([first]);
    expect(ladderProgress([], { floor, y78Taught: [first] }).current?.id).toBe(first);
    expect(asked({ y78Taught: [first] }).filter((k) => Y78_KEYS.includes(k)).every((k) => Y78[0].keys.includes(k))).toBe(true);
    // Stopped at Year 6 wins over taught.
    expect(later({ y78Taught: Y78.map((s) => s.id), capAtYear6: true })).toEqual([]);
    expect(asked({ y78Taught: Y78.map((s) => s.id), capAtYear6: true }).some((k) => Y78_KEYS.includes(k))).toBe(false);
  });
});
