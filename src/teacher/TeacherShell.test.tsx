import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { ClassSummary} from '../data/classes';

const data = vi.hoisted(() => ({
  fetchClasses: vi.fn(),
  fetchWarpRequests: vi.fn(),
  fetchMultiplayerEnabled: vi.fn(),
  setMultiplayer: vi.fn(),
  fetchReactionsEnabled: vi.fn(),
  fetchSkipMode: vi.fn(),
  saveSkipMode: vi.fn(),
  fetchTrainingFirst: vi.fn(),
  saveTrainingFirst: vi.fn(),
  fetchFocuses: vi.fn(),
  fetchQuestionSkips: vi.fn(),
  fetchClassMap: vi.fn(),
  fetchAdminOverview: vi.fn(),
}));
vi.mock('../data/admin', async (original) => ({
  ...(await original<typeof import('../data/admin')>()),
  fetchAdminOverview: data.fetchAdminOverview,
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
vi.mock('../data/questionSkips', async (original) => ({
  ...(await original<typeof import('../data/questionSkips')>()),
  fetchSkipMode: data.fetchSkipMode,
  saveSkipMode: data.saveSkipMode,
}));
vi.mock('../data/trainingGate', async (original) => ({
  ...(await original<typeof import('../data/trainingGate')>()),
  fetchTrainingFirst: data.fetchTrainingFirst,
  saveTrainingFirst: data.saveTrainingFirst,
}));
vi.mock('../data/focus', async (original) => ({ ...(await original<typeof import('../data/focus')>()), fetchFocuses: data.fetchFocuses }));
vi.mock('../data/questionLog', async (original) => ({
  ...(await original<typeof import('../data/questionLog')>()),
  fetchQuestionSkips: data.fetchQuestionSkips,
}));
vi.mock('../data/skillMap', async (original) => ({ ...(await original<typeof import('../data/skillMap')>()), fetchClassMap: data.fetchClassMap }));

const room = (id: string, name: string, over: Partial<ClassSummary> = {}): ClassSummary => ({
  id, name, school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'ask', members: 28, teaching: true, groups: 0, waiting: 0, ...over,
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
  data.saveSkipMode.mockResolvedValue(undefined);
  data.fetchTrainingFirst.mockResolvedValue(false);
  data.saveTrainingFirst.mockResolvedValue(undefined);
  data.fetchFocuses.mockResolvedValue([]);
  data.fetchQuestionSkips.mockResolvedValue({ students: [], spots: [] });
  data.fetchAdminOverview.mockResolvedValue({
    counts: { classes: 2, students: 53, teachers: 3, admins: 1, activeWeek: 40, shownWeek: 100, skippedWeek: 10 },
    noClass: 0, classesNoTeacher: [], oldWarp: 0,
  });
  data.fetchClassMap.mockResolvedValue({ classId: 'c14', className: 'Room 14', yearLevel: 5, auto: true, students: [] });
});

describe('the teacher header', () => {

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
    await waitFor(() => expect(address()).toBe('/teacher/c14/maths'));
    await user.click(within(await screen.findByRole('navigation', { name: 'Maths' })).getByRole('link', { name: 'Skill map' }));
    // The Skill map loads its code on first use; on a busy test machine that can take more than a second.
    await waitFor(() => expect(address()).toBe('/teacher/c14/maths/skills'), { timeout: 5000 });
    await waitFor(() => expect(data.fetchClassMap).toHaveBeenCalledWith('c14'));
  });

});


describe('Today', () => {

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

  it('switches Training before games for this class, and says what it does behind the "?"', async () => {
    const user = userEvent.setup();
    show('/teacher/c12');
    const training = await screen.findByRole('switch', { name: 'Training before games' });
    await waitFor(() => expect(training).toHaveAttribute('aria-checked', 'false'));
    expect(data.fetchTrainingFirst).toHaveBeenCalledWith('c12');
    await user.click(screen.getByRole('button', { name: 'About Training before games' }));
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText(/stay open for 2 hours/)).toBeVisible();
    await user.click(training);
    expect(data.saveTrainingFirst).toHaveBeenCalledWith(true, 'c12');
    expect(training).toHaveAttribute('aria-checked', 'true');
    await user.click(training);
    expect(data.saveTrainingFirst).toHaveBeenLastCalledWith(false, 'c12');
  });

});
