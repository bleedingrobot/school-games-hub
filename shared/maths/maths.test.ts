import { describe, expect, it } from 'vitest';
import { randomFromSeed } from '../space/random';
import { BOX_WEIGHTS, MIX, QUICK_MS, REPEAT_AFTER, TOP_BOX } from './config';
import { factKey, factsIn, parseFactKey, tableFacts } from './facts';
import { afterAnswer, mastery, newStats, nzDay, type FactStats } from './leitner';
import { newMemory, pickFact, poolsFor, scheduleRepeat, type Band } from './selector';
import { TimesTables, choicesFor } from './skillPacks/timesTables';

const DAY1 = Date.parse('2026-10-15T22:00:00Z'); // 16 October in New Zealand
const DAY2 = DAY1 + 24 * 3600 * 1000;

const box = (key: string, b: number, extra: Partial<FactStats> = {}): FactStats => ({
  ...newStats(key),
  attempts: 3,
  correct: 3,
  box: b,
  ...extra,
});

describe('facts', () => {
  it('7 × 8 and 8 × 7 are one fact', () => {
    expect(factKey(7, 8)).toBe('mul:7x8');
    expect(factKey(8, 7)).toBe('mul:7x8');
    expect(parseFactKey('mul:7x8')).toEqual({ a: 7, b: 8 });
    expect(parseFactKey('mul:8x7')).toBeNull();
    expect(parseFactKey('mul:3x13')).toBeNull();
  });

  it('a table has 12 facts, and shared facts are only counted once', () => {
    expect(tableFacts(5)).toHaveLength(12);
    expect(tableFacts(5)).toContain('mul:2x5');
    // ×2 and ×5 share 2 × 5.
    expect(factsIn([2, 5]).size).toBe(23);
  });
});

describe('mastery boxes', () => {
  const s0 = newStats('mul:7x8');

  it('correct and quick moves up one box', () => {
    expect(afterAnswer(s0, true, 2000, DAY1).box).toBe(1);
  });

  it('correct but slow stays in the same box', () => {
    const s = { ...s0, box: 2 };
    expect(afterAnswer(s, true, QUICK_MS + 1, DAY1).box).toBe(2);
  });

  it('wrong drops to box 1', () => {
    expect(afterAnswer({ ...s0, box: 3 }, false, 1000, DAY1).box).toBe(1);
  });

  it('reaching fluent (box 4) needs quick correct answers on two different days', () => {
    let s = s0;
    for (let i = 0; i < 6; i++) s = afterAnswer(s, true, 1500, DAY1 + i * 60_000);
    expect(s.box).toBe(TOP_BOX - 1);
    expect(mastery(s)).toBe('secure');
    s = afterAnswer(s, true, 1500, DAY2);
    expect(s.box).toBe(TOP_BOX);
    expect(mastery(s)).toBe('fluent');
  });

  it('keeps attempts, correct, average time and when it was last seen', () => {
    let s = afterAnswer(s0, true, 2000, DAY1);
    s = afterAnswer(s, false, 4000, DAY1 + 1000);
    expect(s).toMatchObject({ attempts: 2, correct: 1, avgMs: 3000, lastSeen: DAY1 + 1000 });
  });

  it('days are New Zealand days', () => {
    expect(nzDay(Date.parse('2026-10-16T11:30:00Z'))).toBe('2026-10-17');
  });

  it('describes mastery for the teacher grid', () => {
    expect(mastery(undefined)).toBe('not-tried');
    expect(mastery(box('k', 0))).toBe('learning');
    expect(mastery(box('k', 1))).toBe('learning');
    expect(mastery(box('k', 2))).toBe('secure');
    expect(mastery(box('k', 4))).toBe('fluent');
  });
});

describe('which facts can be asked', () => {
  it('level 1: focus is ×2, ×5 and ×10 up to × 10, nothing to review, stretch is ×3 and ×4', () => {
    const pools = poolsFor({ level: 1 });
    const upToTen = [...factsIn([2, 5, 10])].filter((k) => parseFactKey(k)!.b <= 10);
    expect(new Set(pools.focus)).toEqual(new Set(upToTen));
    expect(pools.focus).toContain('mul:10x10');
    expect(pools.focus).not.toContain('mul:10x12');
    expect(pools.focus).not.toContain('mul:5x11');
    expect(pools.review).toEqual([]);
    expect(pools.stretch).toContain('mul:3x7');
    expect(pools.stretch).not.toContain('mul:2x3'); // already a ×2 fact
  });

  it('level 3: focus is ×3, ×4 and ×8, review is the earlier tables', () => {
    const pools = poolsFor({ level: 3 });
    expect(new Set(pools.focus)).toEqual(factsIn([3, 4, 8]));
    expect(pools.review).toContain('mul:5x7');
    expect(pools.review).not.toContain('mul:3x5'); // a ×3 fact, so it's focus
    expect(pools.stretch).toContain('mul:6x7');
    expect(pools.focus).toContain('mul:3x12'); // from level 3, tables go to × 12
  });

  it("leaves out tables the teacher switched off", () => {
    const pools = poolsFor({ level: 3, enabledTables: [2, 3, 5, 10] });
    expect(pools.focus).toContain('mul:3x7');
    expect(pools.focus).not.toContain('mul:4x7');
    expect(pools.stretch).toEqual([]);
  });

  it('asks nothing when every table is off', () => {
    expect(pickFact({ level: 1, enabledTables: [] }, new Map(), newMemory(), Math.random)).toBeNull();
    expect(new TimesTables().nextQuestion({ enabledTables: [] })).toBeNull();
  });
});

describe('choosing facts', () => {
  it('mixes about 60% focus, 30% review and 10% stretch', () => {
    const random = randomFromSeed('mix');
    const memory = newMemory();
    const counts: Record<Band, number> = { focus: 0, review: 0, stretch: 0, repeat: 0 };
    for (let i = 0; i < 10000; i++) counts[pickFact({ level: 3 }, new Map(), memory, random)!.band]++;
    expect(counts.focus / 10000).toBeCloseTo(MIX.focus, 1);
    expect(counts.review / 10000).toBeCloseTo(MIX.review, 1);
    expect(counts.stretch / 10000).toBeCloseTo(MIX.stretch, 1);
  });

  it('can ask only the focus tables', () => {
    const focus = new Set(poolsFor({ level: 3 }).focus);
    const random = randomFromSeed('only-focus');
    const memory = newMemory();
    for (let i = 0; i < 300; i++) expect(focus.has(pickFact({ level: 3, onlyFocus: true }, new Map(), memory, random)!.key)).toBe(true);
  });

  it('asks facts in lower boxes more often', () => {
    const focus = poolsFor({ focusTables: [7], enabledTables: [7] }).focus;
    const stats = new Map(focus.map((k) => [k, box(k, k === 'mul:7x8' ? 0 : TOP_BOX)]));
    const random = randomFromSeed('boxes');
    const memory = newMemory();
    let weak = 0;
    for (let i = 0; i < 6000; i++) if (pickFact({ focusTables: [7], enabledTables: [7] }, stats, memory, random)!.key === 'mul:7x8') weak++;
    // With equal weights it would be 1 in 12; the box-0 fact comes up well over twice that.
    expect(weak / 6000).toBeGreaterThan(2 / 12);
    expect(BOX_WEIGHTS[0]).toBeGreaterThan(BOX_WEIGHTS[TOP_BOX]);
  });

  it('weights review towards facts with more mistakes', () => {
    const stats = new Map([
      ['mul:5x7', box('mul:5x7', 2, { attempts: 10, correct: 2 })],
      ['mul:5x6', box('mul:5x6', 2, { attempts: 10, correct: 10 })],
    ]);
    const random = randomFromSeed('weak');
    const memory = newMemory();
    let wrongOne = 0;
    let rightOne = 0;
    for (let i = 0; i < 20000; i++) {
      const key = pickFact({ level: 3 }, stats, memory, random)!.key;
      if (key === 'mul:5x7') wrongOne++;
      if (key === 'mul:5x6') rightOne++;
    }
    expect(wrongOne).toBeGreaterThan(rightOne * 1.4);
  });

  it('can ask only from chosen boxes, and falls back when there are none', () => {
    const stats = new Map([['mul:2x7', box('mul:2x7', 3)]]);
    const random = randomFromSeed('box-filter');
    const memory = newMemory();
    for (let i = 0; i < 20; i++) {
      memory.recent = [];
      const picked = pickFact({ level: 1, boxes: [3, 4] }, stats, memory, random)!;
      if (picked.band === 'focus') expect(picked.key).toBe('mul:2x7');
    }
    expect(pickFact({ level: 1, boxes: [4] }, stats, memory, random)).not.toBeNull();
  });

  it("doesn't ask the same fact twice within 3 questions", () => {
    const random = randomFromSeed('recent');
    const memory = newMemory();
    const keys: string[] = [];
    for (let i = 0; i < 500; i++) keys.push(pickFact({ level: 1 }, new Map(), memory, random)!.key);
    for (let i = 3; i < keys.length; i++) expect(keys.slice(i - 3, i)).not.toContain(keys[i]);
  });

  it('a fact answered wrongly comes back 3–6 questions later, once', () => {
    for (const seed of ['r1', 'r2', 'r3', 'r4', 'r5']) {
      const pack = new TimesTables([], randomFromSeed(seed), () => DAY1);
      const first = pack.nextQuestion({ level: 1 })!;
      pack.recordAnswer(first, first.answer + 1, 3000);
      const later: string[] = [];
      for (let i = 0; i < 10; i++) {
        const q = pack.nextQuestion({ level: 1 })!;
        pack.recordAnswer(q, q.answer, 1000);
        later.push(q.band === 'repeat' ? `repeat:${q.factKey}` : q.factKey);
      }
      const at = later.indexOf(`repeat:${first.factKey}`) + 1;
      expect(at).toBeGreaterThanOrEqual(REPEAT_AFTER.min);
      expect(at).toBeLessThanOrEqual(REPEAT_AFTER.max);
      expect(later.filter((k) => k === `repeat:${first.factKey}`)).toHaveLength(1);
    }
  });

  it('only schedules one repeat per fact', () => {
    const memory = newMemory();
    scheduleRepeat(memory, 'mul:7x8', Math.random);
    scheduleRepeat(memory, 'mul:7x8', Math.random);
    expect(memory.repeats).toHaveLength(1);
  });
});

describe('times-tables questions', () => {
  function many(ctx: Parameters<TimesTables['nextQuestion']>[0], n = 400, seed = 'q') {
    const pack = new TimesTables([], randomFromSeed(seed), () => DAY1);
    return Array.from({ length: n }, () => pack.nextQuestion(ctx)!);
  }

  it('asks both orders of a fact', () => {
    const qs = many({ focusTables: [7], enabledTables: [7] }).filter((q) => q.factKey === 'mul:7x8');
    const shown = new Set(qs.map((q) => q.parts.slice(0, 3).join(' ')));
    expect(shown).toEqual(new Set(['7 × 8', '8 × 7']));
  });

  it('every answer is right for its question', () => {
    for (const q of many({ level: 6, division: true }, 1000)) {
      const [a, op, b, , c] = q.parts;
      const n = (s: string) => (s === '?' ? q.answer : Number(s));
      if (op === '×') expect(n(a) * n(b)).toBe(n(c));
      else expect(n(a) / n(b)).toBe(n(c));
    }
  });

  it('missing-factor questions start at level 4, and division only when switched on', () => {
    expect(many({ level: 1 }).every((q) => q.kind === 'multiply')).toBe(true);
    const level4 = many({ level: 4 });
    expect(level4.some((q) => q.kind === 'missing-factor')).toBe(true);
    expect(level4.some((q) => q.kind === 'divide')).toBe(false);
    expect(many({ level: 4, division: true }).some((q) => q.kind === 'divide')).toBe(true);
    expect(many({ level: 6, missingFactor: false }).every((q) => q.kind === 'multiply')).toBe(true);
  });

  it('only asks facts from enabled tables', () => {
    const allowed = factsIn([2, 3, 4, 5, 10]);
    for (const q of many({ level: 2 })) expect(parseFactKey(q.factKey)!.b).toBeLessThanOrEqual(10);
    for (const q of many({ level: 3, enabledTables: [2, 3, 4, 5, 10] })) expect(allowed.has(q.factKey)).toBe(true);
  });

  it('reads the question out for screen readers', () => {
    const [q] = many({ level: 1 }, 1);
    expect(q.spoken).toMatch(/^\d+ times \d+ equals what\?$/);
  });

  it('multiple choice: four different choices, one of them right', () => {
    for (const q of many({ level: 4, multipleChoice: true }, 300)) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices).toContain(q.answer);
      expect(q.choices!.every((c) => c > 0)).toBe(true);
    }
    for (const [x, y, answer, isFactor] of [[1, 1, 1, false], [12, 12, 12, true], [1, 1, 1, true]] as const) {
      const choices = choicesFor(x, y, answer, isFactor, Math.random);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(answer);
    }
  });

  it('marks answers and shows the whole fact', () => {
    const pack = new TimesTables([], randomFromSeed('mark'), () => DAY1);
    const q = { ...pack.nextQuestion({ level: 1 })!, parts: ['?', '×', '8', '=', '56'], answer: 7, factKey: 'mul:7x8' };
    expect(pack.recordAnswer(q, 6, 2000)).toEqual({ correct: false, fact: '7 × 8 = 56', boxBefore: 0, boxAfter: 1 });
    expect(pack.recordAnswer(q, 7, 2000)).toMatchObject({ correct: true, boxBefore: 1, boxAfter: 2 });
    const div = { ...q, kind: 'divide', parts: ['56', '÷', '8', '=', '?'], answer: 7 };
    expect(pack.recordAnswer(div, 7, 9000).fact).toBe('56 ÷ 8 = 7');
    expect(pack.statsFor('mul:7x8')).toMatchObject({ attempts: 3, correct: 2 });
  });

  it('starts from saved records', () => {
    const pack = new TimesTables([box('mul:7x8', 3)]);
    expect(pack.stats()).toHaveLength(1);
    expect(pack.statsFor('mul:7x8')?.box).toBe(3);
  });

  it('has curriculum tags for James to fill in', () => {
    expect(new TimesTables().curriculumTags.length).toBeGreaterThan(0);
  });
});

describe('working out a question from how it was shown', () => {
  it('solves every kind, and gives the fact it belongs to', async () => {
    const { solveQuestion } = await import('./skillPacks/timesTables');
    expect(solveQuestion(['7', '×', '8', '=', '?'])).toEqual({ answer: 56, key: 'mul:7x8' });
    expect(solveQuestion(['?', '×', '8', '=', '56'])).toEqual({ answer: 7, key: 'mul:7x8' });
    expect(solveQuestion(['7', '×', '?', '=', '56'])).toEqual({ answer: 8, key: 'mul:7x8' });
    expect(solveQuestion(['56', '÷', '8', '=', '?'])).toEqual({ answer: 7, key: 'mul:7x8' });
  });

  it('refuses anything the pack could never ask', async () => {
    const { solveQuestion } = await import('./skillPacks/timesTables');
    for (const bad of [['13', '×', '2', '=', '?'], ['?', '×', '8', '=', '57'], ['7', '+', '8', '=', '?'], ['7', '×', '8', '=', '56'],
      ['?', '×', '?', '=', '56'], ['55', '÷', '8', '=', '?'], 'nope', ['7', '×', '8', '?', '?']]) {
      expect(solveQuestion(bad)).toBeNull();
    }
  });

  it('every question the pack asks can be solved back to the right answer and fact', async () => {
    const { solveQuestion, TimesTables } = await import('./skillPacks/timesTables');
    let seed = 7;
    const pack = new TimesTables([], () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
    for (let i = 0; i < 300; i++) {
      const q = pack.nextQuestion({ level: 9, division: true, missingFactor: true })!;
      expect(solveQuestion(q.parts)).toEqual({ answer: q.answer, key: q.factKey });
    }
  });
});

describe('the level a student is ready for (games with no campaign)', () => {
  it('starts on ×2, ×5 and ×10, and moves on as each step becomes secure', async () => {
    const { readyLevel } = await import('./selector');
    const { factsIn, parseFactKey } = await import('./facts');
    const secure = (tables: number[], upTo = 12) =>
      [...factsIn(tables)].filter((k) => parseFactKey(k)!.b <= upTo).map((key) => ({ key, attempts: 3, correct: 3, avgMs: 2000, box: 3, lastSeen: 1, quickDays: [] }));
    expect(readyLevel([])).toBe(1);
    expect(readyLevel(secure([2, 5, 10], 10))).toBe(3);
    expect(readyLevel([...secure([2, 5, 10], 10), ...secure([3, 4, 8])])).toBe(5);
    // Switched-off tables don't hold anyone back.
    expect(readyLevel(secure([2, 5, 10], 10), [2, 5, 10, 6, 9])).toBe(5);
  });
});
