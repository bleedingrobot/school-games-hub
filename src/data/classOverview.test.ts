import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_FOCUS } from '../../shared/maths/focus';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
const { fetchClassOverview, fetchStudentCard, parseOverview, parseStudentCard } = await import('./classOverview');
const { FriendlyError } = await import('./profile');

beforeEach(() => rpc.mockReset());

describe('parseOverview', () => {
  it('tidies each student, and drops a row without an id', () => {
    const list = parseOverview({
      students: [
        {
          id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', avatar: { hat: 1 }, hidden: true, games: 6.7, points: 50,
          lastPlayed: '2026-10-27T01:00:00Z', lastActive: '2026-10-28T01:00:00Z', shown: 20, skipped: 2,
          focus: { source: 'teacher-class', skills: ['facts-10'], ladder: { on: true, placed: 'skipped' } },
        },
        { name: 'No id' },
        null,
        { id: 's2', name: 'Lucky Tui 12', realName: '', games: -3, points: 'lots', lastActive: 'yesterday', shown: Infinity },
      ],
    });
    expect(list.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(list[0]).toMatchObject({
      name: 'Brave Kiwi 7', realName: 'jane.smith', avatar: { hat: 1 }, hidden: true, games: 6, points: 50,
      lastPlayed: '2026-10-27T01:00:00Z', lastActive: '2026-10-28T01:00:00Z', shown: 20, skipped: 2,
    });
    expect(list[0].focus).toMatchObject({ source: 'teacher-class', skills: ['facts-10'], ladder: { on: true, placed: 'skipped' } });
    expect(list[1]).toEqual({
      id: 's2', name: 'Lucky Tui 12', realName: null, avatar: {}, hidden: false, games: 0, points: 0,
      lastPlayed: null, lastActive: null, shown: 0, skipped: 0, focus: AUTO_FOCUS,
    });
  });

  it('gives an empty list for anything odd', () => {
    expect(parseOverview(null)).toEqual([]);
    expect(parseOverview({ students: 'none' })).toEqual([]);
    expect(parseOverview([{ id: 's1' }])).toEqual([]);
  });
});

describe('parseStudentCard', () => {
  it('reads a student, with their classes, focus and week', () => {
    const card = parseStudentCard({
      id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', role: 'student', hidden: false,
      classes: [{ id: 'c12', name: 'Room 12' }, { name: 'no id' }, 'c14'],
      focus: { source: 'student', skills: ['facts-10'] },
      week: { shown: 12, skipped: 3.5 },
    });
    expect(card).toMatchObject({
      id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', avatar: {}, role: 'student', hidden: false,
      classes: [{ id: 'c12', name: 'Room 12' }], week: { shown: 12, skipped: 3 },
    });
    expect(card!.focus).toMatchObject({ source: 'student', skills: ['facts-10'] });
  });

  it('gives a teacher no focus, an unknown role counts as a student, and a missing focus or week is auto and nothing', () => {
    expect(parseStudentCard({ id: 't1', name: 'Wise Owl 1', role: 'teacher', focus: { source: 'student', skills: ['facts-10'] } })).toMatchObject({
      role: 'teacher', focus: null, classes: [], week: { shown: 0, skipped: 0 },
    });
    expect(parseStudentCard({ id: 's2', role: 'admin', hidden: 'yes' })).toMatchObject({ role: 'student', hidden: false, name: '', realName: null, focus: AUTO_FOCUS });
  });

  it('gives null without an id', () => {
    expect(parseStudentCard(null)).toBeNull();
    expect(parseStudentCard('s1')).toBeNull();
    expect(parseStudentCard({ name: 'Brave Kiwi 7' })).toBeNull();
  });
});

describe('the requests', () => {
  it('asks for a class and a student by id', async () => {
    rpc.mockResolvedValueOnce({ data: { students: [{ id: 's1', name: 'Brave Kiwi 7' }] }, error: null });
    expect((await fetchClassOverview('c12')).map((s) => s.name)).toEqual(['Brave Kiwi 7']);
    expect(rpc).toHaveBeenLastCalledWith('teacher_class_overview', { target_class: 'c12' });
    rpc.mockResolvedValueOnce({ data: { id: 's1', name: 'Brave Kiwi 7' }, error: null });
    expect((await fetchStudentCard('s1')).name).toBe('Brave Kiwi 7');
    expect(rpc).toHaveBeenLastCalledWith('teacher_student_card', { student: 's1' });
  });

  it('shows the database’s own words, but never a raw permission error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'You don’t teach that class.' } });
    await expect(fetchClassOverview('c99')).rejects.toThrow(new FriendlyError('You don’t teach that class.'));
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied for function teacher_student_card' } });
    await expect(fetchStudentCard('s9')).rejects.toThrow('We couldn’t load that student.');
    rpc.mockResolvedValueOnce({ data: { name: 'no id' }, error: null });
    await expect(fetchStudentCard('s9')).rejects.toThrow('We couldn’t load that student.');
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchClassOverview('c12')).rejects.toThrow('We couldn’t load this class’s students.');
  });
});
