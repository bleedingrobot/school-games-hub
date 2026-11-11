import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { AdminClass, AdminOverview, AdminStudent, AdminTeacher } from '../data/admin';
import type { ClassSummary } from '../data/classes';

const data = vi.hoisted(() => ({
  fetchClasses: vi.fn(),
  fetchAdminOverview: vi.fn(),
  fetchAdminClasses: vi.fn(),
  createClassFor: vi.fn(),
  archiveClass: vi.fn(),
  addCoTeacher: vi.fn(),
  removeCoTeacher: vi.fn(),
  fetchAdminStudents: vi.fn(),
  fetchAdminTeachers: vi.fn(),
  setSchoolAdmin: vi.fn(),
  setRole: vi.fn(),
}));
vi.mock('../data/classes', async (original) => ({
  ...(await original<typeof import('../data/classes')>()),
  fetchClasses: data.fetchClasses,
  fetchWarpRequests: vi.fn(async () => []),
  archiveClass: data.archiveClass,
  addCoTeacher: data.addCoTeacher,
  removeCoTeacher: data.removeCoTeacher,
}));
vi.mock('../data/admin', async (original) => ({
  ...(await original<typeof import('../data/admin')>()),
  fetchAdminOverview: data.fetchAdminOverview,
  fetchAdminStudents: data.fetchAdminStudents,
  fetchAdminClasses: data.fetchAdminClasses,
  createClassFor: data.createClassFor,
  fetchAdminTeachers: data.fetchAdminTeachers,
  setSchoolAdmin: data.setSchoolAdmin,
}));
vi.mock('../data/teacher', async (original) => ({ ...(await original<typeof import('../data/teacher')>()), setRole: data.setRole }));

const room = (id: string, name: string): ClassSummary => ({
  id, name, school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on', members: 3, teaching: true, groups: 0, waiting: 0,
});
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const base: AdminOverview = {
  counts: { classes: 4, students: 90, teachers: 6, admins: 2, activeWeek: 60, shownWeek: 200, skippedWeek: 50 },
  noClass: 0,
  classesNoTeacher: [],
  oldWarp: 0,
};

const student = (over: Partial<AdminStudent> & { id: string; name: string }): AdminStudent => ({
  realName: null, avatar: {}, hidden: false, classId: 'c12', className: 'Room 12', classArchived: false, lastPlayed: daysAgo(1), ...over,
});
const students: AdminStudent[] = [
  student({ id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith' }),
  student({ id: 's2', name: 'Lucky Tui 12', realName: 'tom.brown', classId: null, className: null, lastPlayed: null }),
  student({ id: 's3', name: 'Calm Fox 9', realName: 'amy.lee', hidden: true, classId: 'c1', className: 'Room 1', classArchived: true, lastPlayed: daysAgo(60) }),
];

const teacher = (over: Partial<AdminTeacher> & { id: string; name: string }): AdminTeacher => ({
  realName: null, avatar: {}, admin: false, me: false, classes: [], ...over,
});
const teachers: AdminTeacher[] = [
  teacher({ id: 't9', name: 'Calm Fox 2', realName: 'me.admin', admin: true, me: true, classes: [{ id: 'c12', name: 'Room 12' }] }),
  teacher({ id: 't2', name: 'Wise Owl 1', realName: 'sam.jones', classes: [{ id: 'c3', name: 'Room 3' }, { id: 'c4', name: 'Room 4' }] }),
  teacher({ id: 't3', name: 'Quick Kea 5', realName: 'pat.lee', admin: true }),
];

const adminClass = (over: Partial<AdminClass> & { id: string; name: string }): AdminClass => ({
  schoolYear: 2026, yearLevel: 5, archived: false, archivedAt: null, warpCode: 'KM4TP', warpMode: 'on', students: 24, teachers: [], lastActive: daysAgo(1), ...over,
});
const classes: AdminClass[] = [
  adminClass({ id: 'c12', name: 'Room 12', teachers: [{ id: 't9', name: 'Calm Fox 2', realName: 'me.admin' }] }),
  adminClass({ id: 'c3', name: 'Room 3', yearLevel: null, warpMode: 'ask', students: 0, lastActive: null, teachers: [{ id: 't2', name: 'Wise Owl 1', realName: 'sam.jones' }, { id: 't3', name: 'Quick Kea 5', realName: 'pat.lee' }] }),
  adminClass({ id: 'c9', name: 'Room 9', warpMode: 'off' }),
  adminClass({ id: 'c1', name: 'Room 1', archived: true, teachers: [{ id: 't2', name: 'Wise Owl 1', realName: 'sam.jones' }] }),
];

const auth = (extra: object): AuthState => ({
  status: 'signed-in',
  profile: { id: 't9', display_name: 'Calm Fox 2', avatar: {}, role: 'teacher', ...extra },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
});
const admin = auth({ school_admin: true });
const ordinary = auth({});

function Where() {
  const { pathname, search } = useLocation();
  return <output aria-label="address">{pathname + search}</output>;
}
function show(url: string, who: AuthState = admin) {
  return render(
    <AuthContext.Provider value={who}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>{teacherRoutes()}</Routes>
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  data.fetchClasses.mockResolvedValue([room('c12', 'Room 12')]);
  data.fetchAdminOverview.mockResolvedValue(base);
  data.fetchAdminStudents.mockResolvedValue(students);
  data.fetchAdminClasses.mockResolvedValue(classes);
  for (const f of [data.createClassFor, data.archiveClass, data.addCoTeacher, data.removeCoTeacher]) f.mockResolvedValue(undefined);
  data.fetchAdminTeachers.mockResolvedValue(teachers);
  data.setSchoolAdmin.mockResolvedValue(undefined);
  data.setRole.mockResolvedValue(undefined);
});

describe('the admin pages', () => {
  it('turn away a teacher who is not a school admin', async () => {
    show('/teacher/admin/students', ordinary);
    expect(await screen.findByText('This page is for school admins.')).toBeInTheDocument();
    expect(data.fetchAdminStudents).not.toHaveBeenCalled();
  });

});


describe('Classes', () => {
  const classRow = (name: string) => screen.getAllByRole('row').find((r) => within(r).queryByText(new RegExp(`^${name}`), { selector: 'th *, th' }))!;

  it('archives and unarchives, then reloads', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/classes');
    await screen.findByText('Room 9');
    await user.click(within(classRow('Room 9')).getByRole('button', { name: 'Archive' }));
    expect(data.archiveClass).toHaveBeenCalledWith('c9', true);
    expect(await screen.findByText('Room 9 is archived.')).toBeInTheDocument();
    expect(data.fetchAdminClasses).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Archived' }));
    await user.click(screen.getByRole('button', { name: 'Unarchive' }));
    expect(data.archiveClass).toHaveBeenLastCalledWith('c1', false);
    expect(await screen.findByText('Room 1 is back.')).toBeInTheDocument();
  });

});


describe('Teachers', () => {

  it('makes and removes a school admin, then reloads', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/teachers');
    await screen.findByText('Wise Owl 1');
    await user.click(screen.getByRole('button', { name: 'Make school admin' }));
    expect(data.setSchoolAdmin).toHaveBeenCalledWith('t2', true);
    expect(await screen.findByText('Wise Owl 1 is now a school admin.')).toBeInTheDocument();
    expect(data.fetchAdminTeachers).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Remove school admin' }));
    expect(data.setSchoolAdmin).toHaveBeenCalledWith('t3', false);
  });

});
