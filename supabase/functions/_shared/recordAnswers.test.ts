import { afterEach, describe, expect, it, vi } from 'vitest';
import { batchIdFor, recordMathsAnswers, type RpcWithData } from './recordAnswers';

const tables = { key: 'mul:6x7', correct: true, ms: 1000, at: 5 };

afterEach(() => vi.restoreAllMocks());

/** A stand-in database: record_fact_answers says how many it took (default all of them). */
function fakeDb(took?: (pack: string) => number | { code: string }) {
  return vi.fn<RpcWithData>(async (name, args) => {
    if (name !== 'record_fact_answers') return { data: null, error: null };
    const answer = took?.(String(args.pack)) ?? (args.answers as unknown[]).length;
    return typeof answer === 'number' ? { data: answer, error: null } : { data: null, error: answer };
  });
}

describe('saving marked maths answers', () => {

  it('the same save sent twice has the same batch ids, and a batch seen before is not counted for focuses again', async () => {
    const first = fakeDb();
    await recordMathsAnswers(first, 'student-1', [tables], 'seed-1:0', 'marble');
    const again = fakeDb(() => 0);
    const result = await recordMathsAnswers(again, 'student-1', [tables], 'seed-1:0', 'marble');
    expect(result.saved).toBe(0);
    expect(again.mock.calls[0][1].batch_id).toBe(first.mock.calls[0][1].batch_id);
    expect(again.mock.calls.some(([name]) => name === 'add_maths_focus_results')).toBe(false);
    // Saved answers also move the student's place on the ladder (it reads their records first); a save that took nothing new doesn't.
    expect(first.mock.calls.some(([name]) => name === 'space_maths_context')).toBe(true);
    expect(again.mock.calls.some(([name]) => name === 'space_maths_context')).toBe(false);
    // Untimed skills (order of operations) save in their own batch where any right answer is quick; times tables stay timed.
    const mixed = fakeDb();
    await recordMathsAnswers(mixed, 'student-1', [tables, { key: 'bedmas:mixed', correct: true, ms: 40000, at: 5 }], 'seed-2:0', 'lord', (o) => batchIdFor(o));
    const saves = mixed.mock.calls.filter(([name]) => name === 'record_fact_answers').map(([, a]) => a);
    expect(saves.map((a) => a.quick_ms)).toEqual([5000, 120000]);
    expect(saves.find((a) => a.quick_ms === 120000)?.answers).toHaveLength(1);
    expect(new Set(saves.map((a) => a.batch_id)).size).toBe(saves.length);
  });

});
