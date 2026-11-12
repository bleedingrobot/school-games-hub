import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { fetchMyNewTrophies, markMyTrophiesSeen, saveMyFavouriteTrophies, type MyTrophies, type MyTrophy } from '../data/trophies';
import { playSound } from '../games/sounds';
import { SoundProvider } from '../sound';
import { NewTrophyMoment } from './NewTrophyMoment';
import { TrophyCabinet, type MyCabinet } from './TrophyCabinet';

vi.mock('../data/trophies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/trophies')>()),
  fetchMyNewTrophies: vi.fn(async () => []),
  markMyTrophiesSeen: vi.fn(async () => {}),
  saveMyFavouriteTrophies: vi.fn(async (ids: string[]) => ids),
}));
vi.mock('../data/classSwitches', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classSwitches')>()),
  useClassSwitches: () => new Set<string>(),
}));
vi.mock('../games/sounds', () => ({ playSound: vi.fn() }));

const trophy = (id: string, extra: Partial<MyTrophy> = {}): MyTrophy => ({
  id, game: 'chess', name: id, how: `Win ${id}`, kind: 'trophy', repeat: 'season', art: null, tier: 'bronze', count: 1,
  firstAt: '2026-10-13T01:00:00Z', lastAt: '2026-10-13T01:00:00Z', isNew: false,
  wins: [{ season: 1, year: 2026, at: '2026-10-13T01:00:00Z', detail: {} }], ...extra,
});

/** The cabinet with its data held in state, as the profile page holds it. */
function Cabinet({ start }: { start: MyTrophies }) {
  const [data, setData] = useState(start);
  const cabinet: MyCabinet = { data, failed: false, setFavourites: (favourites) => setData((was) => ({ ...was, favourites })) };
  return <TrophyCabinet cabinet={cabinet} />;
}

const pupil = (role: 'student' | 'teacher' = 'student'): AuthState => ({
  status: 'signed-in',
  profile: { id: 's1', display_name: 'Brave Kiwi 7', avatar: {}, role },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
});

let go: (path: string) => void = () => {};
function Nav() {
  go = useNavigate();
  return null;
}
function renderMoment(path: string, state = pupil()) {
  return render(
    <SoundProvider>
      <AuthContext.Provider value={state}>
        <MemoryRouter initialEntries={[path]}>
          <Nav />
          <Routes>
            <Route path="*" element={<NewTrophyMoment />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

const fresh = [
  { id: 'gold-one', game: 'chess', name: 'Chess Gold', how: 'Win at chess', kind: 'trophy' as const, tier: 'gold' as const, count: 4 },
  { id: 'pic-one', game: 'chess', name: 'Knight Head', how: 'Win with a knight', kind: 'picture' as const, tier: 'bronze' as const, count: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('trophy cabinet', () => {
  it('shows favourites first, the plaque with each season, and saves up to three favourites', async () => {
    const user = userEvent.setup();
    const start: MyTrophies = {
      season: 2,
      trophies: [trophy('A'), trophy('B', { tier: 'silver', count: 2, wins: [{ season: 1, year: 2026, at: '2026-10-13T01:00:00Z', detail: {} }, { season: 2, year: 2026, at: '2026-11-03T01:00:00Z', detail: {} }] }), trophy('C'), trophy('D')],
      next: [],
      favourites: ['C', 'D'],
    };
    render(<Cabinet start={start} />);
    const slots = () => screen.getAllByRole('button', { name: /, (Bronze|Silver)/ }).map((b) => b.getAttribute('aria-label'));
    expect(slots()).toEqual(['C, Bronze, a favourite', 'D, Bronze, a favourite', 'A, Bronze', 'B, Silver ×2']);

    await user.click(screen.getByRole('button', { name: 'B, Silver ×2' }));
    expect(screen.getByRole('list', { name: 'When you won it' })).toHaveTextContent('Season 1 · 13 Oct 2026Season 2 · 3 Nov 2026');
    await user.click(screen.getByRole('button', { name: /Make it a favourite/ }));
    expect(saveMyFavouriteTrophies).toHaveBeenLastCalledWith(['C', 'D', 'B']);
    expect(await screen.findByText(/one of your favourites now/)).toBeInTheDocument();

    // A fourth waits until one comes off.
    await user.click(screen.getByRole('button', { name: 'A, Bronze' }));
    await user.click(screen.getByRole('button', { name: /Make it a favourite/ }));
    expect(screen.getByRole('status')).toHaveTextContent('You have three favourites already.');
    expect(saveMyFavouriteTrophies).toHaveBeenCalledTimes(1);

    // A failed save puts it back.
    vi.mocked(saveMyFavouriteTrophies).mockRejectedValueOnce(new Error('We couldn’t save your favourites. Please try again.'));
    await user.click(screen.getByRole('button', { name: 'C, Bronze, a favourite' }));
    await user.click(screen.getByRole('button', { name: /Take off my favourites/ }));
    expect(await screen.findByText(/couldn’t save your favourites/)).toBeInTheDocument();
    expect(slots()[0]).toBe('C, Bronze, a favourite');
  });

  it('shows each new trophy once on a hub page, tells the server, and plays only with sound on', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMyNewTrophies).mockResolvedValueOnce(fresh);
    localStorage.setItem('sgh-sound-on', 'true');
    renderMoment('/');
    expect(await screen.findByRole('dialog', { name: 'New trophy!' })).toHaveTextContent('Gold, 4 times!');
    expect(markMyTrophiesSeen).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith('badge');
    await user.click(screen.getByRole('button', { name: /Next \(1 more\)/ }));
    expect(screen.getByRole('dialog', { name: 'New picture!' })).toHaveTextContent('Change my look');
    await user.click(screen.getByRole('button', { name: 'Yay!' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The next page asks again, and the server has nothing new.
    act(() => go('/lobby'));
    await waitFor(() => expect(fetchMyNewTrophies).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits outside the hub pages, never shows to a teacher, and keeps quiet with sound off', async () => {
    vi.mocked(fetchMyNewTrophies).mockResolvedValue(fresh);
    const { unmount } = renderMoment('/', pupil('teacher'));
    await act(async () => {});
    expect(fetchMyNewTrophies).not.toHaveBeenCalled();
    unmount();

    renderMoment('/games/chess');
    await act(async () => {});
    expect(fetchMyNewTrophies).not.toHaveBeenCalled();
    act(() => go('/profile'));
    expect(await screen.findByRole('dialog', { name: 'New trophy!' })).toBeInTheDocument();
    expect(playSound).not.toHaveBeenCalled();
    // Already on the profile: no button to go there.
    expect(screen.queryByRole('button', { name: /See my cabinet/ })).not.toBeInTheDocument();
    vi.mocked(fetchMyNewTrophies).mockReset();
  });
});
