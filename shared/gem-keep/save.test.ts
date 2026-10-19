import { describe, expect, it } from 'vitest';
import { showingPack, type ShownAnswer } from '../maths/claim';
import { makeFocusPack, packIdOfKey, parseFocus } from '../maths/focus';
import { LADDER } from '../maths/ladder';
import { checkItem, OLD_SAVES_UNTIL, type AnswersItem } from './save';

const BEFORE = OLD_SAVES_UNTIL - 86_400_000;
const AFTER = OLD_SAVES_UNTIL + 1;
const BATCH = '6f1c2a54-1d3e-4b5a-9c7d-0e1f2a3b4c5d';

/** The answers the server keeps from one answers item, or null if the item was refused. */
function kept(pack: string, answers: object[], now = BEFORE) {
  const checked = checkItem({ type: 'answers', pack, batchId: BATCH, answers }, now);
  return checked.ok ? (checked.item as AnswersItem).answers : null;
}

/** An answer as the website sends it now. `correct` is what the browser says; the server ignores it. */
const shown = (key: string, parts: string[], given: number, correct = true, extra: object = {}) => ({ key, correct, ms: 2000, at: BEFORE - 5000, parts, given, ...extra });

describe('Gem Keep answers are marked by the server', () => {
  it('a missing factor is only right with the missing number, whatever the browser says', () => {
    expect(kept('times-tables', [shown('mul:6x8', ['?', '×', '8', '=', '48'], 6, false)])).toEqual([{ key: 'mul:6x8', correct: true, ms: 2000, at: BEFORE - 5000 }]);
    expect(kept('times-tables', [shown('mul:6x8', ['?', '×', '8', '=', '48'], 8, true)])).toEqual([{ key: 'mul:6x8', correct: false, ms: 2000, at: BEFORE - 5000 }]);
    expect(kept('times-tables', [shown('mul:7x8', ['56', '÷', '8', '=', '?'], 7, false)])?.[0].correct).toBe(true);
  });

  it('leaves out an answer whose question is not that record, or is not a question at all', () => {
    expect(kept('times-tables', [shown('mul:6x8', ['?', '×', '7', '=', '42'], 6)])).toEqual([]);
    expect(kept('times-tables', [shown('mul:6x8', ['what', 'is', 'love'], 6)])).toEqual([]);
    expect(kept('times-tables', [shown('mul:6x8', 'nope' as never, 6)])).toEqual([]);
    expect(kept('times-tables', [shown('mul:6x8', ['6', '×', '8', '=', '?'], Number.NaN)])).toEqual([]);
    expect(kept('times-tables', [shown('mul:6x8', Array(13).fill('6'), 48)])).toEqual([]);
    // The good ones in the same batch still count.
    expect(kept('times-tables', [shown('mul:6x8', ['?', '×', '7', '=', '42'], 6), shown('mul:6x8', ['6', '×', '8', '=', '?'], 48)])).toHaveLength(1);
  });

  it('a pick-one question is marked from its numbers, and made-up numbers are left out', () => {
    const pack = showingPack(makeFocusPack([], parseFocus({ source: 'student', skills: ['fdp-equivalents'], onlyThese: true }), {}, seeded(5)));
    const answers: ShownAnswer[] = [];
    pack.onAnswer((a) => answers.push(a));
    const q = pack.nextQuestion({})!;
    pack.recordAnswer(q, q.answer, 2000);
    const sent = { ...answers[0], ms: 2000, at: BEFORE - 5000 };
    expect(kept('generated', [sent])?.[0].correct).toBe(true);
    expect(kept('generated', [{ ...sent, params: sent.params!.map((n) => n + 1) }])).toEqual([]);
  });

  it('an answer from an older page (no question shown) is taken at its word only until OLD_SAVES_UNTIL', () => {
    const old = { key: 'mul:7x8', correct: true, ms: 2000, at: BEFORE - 5000 };
    expect(kept('times-tables', [old], BEFORE)).toEqual([old]);
    expect(kept('times-tables', [{ ...old, at: AFTER - 5000 }], AFTER)).toEqual([]);
    // A new-style answer still counts after it.
    expect(kept('times-tables', [{ ...shown('mul:6x8', ['6', '×', '8', '=', '?'], 48), at: AFTER - 5000 }], AFTER)).toHaveLength(1);
  });

  it('whole records (the save from before 17 Oct) are refused after OLD_SAVES_UNTIL', () => {
    const facts = [{ key: 'mul:7x8', attempts: 4, correct: 3, avgMs: 2400, box: 4, lastSeen: BEFORE - 1000, quickDays: [] }];
    expect(checkItem({ type: 'facts', pack: 'times-tables', facts }, BEFORE).ok).toBe(true);
    expect(checkItem({ type: 'facts', pack: 'times-tables', facts }, AFTER)).toEqual({ ok: false, problem: 'old-save' });
  });
});

/** A repeatable random function. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('every question the website asks is one the server can mark the same way', () => {
  const built = LADDER.filter((s) => s.built);
  for (const multipleChoice of [false, true]) {
    it(`agrees on right and wrong for every built skill${multipleChoice ? ' (multiple choice)' : ''}`, () => {
      const random = seeded(multipleChoice ? 7 : 3);
      for (const skill of built) {
        for (const division of [true, false]) {
          const pack = showingPack(makeFocusPack([], parseFocus({ source: 'student', skills: [skill.id], onlyThese: true }), { division }, random));
          const answers: ShownAnswer[] = [];
          pack.onAnswer((a) => answers.push(a));
          const browser: boolean[] = [];
          for (let i = 0; i < 40; i++) {
            const q = pack.nextQuestion({ multipleChoice, division, missingFactor: true });
            if (!q) break;
            // Half right, half a believable wrong answer (another choice, or one more).
            const wrong = q.choices?.find((c) => c !== q.answer) ?? q.answer + 1;
            browser.push(pack.recordAnswer(q, i % 2 ? q.answer : wrong, 2000).correct);
          }
          const byPack = new Map<string, ShownAnswer[]>();
          for (const a of answers) {
            const id = packIdOfKey(a.key)!;
            byPack.set(id, [...(byPack.get(id) ?? []), { ...a, at: BEFORE - 5000 }]);
          }
          const server = [...byPack].flatMap(([id, list]) => kept(id, list) ?? []);
          expect(answers.length, skill.id).toBe(browser.length);
          expect(browser.length, skill.id).toBeGreaterThan(10);
          expect(server, skill.id).toHaveLength(answers.length);
          // Same verdicts, in the order each pack's answers were sent.
          const order = [...byPack].flatMap(([, list]) => list.map((a) => answers.findIndex((x) => x.parts === a.parts)));
          expect(server.map((s) => s.correct), skill.id).toEqual(order.map((i) => browser[i]));
        }
      }
    });
  }
});
