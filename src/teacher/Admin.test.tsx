import { render, screen, waitFor, within } from '@testing-library/react';
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
const rowNames = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('rowheader')[0].textContent);

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

  it('have Overview, Classes, Students, Teachers and End of year tabs', async () => {
    show('/teacher/admin');
    const nav = await screen.findByRole('navigation', { name: 'Admin' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Overview', 'Classes', 'Students', 'Teachers', 'End of year']);
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
    expect(screen.getByRole('link', { name: 'Classes with no teacher: Room 3, Room 9' })).toHaveAttribute('href', '/teacher/admin/classes?show=noteacher');
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

describe('Classes', () => {
  const classRow = (name: string) => screen.getAllByRole('row').find((r) => within(r).queryByText(new RegExp(`^${name}`), { selector: 'th *, th' }))!;

  it('lists the current classes, with years, teachers, codes and last active', async () => {
    show('/teacher/admin/classes');
    await screen.findByRole('link', { name: 'Room 12' });
    expect(rowNames()).toEqual(['Room 12', 'Room 3', 'Room 9']);
    expect(screen.getByRole('button', { name: 'Current' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Room 12' })).toHaveAttribute('href', '/teacher/c12');
    const row = classRow('Room 3');
    expect(within(row).getByText('2026')).toBeInTheDocument();
    expect(within(row).getByText('KM4TP (asks first)')).toBeInTheDocument();
    expect(within(row).getByText('Not yet')).toBeInTheDocument();
    expect(within(classRow('Room 12')).getByText('2026 · Year 5')).toBeInTheDocument();
    expect(within(classRow('Room 12')).getByText('Yesterday')).toBeInTheDocument();
    expect(within(classRow('Room 9')).getByText('KM4TP (off)')).toBeInTheDocument();
  });

  it('filters by ?show= and by the buttons', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/classes?show=noteacher');
    await screen.findByText('Room 9');
    expect(rowNames()).toEqual(['Room 9']);
    expect(screen.getByRole('button', { name: 'No teacher' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Archived' }));
    expect(rowNames()).toEqual(['Room 1 (archived)']);
    expect(screen.queryByRole('link', { name: /Room 1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'address' })).toHaveTextContent('?show=archived');
    await user.click(screen.getByRole('button', { name: 'Current' }));
    expect(rowNames()).toHaveLength(3);
    expect(screen.getByRole('status', { name: 'address' })).not.toHaveTextContent('show=');
  });

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

  it('adds and removes a teacher', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/classes');
    await screen.findByText('Room 9');
    const add = screen.getByRole('combobox', { name: 'Add a teacher to Room 9' });
    expect(within(add).getAllByRole('option').map((o) => o.textContent)).toEqual(['Add a teacher', 'Calm Fox 2', 'Wise Owl 1', 'Quick Kea 5']);
    await user.selectOptions(add, 't2');
    expect(data.addCoTeacher).toHaveBeenCalledWith('c9', 't2');
    expect(await screen.findByText('Wise Owl 1 teaches Room 9 now.')).toBeInTheDocument();
    // Room 3 already has both of the others, so only Calm Fox 2 is left to add.
    const room3 = screen.getByRole('combobox', { name: 'Add a teacher to Room 3' });
    expect(within(room3).getAllByRole('option').map((o) => o.textContent)).toEqual(['Add a teacher', 'Calm Fox 2']);
    await user.click(screen.getByRole('button', { name: 'Take Quick Kea 5 off Room 3' }));
    expect(data.removeCoTeacher).toHaveBeenCalledWith('c3', 't3');
    expect(await screen.findByText('Quick Kea 5 no longer teaches Room 3.')).toBeInTheDocument();
  });

  it('shows the server’s message when it refuses', async () => {
    const { FriendlyError } = await import('../data/profile');
    data.archiveClass.mockRejectedValue(new FriendlyError('Only a school admin can do that.'));
    const user = userEvent.setup();
    show('/teacher/admin/classes');
    await screen.findByText('Room 9');
    await user.click(within(classRow('Room 9')).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Only a school admin can do that.')).toBeInTheDocument();
  });

  it('makes a class for me by default, and for another teacher when chosen', async () => {
    const user = userEvent.setup();
    show('/teacher/admin/classes');
    await screen.findByText('Room 9');
    const thisYear = new Date().getFullYear();
    expect(screen.getByRole('spinbutton', { name: 'School year' })).toHaveValue(thisYear);
    await user.click(screen.getByRole('button', { name: 'Make the class' }));
    expect(data.createClassFor).toHaveBeenLastCalledWith('', thisYear, null, 't9');
    expect(await screen.findByText('Class made.')).toBeInTheDocument();
    expect(data.fetchAdminClasses).toHaveBeenCalledTimes(2);

    const make = screen.getByRole('region', { name: 'Make a class' });
    expect(within(within(make).getByRole('combobox', { name: 'Year level (optional)' })).getAllByRole('option')).toHaveLength(15);
    await user.type(within(make).getByRole('textbox', { name: 'Class name (optional)' }), ' Room 20 ');
    await user.selectOptions(within(make).getByRole('combobox', { name: 'Year level (optional)' }), '0');
    await user.selectOptions(within(make).getByRole('combobox', { name: 'Teacher' }), 't2');
    await user.click(screen.getByRole('button', { name: 'Make the class' }));
    expect(data.createClassFor).toHaveBeenLastCalledWith('Room 20', thisYear, 0, 't2');
  });

  it('shows why a class could not be made', async () => {
    const { FriendlyError } = await import('../data/profile');
    data.createClassFor.mockRejectedValue(new FriendlyError('That person isn’t a teacher at your school.'));
    const user = userEvent.setup();
    show('/teacher/admin/classes');
    await screen.findByText('Room 9');
    await user.click(screen.getByRole('button', { name: 'Make the class' }));
    expect(await screen.findByText('That person isn’t a teacher at your school.')).toBeInTheDocument();
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
