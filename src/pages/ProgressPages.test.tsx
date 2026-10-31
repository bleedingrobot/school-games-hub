import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { BoardRow, Rules } from '../data/progress';
import type { Person } from '../data/teacher';
import { SoundProvider } from '../sound';
import { notOnBoardText } from './Leaderboard';

const row = (place: number | null, name: string, extra: Partial<BoardRow> = {}): BoardRow => ({
  place,
  display_name: name,
  avatar: {},
  rank: 'bronze',
  points: 100 - (place ?? 50),
  games: 5,
  is_me: false,
  ...extra,
});

const rules: Rules = {
  bot: { 'very-easy': { lost: 1, drawn: 2, won: 3 }, easy: { lost: 2, drawn: 3, won: 5 }, medium: { lost: 3, drawn: 5, won: 8 } },
  friend: { lost: 4, drawn: 6, won: 8 },
  space: { bot: 2, friend: 4, friendDailyGames: 6, minTurns: 5 },
  card101: { friendLost: 4, friendWon: 8, friendDailyGames: 6, minRounds: 2 },
  botDailyCap: 40,
  pairDailyLimit: 5,
  achievementPoints: 10,
  levels: [0, 50, 125, 225, 350, 500, 675, 875, 1100, 1350],
  ratingK: 20,
  weeklyMinGames: 3,
  allTimeMinGames: 5,
  improvedMinGames: 3,
  championMinGames: 15,
};

vi.mock('../data/progress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/progress')>()),
  fetchLeaderboard: vi.fn(),
  fetchRules: vi.fn(async () => rules),
  fetchMyProgress: vi.fn(async () => ({
    points: 60,
    level: 2,
    levelStart: 50,
    nextLevelAt: 125,
    weekPoints: 60,
    games: [
      { game: 'checkers', rank: { rank: 'gold', next: 'champion', progress: 1, gamesNeeded: 4, ratedGames: 11 }, weekRatingChange: 30 },
      { game: 'chess', rank: { rank: 'bronze', next: 'silver', progress: 0.5, gamesNeeded: null, ratedGames: 3 }, weekRatingChange: 5 },
    ],
    achievements: [
      { id: 'chess-first-win', game: 'chess', name: 'First win', emoji: '🏆', measure: 'wins', goal: 1, progress: 1, earnedAt: '2026-10-14T01:00:00Z' },
      { id: 'checkers-first-win', game: 'checkers', name: 'First win', emoji: '🏆', measure: 'wins', goal: 1, progress: 0, earnedAt: null },
    ],
    recent: [],
  })),
}));

// The profile takes its points and achievements from the home page's one request: made here from the answer above.
vi.mock('../data/homePage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/homePage')>()),
  fetchMyHomePage: vi.fn(async () => ({
    progress: await (await import('../data/progress')).fetchMyProgress(),
    botRecent: [], botStats: [], friendRecent: [], friendStats: [], friendOpen: [], players: new Map(),
    spaceRecent: [], spaceOpen: [], spaceStats: null, cardRecent: [], cardOpen: [], cardStats: null,
    powerRecent: [], powerOpen: [], powerStats: null, moves: {}, parts: {},
  })),
}));

const people: Person[] = [
  { id: 't1', display_name: 'Wise Owl 1', real_name: 'mr.owl', avatar: {}, role: 'teacher', hidden: false, bot_games: 0, friend_games: 0, points: 0, last_played: null, joined: '2026-10-01T00:00:00Z' },
  { id: 's1', display_name: 'Brave Kiwi 7', real_name: 'jane.smith', avatar: {}, role: 'student', hidden: false, bot_games: 4, friend_games: 2, points: 50, last_played: new Date().toISOString(), joined: '2026-10-01T00:00:00Z' },
  { id: 's2', display_name: 'Lucky Tui 12', real_name: 'tom.brown', avatar: {}, role: 'student', hidden: true, bot_games: 1, friend_games: 0, points: 3, last_played: null, joined: '2026-10-01T00:00:00Z' },
];

vi.mock('../data/teacher', () => ({
  fetchPeople: vi.fn(async () => people),
  fetchPersonDetail: vi.fn(async () => ({
    points: 50,
    level: 2,
    games: [
      { game: 'checkers', bot: { played: 0, won: 0, lost: 0, drawn: 0, left: 0 }, friend: { played: 2, won: 1, lost: 1, drawn: 0, left: 1 }, rank: 'silver', achievements: 3 },
      { game: 'chess', bot: { played: 4, won: 2, lost: 1, drawn: 1, left: 0 }, friend: { played: 0, won: 0, lost: 0, drawn: 0, left: 0 }, rank: 'bronze', achievements: 2 },
      { game: 'space', bot: { played: 3, won: 1, lost: 2, drawn: 0, left: 1 }, friend: { played: 0, won: 0, lost: 0, drawn: 0, left: 0 }, rank: null, achievements: 1 },
    ],
    recent: [
      { game: 'space', kind: 'bot', against: 'easy', result: 'lost', reason: 'docked', place: 3, finished_at: new Date().toISOString() },
      { game: 'checkers', kind: 'friend', against: 'Lucky Tui 12', result: 'won', reason: 'no-pieces', finished_at: new Date().toISOString() },
      { game: 'chess', kind: 'bot', against: 'medium', result: 'lost', reason: 'abandoned', finished_at: new Date().toISOString() },
    ],
  })),
  renamePerson: vi.fn(async () => 'Happy Moose 3'),
  setHidden: vi.fn(async () => {}),
  setRole: vi.fn(async () => {}),
  deletePerson: vi.fn(async () => {}),
  setMultiplayer: vi.fn(async () => {}),
  startNewSeason: vi.fn(async () => ({ botGames: 120, friendGames: 30, gemKeepLevels: 12 })),
}));

// The class roster and the top of a student's page (src/teacher/Students.tsx, src/teacher/StudentPage.tsx).
const ladder = { on: true, placed: 'done', placement: 'tables-6-9', furthest: 'tables-6-9' };
const cards: Record<string, unknown> = {
  s1: { id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', role: 'student', hidden: false, classes: [{ id: 'c12', name: 'Room 12' }], focus: { source: 'auto', ladder }, week: { shown: 20, skipped: 2 } },
  s2: { id: 's2', name: 'Lucky Tui 12', realName: 'tom.brown', role: 'student', hidden: true, classes: [{ id: 'c12', name: 'Room 12' }], week: {} },
  t1: { id: 't1', name: 'Wise Owl 1', realName: 'mr.owl', role: 'teacher', hidden: false, classes: [] },
};
vi.mock('../data/classOverview', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/classOverview')>();
  return {
    ...real,
    fetchClassOverview: vi.fn(async () =>
      real.parseOverview({
        students: [
          { id: 's1', name: 'Brave Kiwi 7', realName: 'jane.smith', games: 6, points: 50, lastActive: new Date().toISOString(), shown: 20, skipped: 2, focus: { source: 'auto', ladder } },
          { id: 's2', name: 'Lucky Tui 12', realName: 'tom.brown', hidden: true, games: 1, points: 3 },
        ],
      }),
    ),
    fetchStudentCard: vi.fn(async (id: string) => real.parseStudentCard(cards[id])!),
  };
});

vi.mock('../data/gemKeep', () => ({
  fetchStarsBoard: vi.fn(async () => [
    { place: 1, display_name: 'Speedy Fox 2', avatar: {}, stars: 21, level_keys: 7, is_me: false },
    { place: 2, display_name: 'Brave Kiwi 7', avatar: {}, stars: 9, level_keys: 3, is_me: true },
  ]),
  fetchGemKeepSettings: vi.fn(async () => ({
    mode: 'calm', enabledTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], division: false, multipleChoice: false, keyPassMark: 8,
  })),
  saveGemKeepSettings: vi.fn(async () => {}),
  fetchClassGemKeep: vi.fn(async () => ({
    players: 14,
    levels: [{ levelId: 'level-1', won: 14, keys: 12 }],
    hardest: [{ key: 'mul:7x8', students: 9, attempts: 40, correct: 22 }],
  })),
  fetchStudentGemKeep: vi.fn(async () => ({
    levels: [{ levelId: 'level-1', stars: 3, keyPassed: true, plays: 2, wins: 2 }],
    facts: [
      { key: 'mul:7x8', attempts: 5, correct: 2, avgMs: 4000, box: 1, lastSeen: 0, quickDays: [] },
      { key: 'mul:2x5', attempts: 6, correct: 6, avgMs: 1500, box: 4, lastSeen: 0, quickDays: ['2026-10-16', '2026-10-17'] },
    ],
    lastPlayed: null,
  })),
}));

vi.mock('../data/skillMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/skillMap')>()),
  fetchStudentLadder: vi.fn(async () => ({ on: true, yearLevel: 5, placed: 'done', placement: 'tables-6-9', furthest: 'tables-6-9' })),
  resetPlacement: vi.fn(async () => true),
}));

// The teacher pages open on a class (src/teacher/TeacherShell.tsx).
vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  fetchClasses: vi.fn(async () => [
    { id: 'c12', name: 'Room 12', school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on', members: 2, teaching: true, groups: 0, waiting: 0 },
  ]),
  fetchWarpRequests: vi.fn(async () => []),
}));

vi.mock('../data/multiplayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/multiplayer')>()),
  fetchMultiplayerEnabled: vi.fn(async () => true),
}));

const student: AuthState = {
  status: 'signed-in',
  profile: { id: 's1', display_name: 'Brave Kiwi 7', avatar: {}, role: 'student' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};
const teacher: AuthState = { ...student, profile: { id: 't1', display_name: 'Wise Owl 1', avatar: {}, role: 'teacher', school_admin: true } };
/** A teacher who isn't a school admin: they can't make teachers or start a new season. */
const plainTeacher: AuthState = { ...student, profile: { id: 't2', display_name: 'Calm Fox 2', avatar: {}, role: 'teacher' } };

function renderAt(path: string, auth: AuthState = student) {
  return render(
    <SoundProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('leaderboard', () => {
  it('shows the top 10, then my own place further down', async () => {
    const { fetchLeaderboard } = await import('../data/progress');
    const top = Array.from({ length: 10 }, (_, i) => row(i + 1, `Player ${i + 1}`, { rank: i === 0 ? 'gold' : 'bronze' }));
    vi.mocked(fetchLeaderboard).mockResolvedValue([...top, row(14, 'Brave Kiwi 7', { is_me: true, points: 12 })]);
    renderAt('/leaderboard');

    const list = await screen.findByRole('list', { name: 'This week leaderboard' });
    const lines = within(list).getAllByRole('listitem').filter((li) => !li.classList.contains('board-list__gap'));
    expect(lines).toHaveLength(11);
    expect(lines[0]).toHaveTextContent('Player 1');
    expect(lines[0]).toHaveTextContent('Gold');
    expect(within(lines[0]).getByLabelText('Place 1')).toHaveTextContent('🥇');
    expect(lines[10]).toHaveTextContent('Brave Kiwi 7 (you)');
    expect(lines[10]).toHaveTextContent('12 pts');
    expect(within(lines[10]).getByLabelText('Place 14')).toBeInTheDocument();
    expect(lines[10]).toHaveClass('is-me');
    expect(fetchLeaderboard).toHaveBeenCalledWith('chess', 'week');
  });

  it('switches game and board, and shows badges but no numbers on the all-time board', async () => {
    const { fetchLeaderboard } = await import('../data/progress');
    vi.mocked(fetchLeaderboard).mockResolvedValue([row(1, 'Speedy Fox 2', { rank: 'champion', points: null })]);
    const user = userEvent.setup();
    renderAt('/leaderboard');
    await user.click(screen.getByRole('radio', { name: 'Checkers' }));
    await user.click(screen.getByRole('radio', { name: 'All time' }));
    expect(fetchLeaderboard).toHaveBeenLastCalledWith('checkers', 'all-time');
    const list = await screen.findByRole('list', { name: 'All time leaderboard' });
    expect(list).toHaveTextContent('Champion');
    expect(list).not.toHaveTextContent('pts');
  });

  it('tells me how to get on a board I’m not on yet', async () => {
    const { fetchLeaderboard } = await import('../data/progress');
    vi.mocked(fetchLeaderboard).mockResolvedValue([row(1, 'Speedy Fox 2'), row(null, 'Brave Kiwi 7', { is_me: true, games: 1 })]);
    renderAt('/leaderboard');
    expect(await screen.findByText('You’re not on this board yet. Play 2 more games this week to join it!')).toBeInTheDocument();
  });

  it('says when a board is empty, or can’t be loaded', async () => {
    const { fetchLeaderboard } = await import('../data/progress');
    vi.mocked(fetchLeaderboard).mockResolvedValueOnce([]);
    renderAt('/leaderboard');
    expect(await screen.findByText('Nobody is on this board yet. It could be you!')).toBeInTheDocument();
  });

  it('words the "not on the board yet" message for each board', () => {
    expect(notOnBoardText('week', 2)).toBe('You’re not on this board yet. Play 1 more game this week to join it!');
    expect(notOnBoardText('all-time', 0)).toBe('You’re not on this board yet. Play 5 more games against friends to join it!');
    expect(notOnBoardText('improved', 4)).toMatch(/win a few more games against friends/);
  });
});

describe('how points work', () => {
  it('explains the points with the real numbers', async () => {
    renderAt('/points');
    const table = await screen.findByRole('table', { name: 'Points for each game' });
    expect(within(within(table).getByRole('row', { name: /Medium bot/ })).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '3',
      '5',
      '8',
    ]);
    expect(within(within(table).getByRole('row', { name: /A friend/ })).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '4',
      '6',
      '8',
    ]);
    expect(screen.getByText('40 points a day')).toBeInTheDocument();
    expect(screen.getByText('5 games together each day')).toBeInTheDocument();
    expect(screen.getByText('10 bonus points')).toBeInTheDocument();
    expect(screen.getByText('Level 2').parentElement).toHaveTextContent('50 points');
    expect(screen.getByText(/Only games against friends change it. Bot games never do./)).toBeInTheDocument();
    const space = screen.getByRole('region', { name: /Wormholes & Black Holes/ });
    expect(space).toHaveTextContent('Against bots: 2 points for each game you finish');
    expect(space).toHaveTextContent('Your first 6 games each day earn points');
    expect(space).toHaveTextContent('at least 5 turns');
    const card101 = screen.getByRole('region', { name: /101/ });
    expect(card101).toHaveTextContent('same points as chess and checkers');
    expect(card101).toHaveTextContent('8 points for a win and 4 points for finishing');
    expect(card101).toHaveTextContent('at least 2 full rounds');
  });
});

describe('profile progress', () => {
  it('shows points, level, badges with how far to the next one, and every achievement', async () => {
    renderAt('/profile');
    const panel = await screen.findByRole('region', { name: 'My progress' });
    expect(panel).toHaveTextContent('60 points · 60 this week');
    expect(within(panel).getByText('Level 2')).toBeInTheDocument();
    expect(within(panel).getByText('Play 4 more rated games for Champion')).toBeInTheDocument();
    expect(within(panel).getByText('Halfway to Silver')).toBeInTheDocument();
    const achievements = screen.getByRole('region', { name: /My achievements/ });
    expect(achievements).toHaveTextContent('1 of 2');
    expect(within(achievements).getByRole('heading', { name: 'Chess' })).toBeInTheDocument();
  });
});

describe('teacher view', () => {
  it('is only shown to teachers', async () => {
    renderAt('/teacher');
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Teacher/ })).not.toBeInTheDocument();
    const { fetchPeople } = await import('../data/teacher');
    expect(fetchPeople).not.toHaveBeenCalled();
  });

  const roster = () => screen.findByRole('table', { name: /^Students in Room 12/ });

  it('lists the class with real names and who is hidden, everyone else under Whole school, and a link in the top bar', async () => {
    const user = userEvent.setup();
    renderAt('/teacher/c12/students', teacher);
    expect(screen.getByRole('link', { name: /Teacher/ })).toHaveAttribute('href', '/teacher');
    const table = await roster();
    expect(within(table).getByRole('row', { name: /Brave Kiwi 7/ })).toHaveTextContent('jane.smith');
    expect(within(table).getByRole('row', { name: /Lucky Tui 12/ })).toHaveTextContent('Hidden');
    expect(within(table).getByRole('link', { name: /Brave Kiwi 7/ })).toHaveAttribute('href', '/teacher/c12/students/s1');
    await user.click(screen.getByRole('button', { name: 'Whole school' }));
    const kiwi = (await screen.findByText('Brave Kiwi 7')).closest('li')!;
    expect(kiwi).toHaveTextContent('6 games');
    expect(kiwi).toHaveTextContent('jane.smith');
    expect(kiwi).toHaveTextContent('Last played today');
    expect(screen.getByText('Lucky Tui 12').closest('li')).toHaveTextContent('Hidden');
    expect(screen.getByText('Wise Owl 1').closest('li')).toHaveTextContent('You');
  });

  it('filters the list by name', async () => {
    const user = userEvent.setup();
    renderAt('/teacher/c12/students', teacher);
    const table = await roster();
    await user.type(screen.getByLabelText('Find a student'), 'tui');
    expect(within(table).queryByText('Brave Kiwi 7')).not.toBeInTheDocument();
    expect(within(table).getByText('Lucky Tui 12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Whole school' }));
    await screen.findByText('Wise Owl 1');
    await user.type(screen.getByLabelText('Find a player'), 'owl');
    expect(screen.queryByText('Brave Kiwi 7')).not.toBeInTheDocument();
    expect(screen.getByText('Wise Owl 1')).toBeInTheDocument();
  });

  it('filters the list by real name too', async () => {
    const user = userEvent.setup();
    renderAt('/teacher/c12/students', teacher);
    const table = await roster();
    await user.type(screen.getByLabelText('Find a student'), 'smith');
    expect(within(table).getByText('Brave Kiwi 7')).toBeInTheDocument();
    expect(within(table).queryByText('Lucky Tui 12')).not.toBeInTheDocument();
  });

  /** From the class roster to a student's page. */
  async function openStudent(name: RegExp, auth: AuthState = teacher) {
    const user = userEvent.setup();
    renderAt('/teacher/c12/students', auth);
    await user.click(within(await roster()).getByRole('link', { name }));
    await screen.findByText('Level 2 · 50 points');
    return { user, manage: screen.getByRole('region', { name: 'Manage' }) };
  }
  const openKiwi = () => openStudent(/Brave Kiwi 7/);

  it('shows a student’s stats and recent games', async () => {
    await openKiwi();
    expect(screen.getByRole('heading', { level: 2, name: 'Brave Kiwi 7' })).toBeInTheDocument();
    expect(screen.getByText('jane.smith')).toBeInTheDocument();
    const games = screen.getByRole('region', { name: 'Games' });
    const table = within(games).getByRole('table', { name: 'Against bots and friends' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(within(games).getByText(/Wormholes & Black Holes: 1 achievement/)).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Recent games' });
    expect(within(recent).getByText(/Checkers vs Lucky Tui 12/)).toBeInTheDocument();
    expect(within(recent).getByText(/Wormholes & Black Holes vs Pilot bots/).closest('li')).toHaveTextContent('3rd');
    expect(within(recent).getByText(/Chess vs Medium bot/).closest('li')).toHaveTextContent('(left early)');
  });

  it('gives a new name after a confirm step', async () => {
    const { renamePerson } = await import('../data/teacher');
    const { user, manage } = await openKiwi();
    await user.click(within(manage).getByRole('button', { name: /New name/ }));
    expect(renamePerson).not.toHaveBeenCalled();
    await user.click(within(manage).getByRole('button', { name: 'Yes, new name' }));
    expect(renamePerson).toHaveBeenCalledWith('s1');
    expect(await within(manage).findByText('Brave Kiwi 7 is now Happy Moose 3.')).toBeInTheDocument();
  });

  it('hides a student', async () => {
    const { setHidden } = await import('../data/teacher');
    const { user, manage } = await openKiwi();
    await user.click(within(manage).getByRole('button', { name: /Hide/ }));
    expect(setHidden).toHaveBeenCalledWith('s1', true);
  });

  it('shows where a student\'s maths warm-up stands, and offers it again only after a confirm step', async () => {
    const { resetPlacement } = await import('../data/skillMap');
    await openKiwi();
    const user = userEvent.setup();
    const overview = screen.getByRole('region', { name: 'Overview' });
    expect(await within(overview).findByText(/warm-up done, started at ×6, ×9/)).toBeInTheDocument();
    await user.click(within(overview).getByRole('button', { name: 'Offer the warm-up again' }));
    expect(resetPlacement).not.toHaveBeenCalled();
    await user.click(within(overview).getByRole('button', { name: 'Yes, offer it again' }));
    expect(resetPlacement).toHaveBeenCalledWith('s1');
    expect(await within(overview).findByText(/will be offered the warm-up again/)).toBeInTheDocument();
  });

  it('makes someone a teacher only after a warning', async () => {
    const { setRole } = await import('../data/teacher');
    const { user, manage } = await openKiwi();
    await user.click(within(manage).getByRole('button', { name: /Make teacher/ }));
    expect(within(manage).getByText(/Only do this for staff/)).toBeInTheDocument();
    await user.click(within(manage).getByRole('button', { name: 'Cancel' }));
    expect(setRole).not.toHaveBeenCalled();
    await user.click(within(manage).getByRole('button', { name: /Make teacher/ }));
    await user.click(within(manage).getByRole('button', { name: 'Yes, make teacher' }));
    expect(setRole).toHaveBeenCalledWith('s1', 'teacher');
  });

  it('shows a plain teacher no way to make teachers or start a new season (only a school admin does)', async () => {
    const user = userEvent.setup();
    renderAt('/teacher/c12/students', plainTeacher);
    await roster();
    expect(screen.getByRole('button', { name: 'All my students' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'End of year: start a new season' })).not.toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Teacher pages' });
    expect(within(tabs).getByRole('link', { name: 'Class set-up' })).toHaveAttribute('href', '/teacher/c12/setup');
    expect(within(tabs).getByRole('link', { name: 'Maths' })).toHaveAttribute('href', '/teacher/c12/maths');
    expect(within(tabs).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    await user.click(within(await roster()).getByRole('link', { name: /Brave Kiwi 7/ }));
    await screen.findByText('Level 2 · 50 points');
    const manage = screen.getByRole('region', { name: 'Manage' });
    expect(within(manage).queryByRole('button', { name: /Make teacher|Remove teacher/ })).not.toBeInTheDocument();
    expect(within(manage).getByRole('button', { name: /New name/ })).toBeInTheDocument();
  });

  it('can’t change their own role or delete a teacher', async () => {
    const user = userEvent.setup();
    renderAt('/teacher/c12/students', teacher);
    await roster();
    await user.click(screen.getByRole('button', { name: 'Whole school' }));
    await user.click(await screen.findByRole('link', { name: /Wise Owl 1/ }));
    await screen.findByText('Level 2 · 50 points');
    const head = screen.getByRole('heading', { level: 2, name: /Wise Owl 1/ });
    expect(head).toHaveTextContent('You');
    expect(head).toHaveTextContent('Teacher');
    const manage = screen.getByRole('region', { name: 'Manage' });
    expect(within(manage).queryByRole('button', { name: /Make teacher|Remove teacher/ })).not.toBeInTheDocument();
    expect(within(manage).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('deletes a student only after their name is typed, then goes back to the class', async () => {
    const { deletePerson } = await import('../data/teacher');
    const { fetchClassOverview } = await import('../data/classOverview');
    const { user, manage } = await openKiwi();
    expect(fetchClassOverview).toHaveBeenCalledTimes(1);
    await user.click(within(manage).getByRole('button', { name: /Delete/ }));
    const confirm = within(manage).getByRole('group', { name: 'Confirm delete' });
    expect(confirm).toHaveTextContent('It can’t be undone');
    const button = within(confirm).getByRole('button', { name: 'Delete forever' });
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByLabelText('Type their player name to confirm'), 'Brave Kiwi');
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByLabelText('Type their player name to confirm'), ' 7');
    expect(button).toBeEnabled();
    expect(deletePerson).not.toHaveBeenCalled();
    await user.click(button);
    expect(deletePerson).toHaveBeenCalledWith('s1');
    await roster();
    expect(fetchClassOverview).toHaveBeenCalledTimes(2);
  });

  it('pauses games against friends from Today', async () => {
    const { setMultiplayer } = await import('../data/teacher');
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    const toggle = await screen.findByRole('switch', { name: 'Games against friends' }, { timeout: 5000 });
    await vi.waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(setMultiplayer).toHaveBeenCalledWith(false, 'c12');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('points an admin to Admin → End of year for the new points season', async () => {
    const { startNewSeason } = await import('../data/teacher');
    renderAt('/teacher/c12/students', teacher);
    const link = await screen.findByRole('link', { name: /End of year/ });
    expect(link).toHaveAttribute('href', '/teacher/admin/year');
    expect(screen.queryByRole('button', { name: 'Start a new season' })).not.toBeInTheDocument();
    expect(startNewSeason).not.toHaveBeenCalled();
  });

  it('keeps each game’s settings closed, asking the server nothing for them until they are opened', async () => {
    const { fetchGemKeepSettings } = await import('../data/gemKeep');
    const user = userEvent.setup();
    renderAt('/teacher/c12/games', teacher);
    await screen.findByRole('link', { name: 'Gem Keep settings' });
    expect(screen.queryByRole('region', { name: 'Gem Keep settings' })).not.toBeInTheDocument();
    expect(fetchGemKeepSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Gem Keep settings' }));
    expect(await screen.findByRole('region', { name: 'Gem Keep settings' })).toBeInTheDocument();
    await vi.waitFor(() => expect(fetchGemKeepSettings).toHaveBeenCalled());
  });

  it('changes the Gem Keep settings for the class', async () => {
    const { saveGemKeepSettings } = await import('../data/gemKeep');
    const user = userEvent.setup();
    renderAt('/teacher/c12/games', teacher);
    await user.click(await screen.findByRole('link', { name: 'Gem Keep settings' }));
    const section = await screen.findByRole('region', { name: 'Gem Keep settings' });
    await user.click(await within(section).findByRole('checkbox', { name: '×12' }));
    expect(saveGemKeepSettings).toHaveBeenLastCalledWith(expect.objectContaining({ enabledTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }), 'c12');
    const pass = within(section).getByLabelText('Level Key pass mark');
    await user.clear(pass);
    await user.type(pass, '7{Enter}');
    // Each save starts from the newest settings, so the table switched off a moment ago stays off.
    expect(saveGemKeepSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyPassMark: 7, enabledTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }),
      'c12',
    );
    expect((await within(section).findAllByText(/Saved/)).length).toBeGreaterThan(0);
    await user.click(within(section).getByRole('radio', { name: 'Challenge' }));
    expect(saveGemKeepSettings).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'challenge', keyPassMark: 7 }), 'c12');
    await user.click(within(section).getByRole('radio', { name: 'Never' }));
    expect(saveGemKeepSettings).toHaveBeenLastCalledWith(expect.objectContaining({ missingFactor: false }), 'c12');
    await user.click(within(section).getByRole('switch', { name: 'Division questions' }));
    expect(saveGemKeepSettings).toHaveBeenLastCalledWith(expect.objectContaining({ division: true }), 'c12');
    await user.click(within(section).getByRole('radio', { name: 'Multiple choice' }));
    expect(saveGemKeepSettings).toHaveBeenLastCalledWith(expect.objectContaining({ multipleChoice: true, division: true }), 'c12');
  });

  it('shows the class’s hardest facts, for the class in the header', async () => {
    const { fetchClassGemKeep } = await import('../data/gemKeep');
    const user = userEvent.setup();
    renderAt('/teacher/c12/games', teacher);
    await user.click(await screen.findByRole('link', { name: 'Gem Keep settings' }));
    const section = await screen.findByRole('region', { name: /^Gem Keep: this class/ });
    const hardest = await within(section).findByRole('table', { name: 'Hardest facts (most often wrong)' });
    expect(within(hardest).getByRole('rowheader', { name: '7 × 8' })).toBeInTheDocument();
    expect(within(hardest).getByText('55%')).toBeInTheDocument();
    expect(fetchClassGemKeep).toHaveBeenLastCalledWith('c12');
  });

  it('shows a student’s Gem Keep levels and times-table grid when its line is opened', async () => {
    const { fetchStudentGemKeep } = await import('../data/gemKeep');
    const { user } = await openKiwi();
    const games = screen.getByRole('region', { name: 'Games' });
    const line = (await within(games).findByText('3 of 30 stars, 1 Level Key passed')).closest('summary')!;
    expect(line).toHaveTextContent('Gem Keep');
    expect(fetchStudentGemKeep).toHaveBeenCalledTimes(1); // the summary only
    await user.click(line);
    expect(await within(games).findByText(/Gem Keep: 3 of 30 stars, 1 Level Key passed/)).toBeInTheDocument();
    const grid = within(games).getByRole('table', { name: 'Times tables: how well each fact is known' });
    // Both orders of a fact are one record.
    expect(within(grid).getByText('7 × 8: Learning, 2 of 5 right')).toBeInTheDocument();
    expect(within(grid).getByText('8 × 7: Learning, 2 of 5 right')).toBeInTheDocument();
    expect(within(grid).getByText('5 × 2: Fluent, 6 of 6 right')).toBeInTheDocument();
    expect(within(grid).getAllByText(/Not tried/)).toHaveLength(144 - 4);
  });
});

describe('the Gem Keep leaderboard', () => {
  it('ranks by stars, never by maths', async () => {
    const user = userEvent.setup();
    renderAt('/leaderboard');
    await user.click(await screen.findByRole('radio', { name: 'Gem Keep' }));
    const list = await screen.findByRole('list', { name: 'Most stars leaderboard' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('★ 21')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'This week' })).not.toBeInTheDocument();
  });
});
