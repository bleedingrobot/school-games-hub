import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';
import { fetchClassMap, fetchFocusHistory, fetchFocusResults, parseFocusResults, fetchStudentLadder, parseClassMap, resetPlacement } from './skillMap';

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
const rpc = vi.mocked(supabase.rpc);

beforeEach(() => rpc.mockReset());

const raw = {
  class: { id: 'c1', name: 'Room 12', yearLevel: 5, auto: true },
  students: [
    {
      id: 's1',
      name: 'Speedy Otter 27',
      realName: 'ana',
      ladder: {
        on: true,
        yearLevel: 5,
        placed: 'done',
        placement: 'tables-6-9',
        furthest: 'tables-6-9',
      },
      settings: { enabledTables: [6, 7], division: false },
      facts: [
        {
          key: 'mul:6x7',
          attempts: 5,
          correct: 4,
          avgMs: 2200,
          box: 3,
          lastSeen: 1760000000000,
          quickDays: ['2026-10-17'],
        },
      ],
    },
  ],
};

describe('reading the class map', () => {
  it('keeps what the database sent', () => {
    const map = parseClassMap(raw);
    expect(map).toMatchObject({
      classId: 'c1',
      className: 'Room 12',
      yearLevel: 5,
      auto: true,
    });
    expect(map.students[0]).toMatchObject({
      id: 's1',
      name: 'Speedy Otter 27',
      realName: 'ana',
      enabledTables: [6, 7],
      division: false,
    });
    expect(map.students[0].ladder).toMatchObject({
      on: true,
      placed: 'done',
      placement: 'tables-6-9',
    });
    expect(map.students[0].facts).toEqual([
      {
        key: 'mul:6x7',
        attempts: 5,
        correct: 4,
        avgMs: 2200,
        box: 3,
        lastSeen: 1760000000000,
        quickDays: ['2026-10-17'],
      },
    ]);
  });

  it('drops anything odd instead of showing it', () => {
    const odd = parseClassMap({
      class: { id: 'c1', name: 'R', yearLevel: 'x', auto: 'yes' },
      students: [
        {
          id: 's1',
          name: 'N',
          realName: '',
          ladder: 'nope',
          settings: { enabledTables: [0, 13, 'a'], division: 'x' },
          facts: [null, 5, { key: 3 }, { key: 'mul:2x3', attempts: 'many', box: null }],
        },
      ],
    });
    expect(odd.yearLevel).toBeNull();
    expect(odd.auto).toBe(false);
    expect(odd.students[0].realName).toBeNull();
    expect(odd.students[0].ladder.on).toBe(false);
    expect(odd.students[0].enabledTables).toBeUndefined();
    expect(odd.students[0].division).toBe(true);
    expect(odd.students[0].facts).toEqual([
      {
        key: 'mul:2x3',
        attempts: 0,
        correct: 0,
        avgMs: 0,
        box: 0,
        lastSeen: 0,
        quickDays: [],
      },
    ]);
  });

  it('copes with nothing at all', () => {
    expect(parseClassMap(null).students).toEqual([]);
    expect(parseClassMap({}).students).toEqual([]);
  });
});

describe('asking the database', () => {
  it('asks for one class by name', async () => {
    rpc.mockResolvedValue({ data: raw, error: null } as never);
    expect((await fetchClassMap('c1')).students).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('teacher_class_skill_map', {
      target: 'c1',
    });
  });

  it('shows a message we wrote, and hides any other error', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'That isn’t one of your classes.' },
    } as never);
    await expect(fetchClassMap('c2')).rejects.toThrow('That isn’t one of your classes.');
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for table gem_keep_facts',
      },
    } as never);
    await expect(fetchClassMap('c2')).rejects.toThrow('We couldn’t load the skill map.');
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX000', message: 'boom' },
    } as never);
    await expect(fetchClassMap('c2')).rejects.toBeInstanceOf(FriendlyError);
  });

  it("reads a student's placement, clears it, and says whether there was anything", async () => {
    rpc.mockResolvedValueOnce({
      data: { on: true, placed: 'skipped' },
      error: null,
    } as never);
    expect((await fetchStudentLadder('s1')).placed).toBe('skipped');
    expect(rpc).toHaveBeenLastCalledWith('teacher_student_ladder', {
      student: 's1',
    });
    rpc.mockResolvedValueOnce({ data: true, error: null } as never);
    expect(await resetPlacement('s1')).toBe(true);
    expect(rpc).toHaveBeenLastCalledWith('teacher_reset_placement', {
      student: 's1',
    });
    rpc.mockResolvedValueOnce({ data: false, error: null } as never);
    expect(await resetPlacement('s1')).toBe(false);
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42501',
        message: 'That player isn’t in one of your classes.',
      },
    } as never);
    await expect(resetPlacement('s9')).rejects.toThrow('That player isn’t in one of your classes.');
  });

  it('asks for the history of one class, from a day or from the start', async () => {
    rpc.mockResolvedValue({ data: [], error: null } as never);
    await fetchFocusHistory('c1', new Date('2026-10-11T11:00:00Z'));
    expect(rpc).toHaveBeenLastCalledWith('teacher_maths_focus_history', {
      target_class: 'c1',
      since: '2026-10-11T11:00:00.000Z',
    });
    await fetchFocusHistory('c1', null);
    expect(rpc).toHaveBeenLastCalledWith('teacher_maths_focus_history', {
      target_class: 'c1',
      since: null,
    });
    rpc.mockResolvedValueOnce({ data: null, error: null } as never);
    await expect(fetchFocusHistory('c1', null)).rejects.toThrow('We couldn’t load the focus history.');
  });
});

describe('focus results', () => {
  const sent = {
    since: '2026-10-19T00:00:00Z',
    students: [{ id: 's1', name: 'Speedy Otter 27', realName: 'ana', answers: 12, correct: 9, quick: 4 }],
    total: { answers: 12, correct: 9, quick: 4 },
  };

  it('asks the database for one focus and tidies the answer', async () => {
    rpc.mockResolvedValue({ data: sent, error: null } as never);
    const r = await fetchFocusResults('b1');
    expect(rpc).toHaveBeenCalledWith('teacher_maths_focus_results', { batch: 'b1' });
    expect(r.since?.toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(r.students[0]).toEqual({ id: 's1', name: 'Speedy Otter 27', realName: 'ana', answers: 12, correct: 9, quick: 4 });
    expect(r.total).toEqual({ answers: 12, correct: 9, quick: 4 });
  });

  it('turns anything odd into zeros or nothing, and never shows a negative', () => {
    const r = parseFocusResults({ since: 'soon', students: [{ id: 's1', name: 'A', answers: -3, correct: 'x', quick: 2.7 }], total: {} });
    expect(r.since).toBeNull();
    expect(r.students[0]).toMatchObject({ answers: 0, correct: 0, quick: 2, realName: null });
    expect(r.total).toEqual({ answers: 0, correct: 0, quick: 0 });
    expect(parseFocusResults(null).students).toEqual([]);
  });

  it('shows our own message for a refusal and a plain one for anything else', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'That isn’t one of your classes.' } } as never);
    await expect(fetchFocusResults('b1')).rejects.toThrow('That isn’t one of your classes.');
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'timeout' } } as never);
    await expect(fetchFocusResults('b1')).rejects.toBeInstanceOf(FriendlyError);
  });
});
