import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { AdminClass, AdminStudent, AdminYear, YearStep } from '../data/admin';
import type { ClassSummary } from '../data/classes';
import { defaultNewYear } from './AdminYear';

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
const step = (over: Partial<YearStep> = {}): YearStep => ({ at: '2026-02-03T01:00:00Z', by: 'Calm Fox 2', byRealName: 'jriley', detail: {}, ...over });
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

describe('the new school year', () => {
  it('is next year from October to December and this year otherwise', () => {
    expect(defaultNewYear(new Date(2026, 9, 1))).toBe(2027);
    expect(defaultNewYear(new Date(2026, 11, 31))).toBe(2027);
    expect(defaultNewYear(new Date(2026, 2, 15))).toBe(2026);
  });

  it('starts in the box', async () => {
    show();
    expect(await screen.findByRole('spinbutton', { name: 'New school year' })).toHaveValue(2027);
  });
});

describe('End of year', () => {
  it('has the tab last, the intro and six steps in order', async () => {
    show();
    const nav = await screen.findByRole('navigation', { name: 'Admin' });
    const links = within(nav).getAllByRole('link');
    expect(links[links.length - 1]).toHaveTextContent('End of year');
    expect(links[links.length - 1]).toHaveAttribute('aria-current', 'page');
    await panel(/^1\./);
    expect(screen.getByText('Do these in order at the end of the school year. Each step says what it will change.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'End of year', '1. Next year’s classes', '2. Archive last year’s classes', '3. Students who have left', '4. New points season',
      '5. Clan Quest fame season', '6. Dragon Maths season', 'History',
    ]);
  });

  it('says when each step was last done, or that it was not', async () => {
    data.fetchAdminYear.mockResolvedValue({
      ...emptyYear,
      steps: { ...emptyYear.steps, points: step(), fame: step({ byRealName: null }), dragon: step({ by: null, byRealName: null }) },
    });
    show();
    expect(within(await panel(/^4\./)).getByText('Last done 3 Feb 2026 by jriley.')).toBeInTheDocument();
    expect(within(await panel(/^5\./)).getByText('Last done 3 Feb 2026 by Calm Fox 2.')).toBeInTheDocument();
    expect(within(await panel(/^6\./)).getByText('Last done 3 Feb 2026.')).toBeInTheDocument();
    expect(within(await panel(/^1\./)).getByText('Not done yet.')).toBeInTheDocument();
  });

  it('step 1 lists next year’s classes, links to the Classes tab and can be marked done', async () => {
    const user = userEvent.setup();
    show();
    const p1 = await panel(/^1\./);
    expect(within(p1).getByText('2 classes for 2027: Room 1, Room 2.')).toBeInTheDocument();
    expect(within(p1).getByRole('link', { name: 'Make classes on the Classes tab' })).toHaveAttribute('href', '/teacher/admin/classes');
    await user.click(within(p1).getByRole('button', { name: 'Mark as done' }));
    expect(data.markYearStep).toHaveBeenCalledWith('classes');
    expect(await within(p1).findByRole('status')).toHaveTextContent('Marked as done.');
    expect(data.fetchAdminYear).toHaveBeenCalledTimes(2);
  });

  it('step 1 changes with the year', async () => {
    const user = userEvent.setup();
    show();
    const box = await screen.findByRole('spinbutton', { name: 'New school year' });
    await user.clear(box);
    await user.type(box, '2030');
    expect(within(await panel(/^1\./)).getByText('No classes for 2030 yet.')).toBeInTheDocument();
  });

  it('step 2 lists current older classes, all ticked, and archives the ticked ones', async () => {
    const user = userEvent.setup();
    show();
    const p2 = await panel(/^2\./);
    expect(within(p2).getAllByRole('checkbox').map((c) => (c as HTMLInputElement).checked)).toEqual([true, true]);
    expect(within(p2).getByRole('checkbox', { name: 'Room 9 (2026, 24 students)' })).toBeChecked();
    expect(within(p2).getByRole('checkbox', { name: 'Room 8 (2026, 1 student)' })).toBeChecked();
    expect(within(p2).queryByText(/Old Room/)).not.toBeInTheDocument();
    await user.click(within(p2).getByRole('button', { name: 'Archive 2 classes' }));
    expect(data.archiveClasses).toHaveBeenCalledWith(['c9', 'c8']);
    expect(await within(p2).findByText('Archived 2 classes.')).toBeInTheDocument();
  });

  it('step 2 archives only what is still ticked, and is disabled at none', async () => {
    const user = userEvent.setup();
    show();
    const p2 = await panel(/^2\./);
    await user.click(within(p2).getByRole('checkbox', { name: /Room 9/ }));
    await user.click(within(p2).getByRole('button', { name: 'Archive 1 class' }));
    expect(data.archiveClasses).toHaveBeenCalledWith(['c8']);
    await user.click(within(p2).getByRole('checkbox', { name: /Room 8/ }));
    expect(within(p2).getByRole('button', { name: 'Archive 0 classes' })).toBeDisabled();
  });

  it('step 2 says when there is nothing to archive', async () => {
    data.fetchAdminClasses.mockResolvedValue([classes[2]]);
    show();
    expect(within(await panel(/^2\./)).getByText('No classes from before 2027.')).toBeInTheDocument();
  });

  it('step 3 lists only students with no class or an archived class, none ticked', async () => {
    show();
    const p3 = await panel(/^3\./);
    const boxes = within(p3).getAllByRole('checkbox', { name: /·/ });
    expect(boxes.map((b) => b.closest('label')?.textContent)).toEqual([
      'Lucky Tui 12, tom.brown · No class',
      'Calm Fox 9, amy.lee · Old Room (archived)',
      'Quick Kea 5, pat.lee · No class',
    ]);
    expect(boxes.every((b) => !(b as HTMLInputElement).checked)).toBe(true);
    expect(within(p3).queryByText(/Brave Kiwi/)).not.toBeInTheDocument();
    expect(within(p3).getByText('Move anyone who is staying into a class first (Admin → Students).')).toBeInTheDocument();
    expect(within(p3).queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('step 3 hides real names on request', async () => {
    const user = userEvent.setup();
    show();
    const p3 = await panel(/^3\./);
    await user.click(within(p3).getByRole('checkbox', { name: 'Hide real names' }));
    expect(within(p3).queryByText(/tom\.brown/)).not.toBeInTheDocument();
    expect(within(p3).getByText('Lucky Tui 12 · No class')).toBeInTheDocument();
  });

  it('step 3 ticks all and unticks all', async () => {
    const user = userEvent.setup();
    show();
    const p3 = await panel(/^3\./);
    await user.click(within(p3).getByRole('button', { name: 'Tick all' }));
    expect(within(p3).getByRole('button', { name: 'Delete 3 students' })).toBeDisabled();
    await user.click(within(p3).getByRole('button', { name: 'Untick all' }));
    expect(within(p3).queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

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

  it('step 3 shows the server’s reason when it refuses', async () => {
    const user = userEvent.setup();
    const { FriendlyError } = await import('../data/profile');
    data.deleteLeavers.mockRejectedValue(new FriendlyError('One of those students is still in a current class, or isn’t a student at your school.'));
    show();
    const p3 = await panel(/^3\./);
    await user.click(within(p3).getByRole('checkbox', { name: /Lucky Tui 12/ }));
    await user.type(within(p3).getByRole('textbox'), '1');
    await user.click(within(p3).getByRole('button', { name: 'Delete 1 student' }));
    expect(await within(p3).findByText(/still in a current class/)).toBeInTheDocument();
  });

  it('step 4 starts a new points season with the words', async () => {
    const user = userEvent.setup();
    show();
    const p4 = await panel(/^4\./);
    expect(within(p4).getByText(/deletes/)).toBeInTheDocument();
    const button = within(p4).getByRole('button', { name: 'Start a new season' });
    expect(button).toBeDisabled();
    await user.type(within(p4).getByRole('textbox'), 'NEW SEASON');
    await user.click(button);
    expect(data.adminNewPointsSeason).toHaveBeenCalledWith('NEW SEASON');
    expect(await within(p4).findByText(/Done\. 5 bot games, 3 games between students and 7 Gem Keep levels were deleted/)).toBeInTheDocument();
  });

  it('step 5 starts a new fame season with the words', async () => {
    const user = userEvent.setup();
    show();
    const p5 = await panel(/^5\./);
    expect(within(p5).getByText(/Do this after students are in their new classes\./)).toBeInTheDocument();
    await user.type(within(p5).getByRole('textbox'), 'NEW SEASON');
    await user.click(within(p5).getByRole('button', { name: 'Start a new fame season' }));
    expect(data.adminClansNewSeason).toHaveBeenCalledWith('NEW SEASON');
    expect(await within(p5).findByText('Season 4 has begun.')).toBeInTheDocument();
  });

  it('step 6 can be marked done', async () => {
    const user = userEvent.setup();
    show();
    const p6 = await panel(/^6\./);
    expect(within(p6).getByText(/One date for the whole school is coming\./)).toBeInTheDocument();
    await user.click(within(p6).getByRole('button', { name: 'Mark as done' }));
    expect(data.markYearStep).toHaveBeenCalledWith('dragon');
    await waitFor(() => expect(within(p6).getByRole('status')).toHaveTextContent('Marked as done.'));
  });

  it('History says what happened, newest first', async () => {
    const at = '2026-10-28T01:00:00Z';
    data.fetchAdminYear.mockResolvedValue({
      ...emptyYear,
      log: [
        { ...step({ at }), action: 'archive', detail: { count: 3, names: ['a'] } },
        { ...step({ at }), action: 'leavers', detail: { count: 1 } },
        { ...step({ at }), action: 'points', detail: {} },
        { ...step({ at }), action: 'fame', detail: { season: 4, clans: 6 } },
        { ...step({ at }), action: 'classes', detail: {} },
        { ...step({ at, byRealName: null }), action: 'dragon', detail: {} },
      ],
    });
    show();
    const history = within(await panel(/^History$/));
    expect(history.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '28 Oct 2026, jriley: archived 3 classes',
      '28 Oct 2026, jriley: deleted 1 student',
      '28 Oct 2026, jriley: started a new points season',
      '28 Oct 2026, jriley: started Clan Quest fame season 4',
      '28 Oct 2026, jriley: marked next year’s classes done',
      '28 Oct 2026, Calm Fox 2: marked Dragon Maths done',
    ]);
  });

  it('History is empty at first', async () => {
    show();
    expect(within(await panel(/^History$/)).getByText('Nothing yet.')).toBeInTheDocument();
  });

  it('shows why it could not load', async () => {
    data.fetchAdminYear.mockRejectedValue(new Error('x'));
    show();
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});
