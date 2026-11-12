import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { Rules } from '../data/progress';
import type { Person } from '../data/teacher';
import { SoundProvider } from '../sound';

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
/** A teacher who isn't a school admin: they can't make teachers or start a new season. */
const plainTeacher: AuthState = { ...student, profile: { id: 't2', display_name: 'Calm Fox 2', avatar: {}, role: 'teacher' } };

async function renderAt(path: string, auth: AuthState = student) {
  // Every page but home loads when opened (dashboard plan D7): let the lazy page arrive before looking.
  const view = render(
    <SoundProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
  await waitFor(() => expect(document.querySelector('[data-page-loading]')).toBeNull(), { timeout: 10_000 });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('teacher view', () => {
  it('is only shown to teachers', async () => {
    await renderAt('/teacher');
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Teacher/ })).not.toBeInTheDocument();
    const { fetchPeople } = await import('../data/teacher');
    expect(fetchPeople).not.toHaveBeenCalled();
  });

  const roster = () => screen.findByRole('table', { name: /^Students in Room 12/ });

  it('shows a plain teacher no way to make teachers or start a new season (only a school admin does)', async () => {
    const user = userEvent.setup();
    await renderAt('/teacher/c12/students', plainTeacher);
    await roster();
    expect(screen.getByRole('button', { name: 'All my students' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'End of year: start a new season' })).not.toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Teacher pages' });
    expect(within(tabs).getByRole('link', { name: 'Class set-up' })).toHaveAttribute('href', '/teacher/c12/setup');
    expect(within(tabs).getByRole('link', { name: 'Maths' })).toHaveAttribute('href', '/teacher/c12/maths');
    expect(within(tabs).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    await user.click(within(await roster()).getByRole('link', { name: /Brave Kiwi 7/ }));
    await screen.findByText(/^50 points/);
    const manage = screen.getByRole('region', { name: 'Manage' });
    expect(within(manage).queryByRole('button', { name: /Make teacher|Remove teacher/ })).not.toBeInTheDocument();
    expect(within(manage).getByRole('button', { name: /New name/ })).toBeInTheDocument();
  });
});
