import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
const { createClassFor, fetchAdminClasses, parseAdminClasses, fetchAdminOverview, fetchAdminStudents, fetchAdminTeachers, setSchoolAdmin, parseAdminOverview, parseAdminStudents, parseAdminTeachers } =
  await import('./admin');
const { FriendlyError } = await import('./profile');

beforeEach(() => rpc.mockReset());

describe('parseAdminOverview', () => {
  it('tidies the numbers and the classes', () => {
    const o = parseAdminOverview({
      counts: { classes: 4, students: 90.8, teachers: 6, admins: 1, activeWeek: -2, shownWeek: 'many', skippedWeek: 12 },
      noClass: 3,
      classesNoTeacher: [{ id: 'c3', name: 'Room 3' }, { name: 'No id' }, null],
      oldWarp: 2,
    });
    expect(o).toEqual({
      counts: { classes: 4, students: 90, teachers: 6, admins: 1, activeWeek: 0, shownWeek: 0, skippedWeek: 12 },
      noClass: 3,
      classesNoTeacher: [{ id: 'c3', name: 'Room 3' }],
      oldWarp: 2,
    });
  });

  it('gives zeros for anything odd', () => {
    expect(parseAdminOverview(null)).toMatchObject({ counts: { classes: 0, students: 0 }, noClass: 0, classesNoTeacher: [], oldWarp: 0 });
  });
});

describe('parseAdminStudents and parseAdminTeachers', () => {
  it('tidies each student and drops a row without an id', () => {
    const list = parseAdminStudents({
      students: [
        { id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', hidden: true, classId: 'c1', className: 'Room 1', classArchived: true, lastPlayed: '2026-10-27T01:00:00Z' },
        { name: 'No id' },
        { id: 's2', name: 'Lucky Tui 12', realName: '', lastPlayed: 'yesterday' },
      ],
    });
    expect(list.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(list[0]).toMatchObject({ realName: 'jane.smith', hidden: true, classId: 'c1', classArchived: true, lastPlayed: '2026-10-27T01:00:00Z' });
    expect(list[1]).toEqual({
      id: 's2', name: 'Lucky Tui 12', realName: null, avatar: {}, hidden: false, classId: null, className: null, classArchived: false, lastPlayed: null,
    });
    expect(parseAdminStudents(null)).toEqual([]);
  });

  it('tidies each teacher', () => {
    const list = parseAdminTeachers({
      teachers: [{ id: 't1', name: 'Wise Owl 1', realName: 'a.b', admin: true, me: true, classes: [{ id: 'c1', name: 'Room 1' }, {}] }, { id: 't2' }],
    });
    expect(list[0]).toMatchObject({ admin: true, me: true, classes: [{ id: 'c1', name: 'Room 1' }] });
    expect(list[1]).toMatchObject({ admin: false, me: false, classes: [], realName: null });
    expect(parseAdminTeachers({ teachers: 3 })).toEqual([]);
  });
});

describe('parseAdminClasses', () => {
  it('tidies each class and drops a row without an id', () => {
    const list = parseAdminClasses({
      classes: [
        {
          id: 'c1', name: 'Room 1', schoolYear: 2026, yearLevel: 5, archived: true, archivedAt: '2026-10-01T00:00:00Z', warpCode: 'KM4TP',
          warpMode: 'ask', students: 24.6, teachers: [{ id: 't1', name: 'Wise Owl 1', realName: 'a.b' }, { name: 'No id' }], lastActive: '2026-10-27T01:00:00Z',
        },
        { name: 'No id' },
        { id: 'c2', name: 'Room 2', warpMode: 'weird', students: -1, lastActive: 'lately' },
      ],
    });
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(list[0]).toMatchObject({ archived: true, warpMode: 'ask', students: 24, teachers: [{ id: 't1', name: 'Wise Owl 1', realName: 'a.b' }] });
    expect(list[1]).toEqual({
      id: 'c2', name: 'Room 2', schoolYear: null, yearLevel: null, archived: false, archivedAt: null, warpCode: null, warpMode: 'on', students: 0,
      teachers: [], lastActive: null,
    });
    expect(parseAdminClasses(null)).toEqual([]);
  });
});

describe('the calls', () => {
  it('ask the right functions', async () => {
    rpc.mockResolvedValue({ data: { students: [], teachers: [], counts: {} }, error: null });
    await fetchAdminOverview();
    await fetchAdminStudents();
    await fetchAdminTeachers();
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['admin_overview', 'admin_students', 'admin_teachers']);
    rpc.mockResolvedValue({ error: null });
    await setSchoolAdmin('t2', true);
    expect(rpc).toHaveBeenLastCalledWith('school_set_admin', { person: 't2', make_admin: true });
  });

  it('load the classes and make one for a teacher', async () => {
    rpc.mockResolvedValue({ data: { classes: [] }, error: null });
    expect(await fetchAdminClasses()).toEqual([]);
    expect(rpc).toHaveBeenLastCalledWith('admin_classes');
    rpc.mockResolvedValue({ data: 'c9', error: null });
    expect(await createClassFor('Room 9', 2026, null, 't2')).toBe('c9');
    expect(rpc).toHaveBeenLastCalledWith('admin_create_class', { class_name: 'Room 9', in_year: 2026, level: null, teacher: 't2' });
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'That person isn’t a teacher at your school.' } });
    await expect(createClassFor('', 2026, 5, 'x')).rejects.toThrow('That person isn’t a teacher at your school.');
    rpc.mockResolvedValue({ data: null, error: { code: '42P01', message: 'boom' } });
    await expect(fetchAdminClasses()).rejects.toThrow('We couldn’t load the classes.');
  });

  it('shows the server’s own message for 42501 and 22023', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only a school admin can do that.' } });
    await expect(fetchAdminOverview()).rejects.toThrow('Only a school admin can do that.');
    rpc.mockResolvedValue({ error: { code: '22023', message: 'That person is not a teacher at your school.' } });
    await expect(setSchoolAdmin('x', false)).rejects.toThrow('That person is not a teacher at your school.');
  });

  it('gives a fallback for anything else', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation "x" does not exist' } });
    await expect(fetchAdminStudents()).rejects.toBeInstanceOf(FriendlyError);
    await expect(fetchAdminStudents()).rejects.toThrow('We couldn’t load the students.');
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for function x' } });
    await expect(fetchAdminTeachers()).rejects.toThrow('We couldn’t load the teachers.');
  });
});
