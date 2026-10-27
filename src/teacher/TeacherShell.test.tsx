import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { ClassSummary, WarpRequest } from '../data/classes';
import type { FocusBatch } from '../data/focus';

const data = vi.hoisted(() => ({
  fetchClasses: vi.fn(),
  fetchWarpRequests: vi.fn(),
  fetchMultiplayerEnabled: vi.fn(),
  setMultiplayer: vi.fn(),
  fetchReactionsEnabled: vi.fn(),
  fetchSkipMode: vi.fn(),
  fetchFocuses: vi.fn(),
  fetchQuestionSkips: vi.fn(),
  fetchClassMap: vi.fn(),
}));
vi.mock('../data/classes', async (original) => ({
  ...(await original<typeof import('../data/classes')>()),
  fetchClasses: data.fetchClasses,
  fetchWarpRequests: data.fetchWarpRequests,
}));
vi.mock('../data/multiplayer', async (original) => ({
  ...(await original<typeof import('../data/multiplayer')>()),
  fetchMultiplayerEnabled: data.fetchMultiplayerEnabled,
}));
vi.mock('../data/teacher', async (original) => ({ ...(await original<typeof import('../data/teacher')>()), setMultiplayer: data.setMultiplayer }));
vi.mock('../data/spaceGames', async (original) => ({
  ...(await original<typeof import('../data/spaceGames')>()),
  fetchReactionsEnabled: data.fetchReactionsEnabled,
}));
vi.mock('../data/questionSkips', async (original) => ({ ...(await original<typeof import('../data/questionSkips')>()), fetchSkipMode: data.fetchSkipMode }));
vi.mock('../data/focus', async (original) => ({ ...(await original<typeof import('../data/focus')>()), fetchFocuses: data.fetchFocuses }));
vi.mock('../data/questionLog', async (original) => ({
  ...(await original<typeof import('../data/questionLog')>()),
  fetchQuestionSkips: data.fetchQuestionSkips,
}));
vi.mock('../data/skillMap', async (original) => ({ ...(await original<typeof import('../data/skillMap')>()), fetchClassMap: data.fetchClassMap }));

const room = (id: string, name: string, over: Partial<ClassSummary> = {}): ClassSummary => ({
  id, name, school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'ask', members: 28, teaching: true, groups: 0, waiting: 0, ...over,
});
const asking = (id: string, classId: string, className: string, student: string): WarpRequest => ({
  id, class_id: classId, class_name: className, group_name: null, student_name: student, asked_at: new Date().toISOString(),
});

const student: AuthState = {
  status: 'signed-in',
  profile: { id: 's1', display_name: 'Brave Kiwi 7', avatar: {}, role: 'student' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};
const teacher: AuthState = { ...student, profile: { id: 't1', display_name: 'Wise Owl 1', avatar: {}, role: 'teacher' } };
const admin: AuthState = { ...student, profile: { id: 't9', display_name: 'Calm Fox 2', avatar: {}, role: 'teacher', school_admin: true } };

/** Where the router is now, so a test can see the address after a redirect or a click. */
function Where() {
  const { pathname, search } = useLocation();
  return <output aria-label="address">{pathname + search}</output>;
}

function show(url: string, auth: AuthState = teacher) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>{teacherRoutes()}</Routes>
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const address = () => screen.getByRole('status', { name: 'address' }).textContent;
const tabs = () => screen.getByRole('navigation', { name: 'Teacher pages' });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  data.fetchClasses.mockResolvedValue([room('c12', 'Room 12'), room('c14', 'Room 14', { members: 25, warp_mode: 'on' })]);
  data.fetchWarpRequests.mockResolvedValue([]);
  data.fetchMultiplayerEnabled.mockResolvedValue(true);
  data.setMultiplayer.mockResolvedValue(undefined);
  data.fetchReactionsEnabled.mockResolvedValue(false);
  data.fetchSkipMode.mockResolvedValue('limited');
  data.fetchFocuses.mockResolvedValue([]);
  data.fetchQuestionSkips.mockResolvedValue({ students: [], spots: [] });
  data.fetchClassMap.mockResolvedValue({ classId: 'c14', className: 'Room 14', yearLevel: 5, auto: true, students: [] });
});

describe('the teacher header', () => {
  it('shows the class, its student count, code and warp mode, and the tabs', async () => {
    show('/teacher/c12');
    expect(await screen.findByRole('heading', { level: 1, name: 'Room 12' })).toBeInTheDocument();
    expect(screen.getByText('28 students')).toBeInTheDocument();
    expect(screen.getByText(/Code KM4.*\(asks you first\)/)).toBeInTheDocument();
    expect(within(tabs()).getAllByRole('link').map((l) => l.textContent)).toEqual(['Today', 'Students', 'Maths', 'Games', 'Class set-up']);
    expect(within(tabs()).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('has no dropdown when there is only one class', async () => {
    data.fetchClasses.mockResolvedValue([room('c12', 'Room 12')]);
    show('/teacher/c12');
    await screen.findByRole('heading', { level: 1, name: 'Room 12' });
    expect(screen.queryByRole('combobox', { name: 'Class' })).not.toBeInTheDocument();
  });

  it('marks a class a school admin does not teach, and gives only an admin the Admin tab', async () => {
    data.fetchClasses.mockResolvedValue([room('c12', 'Room 12'), room('c1', 'Room 1', { teaching: false })]);
    const { unmount } = show('/teacher/c1', admin);
    expect(await screen.findByRole('heading', { level: 1, name: 'Room 1 (not mine)' })).toBeInTheDocument();
    const picker = screen.getByRole('combobox', { name: 'Class' });
    expect([...picker.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Room 12', 'Room 1 (not mine)']);
    expect(within(tabs()).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/teacher/admin');
    unmount();
    show('/teacher/c12');
    await screen.findByRole('heading', { level: 1, name: 'Room 12' });
    expect(within(tabs()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('keeps the admin page for school admins', async () => {
    const { unmount } = show('/teacher/admin', admin);
    expect(await screen.findByRole('heading', { name: 'Admin', level: 2 })).toBeInTheDocument();
    expect(screen.queryByText('This page is for school admins.')).not.toBeInTheDocument();
    unmount();
    show('/teacher/admin');
    expect(await screen.findByText('This page is for school admins.')).toBeInTheDocument();
  });

  it('is for teachers only, and asks nothing for a student', () => {
    show('/teacher/c12', student);
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(data.fetchClasses).not.toHaveBeenCalled();
  });

  it('asks a teacher with no class to make one', async () => {
    data.fetchClasses.mockResolvedValue([]);
    show('/teacher');
    expect(await screen.findByText(/You don’t teach a class yet/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Make a class' })).toBeInTheDocument();
  });

  it('says so when the classes cannot be loaded', async () => {
    data.fetchClasses.mockRejectedValue(new Error('down'));
    show('/teacher/c12');
    expect(await screen.findByText(/We couldn’t load your classes/)).toBeInTheDocument();
  });
});

describe('the class carries across the teacher pages', () => {
  it('keeps the class from tab to tab, and asks for that class', async () => {
    const user = userEvent.setup();
    show('/teacher/c14');
    await screen.findByRole('heading', { level: 1, name: 'Room 14' });
    await waitFor(() => expect(data.fetchFocuses).toHaveBeenCalledWith('c14'));
    expect(data.fetchMultiplayerEnabled).toHaveBeenCalledWith('c14');
    for (const [tab, path] of [
      ['Students', '/teacher/c14/students'],
      ['Maths', '/teacher/c14/maths'],
      ['Games', '/teacher/c14/games'],
      ['Class set-up', '/teacher/c14/setup'],
      ['Today', '/teacher/c14'],
    ]) {
      await user.click(within(tabs()).getByRole('link', { name: tab }));
      // Some tabs load their code on first use, and the router waits for it before moving.
      await waitFor(() => expect(address()).toBe(path));
      expect(screen.getByRole('heading', { level: 1, name: 'Room 14' })).toBeInTheDocument();
    }
    await user.click(within(tabs()).getByRole('link', { name: 'Maths' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Maths' })).getByRole('link', { name: 'Skill map' }));
    await waitFor(() => expect(address()).toBe('/teacher/c14/maths/skills'));
    await waitFor(() => expect(data.fetchClassMap).toHaveBeenCalledWith('c14'));
  });

  it('switching class keeps the tab, and is remembered for next time', async () => {
    const user = userEvent.setup();
    const { unmount } = show('/teacher/c12/maths/skills');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'c14');
    await waitFor(() => expect(address()).toBe('/teacher/c14/maths/skills'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Room 14' })).toBeInTheDocument();
    unmount();
    show('/teacher');
    await waitFor(() => expect(address()).toBe('/teacher/c14'));
  });

  it('opens the first class instead of one that is not in the list, on the same tab', async () => {
    show('/teacher/gone/games');
    await waitFor(() => expect(address()).toBe('/teacher/c12/games'));
  });
});

describe('the old addresses', () => {
  it.each([
    ['/teacher', '/teacher/c12'],
    ['/classes', '/teacher/c12/setup'],
    ['/focus', '/teacher/c12/maths'],
    ['/focus?class=c14', '/teacher/c14/maths'],
    ['/focus?class=c14&student=s1&skill=facts-10', '/teacher/c14/maths?student=s1&skill=facts-10'],
    ['/skills', '/teacher/c12/maths/skills'],
    ['/skills?class=c14', '/teacher/c14/maths/skills'],
    ['/teacher/c12/nothing-here', '/teacher/c12'],
  ])('%s opens %s', async (from, to) => {
    show(from);
    await waitFor(() => expect(address()).toBe(to));
    expect(await screen.findByRole('navigation', { name: 'Teacher pages' })).toBeInTheDocument();
  });

  it('opens the class this visit last used', async () => {
    sessionStorage.setItem('sgh-teacher-class', 'c14');
    show('/classes');
    await waitFor(() => expect(address()).toBe('/teacher/c14/setup'));
  });
});

describe('Today', () => {
  it('shows Needs you only when someone is waiting', async () => {
    const { unmount } = show('/teacher/c12');
    expect(await screen.findByText('Nothing needs you right now.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Needs you/ })).not.toBeInTheDocument();
    unmount();
    data.fetchWarpRequests.mockResolvedValue([asking('r1', 'c12', 'Room 12', 'Zippy Meerkat 79')]);
    show('/teacher/c12');
    const needs = await screen.findByRole('region', { name: /Needs you/ });
    expect(within(needs).getByRole('button', { name: 'Yes, let Zippy Meerkat 79 in' })).toBeInTheDocument();
    expect(screen.queryByText('Nothing needs you right now.')).not.toBeInTheDocument();
  });

  it('shows the lesson switches with their state, never as red buttons', async () => {
    show('/teacher/c12');
    const controls = await screen.findByRole('region', { name: /Lesson controls/ });
    const friends = within(controls).getByRole('switch', { name: 'Games against friends' });
    await waitFor(() => expect(friends).toHaveAttribute('aria-checked', 'true'));
    await waitFor(() => expect(within(controls).getByRole('switch', { name: 'Emoji reactions' })).toHaveAttribute('aria-checked', 'false'));
    await waitFor(() => expect(within(controls).getByRole('radio', { name: '3 per game' })).toHaveAttribute('aria-checked', 'true'));
    expect(controls.querySelector('.button--danger')).toBeNull();
  });

  it('puts a switch back, and says why, when it cannot be saved', async () => {
    data.setMultiplayer.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    show('/teacher/c12');
    const friends = await screen.findByRole('switch', { name: 'Games against friends' });
    await waitFor(() => expect(friends).toBeEnabled());
    await user.click(friends);
    expect(data.setMultiplayer).toHaveBeenCalledWith(false, 'c12');
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(friends).toHaveAttribute('aria-checked', 'true');
  });

  it('shows this week as counts, with no student names', async () => {
    const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
    const focus: FocusBatch = {
      batch: 'b2', classId: 'c12', className: 'Room 12', scope: 'student',
      targets: [{ id: 's1', name: 'Speedy Otter 27' }, { id: 's2', name: 'Brave Kiwi 7' }],
      skills: ['facts-10'], onlyThese: false, startsAt: new Date().toISOString(), endsAt: inDays(2), createdAt: new Date().toISOString(), status: 'running',
    };
    data.fetchFocuses.mockResolvedValue([focus]);
    data.fetchQuestionSkips.mockResolvedValue({
      students: [
        { id: 's1', name: 'Speedy Otter 27', realName: 'ana', shown: 30, answered: 27, skipped: 3, topSkip: null },
        { id: 's2', name: 'Brave Kiwi 7', realName: 'ben', shown: 10, answered: 9, skipped: 1, topSkip: null },
      ],
      spots: [],
    });
    show('/teacher/c12');
    const week = await screen.findByRole('region', { name: 'This week in Room 12' });
    expect(await within(week).findByText(/Focus \(2 students\)/)).toBeInTheDocument();
    expect(within(week).getByRole('button', { name: 'Extend: 2 students' })).toBeInTheDocument();
    expect(within(week).getByRole('button', { name: 'End: 2 students' })).toBeInTheDocument();
    await waitFor(() => expect(week).toHaveTextContent('2 of 28 students answered maths questions · 40 questions · 10% skipped'));
    expect(week).not.toHaveTextContent(/Speedy Otter|Brave Kiwi|ana|ben/);
    expect(data.fetchQuestionSkips).toHaveBeenCalledWith('c12', 7);
  });
});
