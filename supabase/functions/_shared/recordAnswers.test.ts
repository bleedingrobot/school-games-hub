import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLUENT_DAYS, TOP_BOX } from '../../../shared/maths/config';
import { batchIdFor, recordMathsAnswers, type RpcWithData } from './recordAnswers';

const tables = { key: 'mul:6x7', correct: true, ms: 1000, at: 5 };
const rounding = { key: 'round:100:3digit', correct: false, ms: 7000, at: 6 };

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
  it('saves one batch per pack, each with its own quick time, and counts them for the running focuses', async () => {
    const rpc = fakeDb();
    const result = await recordMathsAnswers(rpc, 'student-1', [tables, rounding], 'seed-1:0', 'marble');
    expect(result).toEqual({ saved: 2, failed: 0 });
    const records = rpc.mock.calls.filter(([name]) => name === 'record_fact_answers').map(([, args]) => args);
    expect(records).toEqual([
      expect.objectContaining({ player: 'student-1', pack: 'times-tables', answers: [tables], quick_ms: 5000, fluent_days: FLUENT_DAYS, top_box: TOP_BOX }),
      expect.objectContaining({ player: 'student-1', pack: 'generated', answers: [rounding], quick_ms: 8000 }),
    ]);
    expect(rpc.mock.calls.filter(([name]) => name === 'add_maths_focus_results')).toHaveLength(2);
  });

  it('the same save sent twice has the same batch ids, and a batch seen before is not counted for focuses again', async () => {
    const first = fakeDb();
    await recordMathsAnswers(first, 'student-1', [tables], 'seed-1:0', 'marble');
    const again = fakeDb(() => 0);
    const result = await recordMathsAnswers(again, 'student-1', [tables], 'seed-1:0', 'marble');
    expect(result.saved).toBe(0);
    expect(again.mock.calls[0][1].batch_id).toBe(first.mock.calls[0][1].batch_id);
    expect(again.mock.calls.some(([name]) => name === 'add_maths_focus_results')).toBe(false);
  });

  it('batch ids differ between games, saves and packs, and look like UUIDs', async () => {
    const ids = await Promise.all([batchIdFor('marble:a:times-tables'), batchIdFor('marble:b:times-tables'), batchIdFor('bond:a:times-tables')]);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('a pack that fails is logged (the code, never who) and the others are still saved', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = fakeDb((pack) => (pack === 'times-tables' ? { code: '57014' } : 1));
    const result = await recordMathsAnswers(rpc, 'student-1', [tables, rounding], 'x', 'marble');
    expect(result).toEqual({ saved: 1, failed: 1 });
    expect(log).toHaveBeenCalledWith('marble: record answers failed (57014)');
    expect(String(log.mock.calls)).not.toContain('student-1');
  });

  it('never throws, even when the call itself blows up', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const rpc = vi.fn<RpcWithData>().mockRejectedValue(new Error('network'));
    await expect(recordMathsAnswers(rpc, 'student-1', [tables], 'x', 'marble')).resolves.toEqual({ saved: 0, failed: 1 });
  });

  it('keeps each time to at most two minutes', async () => {
    const rpc = fakeDb();
    await recordMathsAnswers(rpc, 'student-1', [{ ...tables, ms: 600_000 }], 'x', 'marble');
    expect((rpc.mock.calls[0][1].answers as { ms: number }[])[0].ms).toBe(120_000);
  });

  it('answers that belong to no pack cost nothing', async () => {
    const rpc = fakeDb();
    await expect(recordMathsAnswers(rpc, 'student-1', [{ key: 'nonsense', correct: true, ms: 1, at: 1 }], 'x', 'marble')).resolves.toEqual({ saved: 0, failed: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
