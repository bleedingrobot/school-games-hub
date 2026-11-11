import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { AdminClass, AdminStudent, AdminYear} from '../data/admin';
import type { ClassSummary } from '../data/classes';

const data = vi.hoisted(() => ({
  fetchClasses: vi.fn(),
  fetchAdminYear: vi.fn(),
  fetchAdminClasses: vi.fn(),
  fetchAdminStudents: vi.fn(),
  markYearStep: vi.fn(),
  archiveClasses: vi.fn(),
  deleteLeavers: vi.fn(),
  adminNewPointsSeason: vi.fn(),
  adminClansNewSeason: vi.fn(),
}));
vi.mock('../data/classes', async (original) => ({
  ...(await original<typeof import('../data/classes')>()),
  fetchClasses: data.fetchClasses,
}));
vi.mock('../data/admin', async (original) => ({ ...(await original<typeof import('../data/admin')>()), ...data }));

const room = (id: string, name: string): ClassSummary => ({
  id, name, school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on', members: 3, teaching: true, groups: 0, waiting: 0,
});
const adminClass = (over: Partial<AdminClass> & { id: string; name: string }): AdminClass => ({
  schoolYear: 2026, yearLevel: 5, archived: false, archivedAt: null, warpCode: 'KM4TP', warpMode: 'on', students: 24, teachers: [], lastActive: null, ...over,
});
const classes: AdminClass[] = [
  adminClass({ id: 'c9', name: 'Room 9' }),
  adminClass({ id: 'c8', name: 'Room 8', students: 1 }),
  adminClass({ id: 'c27', name: 'Room 1', schoolYear: 2027 }),
  adminClass({ id: 'c28', name: 'Room 2', schoolYear: 2027 }),
  adminClass({ id: 'c1', name: 'Old Room', schoolYear: 2025, archived: true }),
];
const student = (over: Partial<AdminStudent> & { id: string; name: string }): AdminStudent => ({
  realName: null, avatar: {}, hidden: false, classId: 'c9', className: 'Room 9', classArchived: false, lastPlayed: null, ...over,
});
const students: AdminStudent[] = [
  student({ id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith' }),
  student({ id: 's2', name: 'Lucky Tui 12', realName: 'tom.brown', classId: null, className: null }),
  student({ id: 's3', name: 'Calm Fox 9', realName: 'amy.lee', classId: 'c1', className: 'Old Room', classArchived: true }),
  student({ id: 's4', name: 'Quick Kea 5', realName: 'pat.lee', classId: null, className: null }),
];
const emptyYear: AdminYear = { steps: { classes: null, archive: null, leavers: null, points: null, fame: null, dragon: null }, log: [] };

const admin: AuthState = {
  status: 'signed-in',
  profile: { id: 't9', display_name: 'Calm Fox 2', avatar: {}, role: 'teacher', school_admin: true },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};
function show() {
  return render(
    <AuthContext.Provider value={admin}>
      <MemoryRouter initialEntries={['/teacher/admin/year']}>
        <Routes>{teacherRoutes()}</Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
const panel = (name: RegExp) => screen.findByRole('region', { name });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  data.fetchClasses.mockResolvedValue([room('c9', 'Room 9')]);
  data.fetchAdminYear.mockResolvedValue(emptyYear);
  data.fetchAdminClasses.mockResolvedValue(classes);
  data.fetchAdminStudents.mockResolvedValue(students);
  data.markYearStep.mockResolvedValue(undefined);
  data.archiveClasses.mockResolvedValue(2);
  data.deleteLeavers.mockResolvedValue(2);
  data.adminNewPointsSeason.mockResolvedValue({ botGames: 5, friendGames: 3, gemKeepLevels: 7 });
  data.adminClansNewSeason.mockResolvedValue({ season: 4, clans: 6 });
});
afterEach(() => vi.useRealTimers());


describe('End of year', () => {

  it('step 3 needs the count typed, then deletes the ticked students', async () => {
    const user = userEvent.setup();
    show();
    const p3 = await panel(/^3\./);
    await user.click(within(p3).getByRole('checkbox', { name: /Lucky Tui 12/ }));
    await user.click(within(p3).getByRole('checkbox', { name: /Quick Kea 5/ }));
    expect(within(p3).getByText('Deleting a student deletes their account and everything they’ve played. It can’t be undone.')).toBeInTheDocument();
    const button = within(p3).getByRole('button', { name: 'Delete 2 students' });
    expect(button).toBeDisabled();
    await user.type(within(p3).getByRole('textbox'), '3');
    expect(button).toBeDisabled();
    await user.clear(within(p3).getByRole('textbox'));
    await user.type(within(p3).getByRole('textbox'), '2');
    await user.click(button);
    expect(data.deleteLeavers).toHaveBeenCalledWith(['s2', 's4'], '2');
    expect(await within(p3).findByText('Deleted 2 students.')).toBeInTheDocument();
  });

});
