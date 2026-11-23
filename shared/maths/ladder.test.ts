import { } from 'node:os';
import { } from 'node:path';
import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { } from './config';
import { } from './facts';
import { newStats, type FactStats } from './leitner';
import { AutoPack, LADDER, ladderProgress, } from './ladder';
import { sameAnswer } from './banded';
import { skillTinyLabel, TINY_LABEL_MAX } from './skillNames';
import { } from './skillPacks';
import { earlyFactsPack, EARLY_FACTS, solveSkip } from './skillPacks/earlyFacts';
import { } from './skillPacks/generatedKit';
import { solveParts } from './focus';

const rec = (key: string, box: number): FactStats => ({ ...newStats(key), attempts: 3, correct: 3, box });
const secure = (keys: string[]) => keys.map((k) => rec(k, 3));
// The built skills on the ladder (the part-whole skills sit beside it: see `inAuto`).
const built = LADDER.filter((s) => s.built && s.inAuto !== false);

/** Reads a question off the screen for the plain sums the early facts ask. */
function solve(parts: string[]): number {
  const text = parts.join(' ');
  let m = /^(\d+) \+ (\d+) = \?$/.exec(text);
  if (m) return +m[1] + +m[2];
  m = /^Double (\d+) = \?$/.exec(text);
  if (m) return 2 * +m[1];
  m = /^Half of (\d+) = \?$/.exec(text);
  if (m) return +m[1] / 2;
  m = /^(\d+) ÷ (\d+) = \?$/.exec(text);
  if (m) return +m[1] / +m[2];
  m = /^(\d+) ÷ \? = (\d+)$/.exec(text);
  if (m) return +m[1] / +m[2];
  m = /^(\d+) − (\d+) = \?$/.exec(text);
  if (m) return +m[1] - +m[2];
  m = /^(\d+) = (\d+) \+ \?$/.exec(text);
  if (m) return +m[1] - +m[2];
  m = /^(\d+) \+ \? = (\d+)$/.exec(text);
  if (m) return +m[2] - +m[1];
  m = /^\? \+ (\d+) = (\d+)$/.exec(text);
  if (m) return +m[2] - +m[1];
  // Skip counting: "20, 30, ?, 50". The gap is the number that keeps every step the same.
  const pads = parts.map((p) => p.replace(/,$/, ''));
  if (pads.length >= 4 && pads.filter((p) => p === '?').length === 1 && pads.every((p) => p === '?' || /^\d+$/.test(p))) {
    const gap = pads.indexOf('?');
    const [i, j] = gap < 2 ? [2, 3] : [0, 1];
    const step = +pads[j] - +pads[i];
    const answer = +pads[i] + step * (gap - i);
    return pads.every((p, k) => +(p === '?' ? answer : p) === answer + step * (k - gap)) ? answer : NaN;
  }
  return NaN;
}

// The number-line, tens-and-ones and equal-rows keys are pictures in the game; their typed forms are checked by solveLine and solveArray below.
const LINE_KEY = /^(place100|read100|tens100|near10|near100|zoom|place1000|read1000|pvbuild3?|pvread3?|pvzero|pvregroup|pvten|pvhun|eq[a-z]+|rows|turn|share|cut|which|give|howmany|counton|across):/; // (and Parrot's equals keys, checked in equals.test.ts, and Robin's counting keys, in counting.test.ts)

describe('the early facts pack', () => {
  const pack = earlyFactsPack([], randomFromSeed(String(3)));
  const keys = Object.values(EARLY_FACTS.families).flatMap((f) => f.keys);

  it('asks only correct questions, with a distinct right answer among the choices', () => {
    for (const key of keys.filter((k) => !k.startsWith('oddeven:') && !LINE_KEY.test(k))) {
      for (let i = 0; i < 12; i++) {
        const q = pack.questionFor(key, 'focus', { multipleChoice: true });
        expect(q.factKey).toBe(key);
        expect(sameAnswer(solve(q.parts), q.answer), `${key}: ${q.parts.join(' ')}`).toBe(true);
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices).toContain(q.answer);
        expect(q.choices!.every((c) => c >= 0 && Number.isInteger(c))).toBe(true);
      }
    }
  });
});

describe('the ladder', () => {
  it('has no key in two skills, every key is owned by a pack, and every skill has a short name (Skill map headers)', () => {
    const seen = new Map<string, string>();
    const auto = new AutoPack();
    for (const skill of built) {
      expect(skill.keys.length).toBeGreaterThan(0);
      expect([...skillTinyLabel(skill.id)].length, `${skill.id} needs a short name in skillNames.ts`).toBeLessThanOrEqual(TINY_LABEL_MAX);
      for (const key of skill.keys) {
        expect(seen.get(key), `${key} is in ${seen.get(key)} and ${skill.id}`).toBeUndefined();
        seen.set(key, skill.id);
        expect(() => (auto as unknown as { ownerOf(k: string): unknown }).ownerOf(key)).not.toThrow();
      }
    }
    // Review gives each skill a fair turn: with the whole ladder secure, skip counting (78 facts) comes up about as often as
    // order of operations (7 facts), not ten times as often.
    const done = new AutoPack(built.flatMap((s) => secure(s.keys)), randomFromSeed('ladder-review'));
    const asked = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const key = done.nextQuestion()!.factKey;
      const skill = built.find((s) => s.keys.includes(key))!.id;
      asked.set(skill, (asked.get(skill) ?? 0) + 1);
    }
    const skip = ['skip-10', 'skip-5', 'skip-2'].reduce((n, id) => n + (asked.get(id) ?? 0), 0) / 3;
    expect(skip / (asked.get('bedmas') ?? 1)).toBeLessThan(2);

    // Checking off: a skill behind the student that was only asked once (box 1) comes up far more than secure ones, and a right
    // answer brings that fact back a few questions on, so two right and quick make it secure in the same session.
    const skip2 = built.find((s) => s.id === 'skip-2')!.keys;
    const once = built.flatMap((s) => (s.id === 'skip-2' ? skip2.map((k) => rec(k, 1)) : secure(s.keys)));
    const check = new AutoPack(once, randomFromSeed('check-off'), Date.now, { floor: LADDER.length });
    const order: string[] = [];
    for (let i = 0; i < 300; i++) {
      const q = check.nextQuestion()!;
      order.push(q.factKey);
      check.recordAnswer(q, q.answer, 1000);
    }
    const back = order.findIndex((k, i) => skip2.includes(k) && order.indexOf(k) < i);
    expect(back).toBeGreaterThan(-1);
    expect(order.filter((k) => skip2.includes(k)).length).toBeGreaterThan(order.filter((k) => k.startsWith('bedmas:')).length * 4);
    expect(ladderProgress(check.stats(), { floor: LADDER.length }).skills.find((p) => p.skill.id === 'skip-2')!.passedOver).toBe(false);
  });
});

describe('ladder progress', () => {

  it('moves on at 70% in box 2 or higher, and holds back just under it', () => {
    const keys = built[0].keys;
    const need = Math.ceil(keys.length * 0.7);
    expect(ladderProgress(secure(keys.slice(0, need - 1))).current?.id).toBe(built[0].id);
    const p = ladderProgress(secure(keys.slice(0, need)));
    expect(p.current?.id).toBe(built[1].id);
    expect(p.secureCount).toBe(1);
    expect(p.percent).toBe(Math.round(100 / built.length));
  });
});

describe('skip counting in tens, fives and twos', () => {
  const steps = [
    { id: 'skip-10', family: 'skip10', step: 10, upTo: 100 },
    { id: 'skip-5', family: 'skip5', step: 5, upTo: 50 },
    { id: 'skip-2', family: 'skip2', step: 2, upTo: 20 },
  ];

  it('the server reads each question back from how it was shown, or from its numbers, and refuses anything else', () => {
    const pack = earlyFactsPack([], randomFromSeed('skip-solve'));
    for (const { family } of steps) {
      for (const key of EARLY_FACTS.families[family].keys) {
        const q = pack.questionFor(key, 'focus');
        expect(solveParts(q.parts), key).toEqual({ answer: q.answer, keys: [key] });
        expect(pack.rebuild(key, q.params!)?.parts).toEqual(q.parts);
      }
    }
    expect(solveSkip(['20,', '30,', '?,', '45'])).toBeNull(); // not an even step
    expect(solveSkip(['3,', '5,', '?,', '9'])).toBeNull(); // not multiples of 2
    expect(solveSkip(['180,', '190,', '200,', '?'])).toBeNull(); // past 200
    expect(solveSkip(['20', '30', '?', '50'])).toBeNull(); // not as it is shown
    expect(pack.rebuild('skip10:up:40', [40, 3])).toBeNull();
    expect(pack.rebuild('skip10:up:40', [30, 1])).toBeNull();
    expect(pack.rebuild('skip10:back:90', [90, 2])).toBeNull(); // would start at 110
  });
});

