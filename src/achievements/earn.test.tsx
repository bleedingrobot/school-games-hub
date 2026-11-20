import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { fetchMyNewAchievements, markMyAchievementsSeen, type NewAchievement } from '../data/newAchievements';
import { fetchMyNewTrophies } from '../data/trophies';
import { SoundProvider } from '../sound';
import { NewTrophyMoment } from '../trophies/NewTrophyMoment';
import { AchievementPop } from './AchievementPop';
import { NewAchievementMoment } from './NewAchievementMoment';

vi.mock('../data/newAchievements', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/newAchievements')>()),
  fetchMyNewAchievements: vi.fn(async () => []),
  markMyAchievementsSeen: vi.fn(async () => {}),
}));
vi.mock('../data/trophies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/trophies')>()),
  fetchMyNewTrophies: vi.fn(async () => []),
  markMyTrophiesSeen: vi.fn(async () => 0),
}));
vi.mock('../games/sounds', () => ({ playSound: vi.fn() }));

const fresh = (id: string, game = 'chess', tier: 1 | 2 | 3 = 2): NewAchievement => ({
  id, game, name: `Name ${id}`, emoji: '⭐', how: `Do ${id}.`, tier, earnedAt: '2026-11-19T01:00:00Z',
});

const pupil: AuthState = {
  status: 'signed-in',
  profile: { id: 's1', display_name: 'Brave Kiwi 7', avatar: {}, role: 'student' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
});

it('the game pop asks after a saved go, shows only its own game easiest first, and marks just those seen', async () => {
  vi.mocked(fetchMyNewAchievements).mockResolvedValue([fresh('gold', 'chess', 3), fresh('other', 'space'), fresh('bronze', 'chess', 1)]);
  const user = userEvent.setup();
  function Game() {
    const [saves, setSaves] = useState(0);
    return (
      <>
        <button onClick={() => setSaves((n) => n + 1)}>save</button>
        <AchievementPop games={['chess']} watch={saves || null} />
      </>
    );
  }
  render(<SoundProvider><Game /></SoundProvider>);
  expect(fetchMyNewAchievements).not.toHaveBeenCalled();
  await user.click(screen.getByText('save'));
  expect(await screen.findByText('Name bronze')).toBeTruthy();
  expect(screen.getByText(/\+10 points/)).toBeTruthy();
  expect(screen.getByText('See it').getAttribute('href')).toBe('#/achievements');
  expect(markMyAchievementsSeen).toHaveBeenCalledWith(['gold', 'bronze']);
  await user.click(screen.getByText(/Next \(1\)/));
  expect(screen.getByText('Name gold')).toBeTruthy();
  expect(screen.queryByText('Name other')).toBeNull();
});

it('the hub moment waits for a trophy, shows three, then "and N more", and never on a game page', async () => {
  let trophyDone: (v: never[]) => void = () => {};
  vi.mocked(fetchMyNewTrophies).mockReturnValue(new Promise((done) => (trophyDone = done)));
  vi.mocked(fetchMyNewAchievements).mockResolvedValue(['a', 'b', 'c', 'd', 'e'].map((id) => fresh(id)));
  const user = userEvent.setup();
  const view = (path: string) => (
    <SoundProvider>
      <AuthContext.Provider value={pupil}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="*" element={<><NewTrophyMoment /><NewAchievementMoment /></>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>
  );
  const game = render(view('/chess'));
  await act(async () => {});
  expect(fetchMyNewAchievements).not.toHaveBeenCalled();
  game.unmount();

  render(view('/'));
  await waitFor(() => expect(fetchMyNewAchievements).toHaveBeenCalled());
  // Still asking about trophies: no achievement yet, so never two at once.
  expect(screen.queryByText('New achievement!')).toBeNull();
  await act(async () => trophyDone([]));
  expect(await screen.findByText('New achievement!')).toBeTruthy();
  expect(screen.getByText('1 of 3')).toBeTruthy();
  expect(markMyAchievementsSeen).toHaveBeenCalledWith(['a', 'b', 'c', 'd', 'e']);
  await user.click(screen.getByText(/Next \(2 more\)/));
  await user.click(screen.getByText(/Next \(1 more\)/));
  expect(screen.getByText('Name c')).toBeTruthy();
  expect(screen.getByText(/and 2 more waiting/)).toBeTruthy();
  await user.click(screen.getByText('Yay!'));
  expect(screen.queryByRole('dialog')).toBeNull();
});
