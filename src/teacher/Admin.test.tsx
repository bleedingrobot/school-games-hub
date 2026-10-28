import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { AdminOverview, AdminStudent, AdminTeacher } from '../data/admin';
import type { ClassSummary } from '../data/classes';

const data = vi.hoisted(() => ({
  fetchClasses: vi.fn(),
  fetchAdminOverview: vi.fn(),
  fetchAdminStudents: vi.fn(),
  fetchAdminTeachers: vi.fn(),
  setSchoolAdmin: vi.fn(),
  setRole: vi.fn(),
}));
vi.mock('../data/classes', async (original) => ({
  ...(await original<typeof import('../data/classes')>()),
  fetchClasses: data.fetchClasses,
  fetchWarpRequests: vi.fn(async () => []),
}));
vi.mock('../data/admin', async (original) => ({
  ...(await original<typeof import('../data/admin')>()),
  fetchAdminOverview: data.fetchAdminOverview,
  fetchAdminStudents: data.fetchAdminStudents,
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
const rowNames = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('rowheader')[0].textContent);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  data.fetchClasses.mockResolvedValue([room('c12', 'Room 12')]);
  data.fetchAdminOverview.mockResolvedValue(base);
  data.fetchAdminStudents.mockResolvedValue(students);
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

  it('have Overview, Students and Teachers tabs', async () => {
    show('/teacher/admin');
    const nav = await screen.findByRole('navigation', { name: 'Admin' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Overview', 'Students', 'Teachers']);
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(nav).getByRole('link', { name: 'Teachers' }));
    expect(await screen.findByRole('heading', { name: /Teachers/, level: 2 })).toBeInTheDocument();
  });
});

describe('Overview', () => {
  it('says nothing needs an admin when nothing does, and shows the numbers', async () => {
    show('/teacher/admin');
    expect(await screen.findByText('Nothing needs an admin right now.')).toBeInTheDocument();
    expect(screen.queryByText(/aren’t in a class/)).not.toBeInTheDocument();
    const school = screen.getByRole('region', { name: 'The school' });
    expect(within(school).getByText('Teachers').nextSibling).toHaveTextContent('6 (2 admins)');
    expect(within(school).getByText('Skipped').nextSibling).toHaveTextContent('25%');
  });

  it('shows only the lines that apply', async () => {
    data.fetchAdminOverview.mockResolvedValue({ ...base, noClass: 4, classesNoTeacher: [{ id: 'c3', name: 'Room 3' }, { id: 'c9', name: 'Room 9' }], oldWarp: 0 });
    show('/teacher/admin');
    const link = await screen.findByRole('link', { name: '4 students aren’t in a class' });
    expect(link).toHaveAttribute('href', '/teacher/admin/students?show=noclass');
    expect(screen.getByText('Classes with no teacher: Room 3, Room 9')).toBeInTheDocument();
    expect(screen.queryByText(/waited more than a day/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing needs an admin right now.')).not.toBeInTheDocument();
  });

  it('mentions old join requests', async () => {
    data.fetchAdminOverview.mockResolvedValue({ ...base, oldWarp: 3 });
    show('/teacher/admin');
    expect(await screen.findByText('3 students have waited more than a day to join a class')).toBeInTheDocument();
  });

  it('shows the reason when it cannot load', async () => {
    data.fetchAdminOverview.mockRejectedValue(new Error('x'));
    show('/teacher/admin');
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

describe('Students', () => {
  it('lists every student with their class, and links to their page', async () => {
    show('/teacher/admin/students');
    await screen.findByText('Brave Kiwi 7');
    expect(rowNames()).toEqual(['Brave Kiwi 7', 'Lucky Tui 12', 'Calm Fox 9']);
    expect(within(screen.getByRole('region', { name: /^Students/ })).getByText('3 students')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Brave Kiwi 7/ })).toHaveAttribute('href', '/teacher/c12/students/s1');
    expect(screen.getByText('Room 1 (archived)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters by ?show= and by the buttons', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/students?show=noclass');
    await screen.findByText('Lucky Tui 12');
    expect(rowNames()).toEqual(['Lucky Tui 12', 'Calm Fox 9']);
    expect(screen.getByRole('button', { name: 'Not in a class' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Hidden' }));
    expect(rowNames()).toEqual(['Calm Fox 9']);
    expect(screen.getByRole('status', { name: 'address' })).toHaveTextContent('?show=hidden');
    await user.click(screen.getByRole('button', { name: 'Not played for 30 days' }));
    expect(rowNames()).toEqual(['Lucky Tui 12', 'Calm Fox 9']);
    await user.click(screen.getByRole('button', { name: 'Everyone' }));
    expect(rowNames()).toHaveLength(3);
  });

  it('finds a student by either name, and hides real names', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/students');
    await screen.findByText('Brave Kiwi 7');
    await user.type(screen.getByRole('searchbox', { name: 'Find a student' }), 'tom.b');
    expect(rowNames()).toEqual(['Lucky Tui 12']);
    await user.click(screen.getByRole('checkbox', { name: 'Hide real names' }));
    expect(screen.getByText('No students match.')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Real name' })).not.toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Find a student' }));
    expect(screen.queryByText('jane.smith')).not.toBeInTheDocument();
  });
});

describe('Teachers', () => {
  it('lists teachers, classes and who is a school admin', async () => {
    show('/teacher/admin/teachers');
    await screen.findByText('Wise Owl 1');
    expect(screen.getByText('Room 3, Room 4')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Yes')).toBeInTheDocument();
    expect(within(rows[2]).getByText('No')).toBeInTheDocument();
  });

  it('has no buttons on your own row', async () => {
    show('/teacher/admin/teachers');
    await screen.findByText('Wise Owl 1');
    const mine = screen.getAllByRole('row')[1];
    expect(within(mine).getByText('That’s you')).toBeInTheDocument();
    expect(within(mine).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove teacher' })).toHaveLength(2);
  });

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

  it('asks before removing a teacher, and Cancel does nothing', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/teachers');
    await screen.findByText('Wise Owl 1');
    await user.click(screen.getAllByRole('button', { name: 'Remove teacher' })[0]);
    expect(screen.getByText('Remove teacher: they become a student and stop teaching their classes.')).toBeInTheDocument();
    expect(data.setRole).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/they become a student/)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Remove teacher' })[0]);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(data.setRole).toHaveBeenCalledWith('t2', 'student');
    await waitFor(() => expect(screen.getByText('Wise Owl 1 is now a student.')).toBeInTheDocument());
  });

  it('shows the server’s message when it refuses', async () => {
    const { FriendlyError } = await import('../data/profile');
    data.setSchoolAdmin.mockRejectedValue(new FriendlyError('Only a school admin can do that.'));
    const user = userEvent.setup();
    show('/teacher/admin/teachers');
    await screen.findByText('Wise Owl 1');
    await user.click(screen.getByRole('button', { name: 'Make school admin' }));
    expect(await screen.findByText('Only a school admin can do that.')).toBeInTheDocument();
  });
});
