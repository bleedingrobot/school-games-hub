import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teacherRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { ClassSummary } from '../data/classes';
import type { Person } from '../data/teacher';

const data = vi.hoisted(() => ({
  fetchClasses: vi.fn(),
  moveStudent: vi.fn(),
  fetchClassOverview: vi.fn(),
  fetchStudentCard: vi.fn(),
  fetchPeople: vi.fn(),
  fetchPersonDetail: vi.fn(),
  deletePerson: vi.fn(),
  fetchStudentLadder: vi.fn(),
  /** Each game's own student panel, and its one-line summary (see the registry mock below). */
  panelShown: vi.fn(),
  summary: vi.fn(),
}));
vi.mock('../data/classes', async (original) => ({
  ...(await original<typeof import('../data/classes')>()),
  fetchClasses: data.fetchClasses,
  fetchWarpRequests: vi.fn(async () => []),
  moveStudent: data.moveStudent,
}));
vi.mock('../data/classOverview', async (original) => ({
  ...(await original<typeof import('../data/classOverview')>()),
  fetchClassOverview: data.fetchClassOverview,
  fetchStudentCard: data.fetchStudentCard,
}));
vi.mock('../data/teacher', async (original) => ({
  ...(await original<typeof import('../data/teacher')>()),
  fetchPeople: data.fetchPeople,
  fetchPersonDetail: data.fetchPersonDetail,
  deletePerson: data.deletePerson,
}));
vi.mock('../data/skillMap', async (original) => ({
  ...(await original<typeof import('../data/skillMap')>()),
  fetchStudentLadder: data.fetchStudentLadder,
}));
// The games with a student panel get a stand-in panel and summary, so a test can see when each one is asked for. No game's
// season resets here: they belong to other tests.
vi.mock('../games/registry', async (original) => {
  const real = await original<typeof import('../games/registry')>();
  const { createElement } = await import('react');
  return {
    ...real,
    ALL_GAMES: real.ALL_GAMES.map((game) => ({
      ...game,
      SeasonPanels: undefined,
      ...(game.teacher?.StudentPanel && {
        teacher: {
          ...game.teacher,
          StudentPanel: ({ student }: { student: string }) => {
            data.panelShown(game.id, student);
            return createElement('p', null, `${game.name} panel for ${student}`);
          },
          studentSummary: (student: string) => data.summary(game.id, student),
        },
      }),
    })),
  };
});

const room = (id: string, name: string): ClassSummary => ({
  id, name, school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on', members: 3, teaching: true, groups: 0, waiting: 0,
});
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Room 12: Brave Kiwi 7 was on today, Lucky Tui 12 three days ago, Calm Fox 9 never. */
const room12 = [
  {
    id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', lastActive: daysAgo(0), shown: 20, skipped: 2,
    focus: { source: 'teacher-class', skills: ['facts-10'], ladder: { on: true, placed: 'done', placement: 'tables-6-9', furthest: 'tables-6-9' } },
  },
  {
    id: 's2', name: 'Lucky Tui 12', realName: 'tom.brown', hidden: true, lastActive: daysAgo(3), shown: 0, skipped: 0,
    focus: { source: 'student', skills: ['facts-10'], ladder: { on: true, placed: 'skipped' } },
  },
  { id: 's3', name: 'Calm Fox 9', lastActive: null, shown: 5, skipped: 5, focus: { source: 'auto', ladder: { on: false } } },
];
const room14 = [{ id: 's9', name: 'Zippy Meerkat 79', realName: 'zara.lee', shown: 1 }];

const kiwiCard = {
  id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', role: 'student', hidden: false, classes: [{ id: 'c12', name: 'Room 12' }],
  focus: room12[0].focus, week: { shown: 20, skipped: 2 },
};

const people: Person[] = [
  { id: 't1', display_name: 'Wise Owl 1', real_name: 'mr.owl', avatar: {}, role: 'teacher', hidden: false, bot_games: 0, friend_games: 0, points: 0, last_played: null, joined: '2026-10-01T00:00:00Z' },
  { id: 's9', display_name: 'Zippy Meerkat 79', real_name: 'zara.lee', avatar: {}, role: 'student', hidden: false, bot_games: 2, friend_games: 1, points: 9, last_played: null, joined: '2026-10-01T00:00:00Z' },
];

const teacher: AuthState = {
  status: 'signed-in',
  profile: { id: 't1', display_name: 'Wise Owl 1', avatar: {}, role: 'teacher' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};
const admin: AuthState = { ...teacher, profile: { id: 't9', display_name: 'Calm Fox 2', avatar: {}, role: 'teacher', school_admin: true } };

/** Where the router is now, so a test can see the address after a click. */
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
const roster = (name = 'Room 12') => screen.findByRole('table', { name: new RegExp(`^Students in ${name}`) });
/** The student names down the roster, in order. */
const order = (table: HTMLElement) => within(table).getAllByRole('rowheader').map((h) => h.textContent?.replace('Hidden', ''));
const cells = (table: HTMLElement, name: string) =>
  within(within(table).getByRole('row', { name: new RegExp(name) })).getAllByRole('cell').map((c) => c.textContent);
const header = (table: HTMLElement, name: string) => within(table).getByRole('columnheader', { name });

beforeEach(async () => {
  sessionStorage.clear();
  for (const fn of Object.values(data)) fn.mockReset();
  const { parseOverview, parseStudentCard } = await vi.importActual<typeof import('../data/classOverview')>('../data/classOverview');
  data.fetchClasses.mockResolvedValue([room('c12', 'Room 12'), room('c14', 'Room 14')]);
  data.fetchClassOverview.mockImplementation(async (id: string) => parseOverview({ students: id === 'c12' ? room12 : room14 }));
  data.fetchStudentCard.mockImplementation(async (id: string) => parseStudentCard(id === 's1' ? kiwiCard : { id, name: 'Zippy Meerkat 79', role: 'student', classes: [{ id: 'c14', name: 'Room 14' }] })!);
  data.fetchPeople.mockResolvedValue(people);
  data.fetchPersonDetail.mockResolvedValue({ points: 50, level: 2, games: [], recent: [] });
  data.deletePerson.mockResolvedValue(undefined);
  data.moveStudent.mockResolvedValue(undefined);
  data.fetchStudentLadder.mockResolvedValue({ on: true, placed: 'done', placement: 'tables-6-9', furthest: 'tables-6-9' });
  // Maths Monsters hasn't been played; every other game has.
  data.summary.mockImplementation(async (game: string) => (game === 'monsters' ? null : `${game} so far`));
});

describe('the class roster', () => {
  it('shows only the class’s students, with their questions, skips, ladder and focus', async () => {
    show('/teacher/c12/students');
    const table = await roster();
    expect(data.fetchClassOverview).toHaveBeenCalledWith('c12');
    expect(data.fetchClassOverview).not.toHaveBeenCalledWith('c14');
    expect(order(table)).toEqual(['Brave Kiwi 7', 'Calm Fox 9', 'Lucky Tui 12']);
    expect(screen.queryByText('Zippy Meerkat 79')).not.toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.replace(/[▲▼]/g, '').trim())).toEqual([
      'Student', 'Real name', 'Last active', 'Questions (7 days)', 'Skipped', 'Ladder', 'Focus',
    ]);
    expect(cells(table, 'Brave Kiwi 7')).toEqual(['jane.smith', 'Today', '20', '10%', '×6, ×9', 'Class: Number facts to 10']);
    expect(cells(table, 'Calm Fox 9')).toEqual(['–', 'Not yet', '5', '100%', 'No warm-up yet', 'None']);
    const tui = cells(table, 'Lucky Tui 12');
    expect(tui.slice(2)).toEqual(['0', '–', 'Warm-up skipped', 'Own: Number facts to 10']);
    expect(within(table).getByRole('row', { name: /Lucky Tui 12/ })).toHaveTextContent('Hidden');
    expect(within(table).getByRole('link', { name: /Brave Kiwi 7/ })).toHaveAttribute('href', '/teacher/c12/students/s1');
    expect(screen.getByRole('button', { name: 'Room 12' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sorts by a column, flipping the way on a second click, and keeps it in the address', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/students');
    const table = await roster();
    expect(header(table, 'Student')).toHaveAttribute('aria-sort', 'ascending');
    await user.click(within(table).getByRole('button', { name: 'Questions (7 days)' }));
    // Numbers start with the biggest.
    expect(header(table, 'Questions (7 days)')).toHaveAttribute('aria-sort', 'descending');
    expect(header(table, 'Student')).not.toHaveAttribute('aria-sort');
    expect(order(table)).toEqual(['Brave Kiwi 7', 'Calm Fox 9', 'Lucky Tui 12']);
    expect(address()).toBe('/teacher/c12/students?sort=shown&way=down');
    await user.click(within(table).getByRole('button', { name: 'Questions (7 days)' }));
    expect(header(table, 'Questions (7 days)')).toHaveAttribute('aria-sort', 'ascending');
    expect(order(table)).toEqual(['Lucky Tui 12', 'Calm Fox 9', 'Brave Kiwi 7']);
    expect(address()).toBe('/teacher/c12/students?sort=shown&way=up');
    await user.click(within(table).getByRole('button', { name: 'Student' }));
    expect(header(table, 'Student')).toHaveAttribute('aria-sort', 'ascending');
    await user.click(within(table).getByRole('button', { name: 'Student' }));
    expect(header(table, 'Student')).toHaveAttribute('aria-sort', 'descending');
    expect(order(table)).toEqual(['Lucky Tui 12', 'Calm Fox 9', 'Brave Kiwi 7']);
  });

  it('puts the least recently active first for ?sort=quiet', async () => {
    show('/teacher/c12/students?sort=quiet');
    const table = await roster();
    expect(order(table)).toEqual(['Calm Fox 9', 'Lucky Tui 12', 'Brave Kiwi 7']);
    expect(header(table, 'Last active')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('hides real names, and remembers it for this teacher', async () => {
    const user = userEvent.setup();
    const { unmount } = show('/teacher/c12/students');
    const table = await roster();
    await user.click(screen.getByRole('checkbox', { name: 'Hide real names' }));
    expect(within(table).queryByRole('columnheader', { name: 'Real name' })).not.toBeInTheDocument();
    expect(screen.queryByText('jane.smith')).not.toBeInTheDocument();
    // A hidden real name can't be searched for either.
    await user.type(screen.getByLabelText('Find a student'), 'smith');
    expect(screen.getByText('No students match.')).toBeInTheDocument();
    unmount();
    show('/teacher/c12/students');
    const again = await roster();
    expect(screen.getByRole('checkbox', { name: 'Hide real names' })).toBeChecked();
    expect(within(again).queryByRole('columnheader', { name: 'Real name' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Hide real names' }));
    expect(await within(again).findByRole('columnheader', { name: 'Real name' })).toBeInTheDocument();
    expect(localStorage.getItem('sgh-hide-real-names:t1')).toBeNull();
  });

  it('switches to the old list of all my students, and back', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/students');
    await roster();
    expect(data.fetchPeople).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'All my students' }));
    expect(screen.getByRole('button', { name: 'All my students' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Room 12' })).toHaveAttribute('aria-pressed', 'false');
    expect(address()).toBe('/teacher/c12/students?show=all');
    const zippy = await screen.findByRole('link', { name: /Zippy Meerkat 79/ });
    expect(zippy).toHaveAttribute('href', '/teacher/c12/students/s9');
    expect(zippy).toHaveTextContent('3 games');
    expect(screen.getByRole('link', { name: /Wise Owl 1/ })).toHaveTextContent('You');
    expect(screen.queryByRole('table', { name: /^Students in/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Find a player'), 'zara');
    expect(screen.queryByRole('link', { name: /Wise Owl 1/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Room 12' }));
    expect(await roster()).toBeInTheDocument();
    expect(address()).toBe('/teacher/c12/students');
  });

  it('calls it Whole school for a school admin', async () => {
    show('/teacher/c12/students?show=all', admin);
    expect(await screen.findByRole('heading', { name: /^Whole school/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Whole school' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('a student’s page', () => {
  async function openKiwi() {
    const user = userEvent.setup();
    show('/teacher/c12/students');
    await user.click(within(await roster()).getByRole('link', { name: /Brave Kiwi 7/ }));
    await screen.findByText('Level 2 · 50 points');
    expect(address()).toBe('/teacher/c12/students/s1');
    return user;
  }

  it('shows the student’s maths in the overview', async () => {
    await openKiwi();
    expect(screen.getByRole('heading', { level: 2, name: 'Brave Kiwi 7' })).toBeInTheDocument();
    const overview = screen.getByRole('region', { name: 'Overview' });
    expect(overview).toHaveTextContent('Ladder×6, ×9');
    expect(overview).toHaveTextContent('FocusClass: Number facts to 10');
    expect(overview).toHaveTextContent('Last 7 days20 questions, 10% skipped');
    expect(data.fetchStudentCard).toHaveBeenCalledWith('s1');
  });

  it('loads a game’s panel only when its line is opened, and lists games not played yet', async () => {
    const user = await openKiwi();
    const games = screen.getByRole('region', { name: 'Games' });
    const line = (await within(games).findByText('gem-keep so far')).closest('summary')!;
    expect(line).toHaveTextContent('Gem Keep');
    expect(data.summary).toHaveBeenCalledWith('gem-keep', 's1');
    expect(await within(games).findByText(/Not played yet: Maths Monsters\./)).toBeInTheDocument();
    expect(within(games).queryByText('Maths Monsters', { selector: '.game-line__name' })).not.toBeInTheDocument();
    expect(data.panelShown).not.toHaveBeenCalled();
    expect(screen.queryByText('Gem Keep panel for s1')).not.toBeInTheDocument();
    await user.click(line);
    expect(await within(games).findByText('Gem Keep panel for s1')).toBeInTheDocument();
    expect(new Set(data.panelShown.mock.calls.map(([game]) => game))).toEqual(new Set(['gem-keep']));
  });

  it('moves a student to another class I teach', async () => {
    const user = await openKiwi();
    const manage = screen.getByRole('region', { name: 'Manage' });
    const select = within(manage).getByRole('combobox', { name: 'Move to another class' });
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Choose a class…', 'Room 14']);
    const move = within(manage).getByRole('button', { name: 'Move' });
    expect(move).toBeDisabled();
    await user.selectOptions(select, 'c14');
    await user.click(move);
    expect(data.moveStudent).toHaveBeenCalledWith('s1', 'c14');
    expect(await within(manage).findByText('Brave Kiwi 7 is now in Room 14.')).toBeInTheDocument();
    // The class sizes in the header are asked for again.
    await waitFor(() => expect(data.fetchClasses).toHaveBeenCalledTimes(2));
  });

  it('goes back to the students list after a delete', async () => {
    const user = await openKiwi();
    const manage = screen.getByRole('region', { name: 'Manage' });
    await user.click(within(manage).getByRole('button', { name: /Delete/ }));
    await user.type(within(manage).getByLabelText('Type their player name to confirm'), 'brave kiwi 7');
    await user.click(within(manage).getByRole('button', { name: 'Delete forever' }));
    expect(data.deletePerson).toHaveBeenCalledWith('s1');
    await waitFor(() => expect(address()).toBe('/teacher/c12/students'));
    expect(await roster()).toBeInTheDocument();
  });

  it('has a link back to the students list', async () => {
    const user = await openKiwi();
    await user.click(screen.getByRole('link', { name: '‹ Students' }));
    expect(address()).toBe('/teacher/c12/students');
    expect(await roster()).toBeInTheDocument();
  });

  it('lands on the new class’s Students list when the class is switched', async () => {
    const user = userEvent.setup();
    show('/teacher/c12/students/s1');
    await screen.findByText('Level 2 · 50 points');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Class' }), 'c14');
    await waitFor(() => expect(address()).toBe('/teacher/c14/students'));
    const table = await roster('Room 14');
    expect(order(table)).toEqual(['Zippy Meerkat 79']);
    expect(data.fetchClassOverview).toHaveBeenLastCalledWith('c14');
  });
});
