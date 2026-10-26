import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { BoardRow } from '../data/progress';
import type { Person } from '../data/teacher';
import { SoundProvider } from '../sound';

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

vi.mock('../data/progress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/progress')>()),
  fetchLeaderboard: vi.fn(),
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

describe('progress pages', () => {
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

  it('is only shown to teachers', async () => {
    renderAt('/teacher');
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Teacher/ })).not.toBeInTheDocument();
    const { fetchPeople } = await import('../data/teacher');
    expect(fetchPeople).not.toHaveBeenCalled();
  });

  it('shows a student’s stats and recent games', async () => {
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    await user.click(await screen.findByRole('button', { name: /Brave Kiwi 7/ }));
    const panel = screen.getByRole('button', { name: /Brave Kiwi 7/ }).closest('li')!;
    await within(panel).findByText('Level 2 · 50 points');
    const table = within(panel).getByRole('table', { name: 'Games' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(within(panel).getByText(/Checkers vs Lucky Tui 12/)).toBeInTheDocument();
    expect(within(panel).getByText(/Wormholes & Black Holes vs Pilot bots/).closest('li')).toHaveTextContent('3rd');
    expect(within(panel).getByText(/Wormholes & Black Holes: 1 achievement/)).toBeInTheDocument();
    expect(within(panel).getByText(/Chess vs Medium bot/).closest('li')).toHaveTextContent('(left early)');
  });
});
