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
  startNewSeason: vi.fn(async () => ({ botGames: 120, friendGames: 30 })),
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
const teacher: AuthState = { ...student, profile: { id: 't1', display_name: 'Wise Owl 1', avatar: {}, role: 'teacher' } };

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

  it('lists everyone with their games, and a link in the top bar', async () => {
    renderAt('/teacher', teacher);
    expect(screen.getByRole('link', { name: /Teacher/ })).toHaveAttribute('href', '/teacher');
    const kiwi = (await screen.findByText('Brave Kiwi 7')).closest('li')!;
    expect(kiwi).toHaveTextContent('6 games');
    expect(kiwi).toHaveTextContent('jane.smith');
    expect(kiwi).toHaveTextContent('Last played today');
    expect(screen.getByText('Lucky Tui 12').closest('li')).toHaveTextContent('Hidden');
    expect(screen.getByText('Wise Owl 1').closest('li')).toHaveTextContent('You');
  });

  it('filters the list by name', async () => {
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    await screen.findByText('Brave Kiwi 7');
    await user.type(screen.getByLabelText('Find a player'), 'tui');
    expect(screen.queryByText('Brave Kiwi 7')).not.toBeInTheDocument();
    expect(screen.getByText('Lucky Tui 12')).toBeInTheDocument();
  });

  it('filters the list by real name too', async () => {
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    await screen.findByText('Brave Kiwi 7');
    await user.type(screen.getByLabelText('Find a player'), 'smith');
    expect(screen.getByText('Brave Kiwi 7')).toBeInTheDocument();
    expect(screen.queryByText('Lucky Tui 12')).not.toBeInTheDocument();
  });

  async function openKiwi() {
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    await user.click(await screen.findByRole('button', { name: /Brave Kiwi 7/ }));
    const panel = screen.getByRole('button', { name: /Brave Kiwi 7/ }).closest('li')!;
    await within(panel).findByText('Level 2 · 50 points');
    return { user, panel };
  }

  it('shows a student’s stats and recent games', async () => {
    const { panel } = await openKiwi();
    const table = within(panel).getByRole('table', { name: 'Games' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(within(panel).getByText(/Checkers vs Lucky Tui 12/)).toBeInTheDocument();
    expect(within(panel).getByText(/Wormholes & Black Holes vs Pilot bots/).closest('li')).toHaveTextContent('3rd');
    expect(within(panel).getByText(/Wormholes & Black Holes: 1 achievement/)).toBeInTheDocument();
    expect(within(panel).getByText(/Chess vs Medium bot/).closest('li')).toHaveTextContent('(left early)');
  });

  it('gives a new name after a confirm step', async () => {
    const { renamePerson } = await import('../data/teacher');
    const { user, panel } = await openKiwi();
    await user.click(within(panel).getByRole('button', { name: /New name/ }));
    expect(renamePerson).not.toHaveBeenCalled();
    await user.click(within(panel).getByRole('button', { name: 'Yes, new name' }));
    expect(renamePerson).toHaveBeenCalledWith('s1');
    expect(await within(panel).findByText('Brave Kiwi 7 is now Happy Moose 3.')).toBeInTheDocument();
  });

  it('hides a student', async () => {
    const { setHidden } = await import('../data/teacher');
    const { user, panel } = await openKiwi();
    await user.click(within(panel).getByRole('button', { name: /Hide/ }));
    expect(setHidden).toHaveBeenCalledWith('s1', true);
  });

  it('makes someone a teacher only after a warning', async () => {
    const { setRole } = await import('../data/teacher');
    const { user, panel } = await openKiwi();
    await user.click(within(panel).getByRole('button', { name: /Make teacher/ }));
    expect(within(panel).getByText(/Only do this for staff/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(setRole).not.toHaveBeenCalled();
    await user.click(within(panel).getByRole('button', { name: /Make teacher/ }));
    await user.click(within(panel).getByRole('button', { name: 'Yes, make teacher' }));
    expect(setRole).toHaveBeenCalledWith('s1', 'teacher');
  });

  it('can’t change their own role or delete a teacher', async () => {
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    await user.click(await screen.findByRole('button', { name: /Wise Owl 1/ }));
    const panel = screen.getByRole('button', { name: /Wise Owl 1/ }).closest('li')!;
    await within(panel).findByText('Level 2 · 50 points');
    expect(within(panel).queryByRole('button', { name: /Make teacher|Remove teacher/ })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('deletes a student only after their name is typed', async () => {
    const { deletePerson, fetchPeople } = await import('../data/teacher');
    const { user, panel } = await openKiwi();
    await user.click(within(panel).getByRole('button', { name: /Delete/ }));
    const confirm = within(panel).getByRole('group', { name: 'Confirm delete' });
    expect(confirm).toHaveTextContent('It can’t be undone');
    const button = within(confirm).getByRole('button', { name: 'Delete forever' });
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByLabelText('Type their player name to confirm'), 'Brave Kiwi');
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByLabelText('Type their player name to confirm'), ' 7');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(deletePerson).toHaveBeenCalledWith('s1');
    expect(fetchPeople).toHaveBeenCalledTimes(2);
  });

  it('pauses games against friends', async () => {
    const { setMultiplayer } = await import('../data/teacher');
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    await user.click(await screen.findByRole('button', { name: 'Pause games against friends' }));
    expect(setMultiplayer).toHaveBeenCalledWith(false);
    expect(await screen.findByRole('button', { name: 'Switch games against friends back on' })).toBeInTheDocument();
    expect(screen.getByText('Games against friends are paused for everyone.')).toBeInTheDocument();
  });

  it('starts a new season only after NEW SEASON is typed', async () => {
    const { startNewSeason } = await import('../data/teacher');
    const user = userEvent.setup();
    renderAt('/teacher', teacher);
    const section = await screen.findByRole('region', { name: 'End of year: start a new season' });
    const button = within(section).getByRole('button', { name: 'Start a new season' });
    expect(button).toBeDisabled();
    await user.type(within(section).getByLabelText('Type NEW SEASON'), 'new season');
    expect(button).toBeDisabled();
    await user.clear(within(section).getByLabelText('Type NEW SEASON'));
    await user.type(within(section).getByLabelText('Type NEW SEASON'), 'NEW SEASON');
    await user.click(button);
    expect(startNewSeason).toHaveBeenCalledWith('NEW SEASON');
    expect(await within(section).findByText(/120 bot games and 30 games between students were deleted/)).toBeInTheDocument();
  });
});
