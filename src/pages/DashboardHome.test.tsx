import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { busyPupil, sent, setWorld, type World } from './homePageFake';

/**
 * Server load S.2: the home page asks for everything in one request (my_home_page) and its cards take their parts from it.
 * Only the Supabase client is faked (homePageFake.ts); every page, card and data function is the real one.
 */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());

import { Dashboard } from './Dashboard';

// The cards say "Today", so the test must not run across midnight: pin the clock (Date only) to midday local time.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

const signedIn = (role = 'student') =>
  ({ status: 'signed-in', profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role }, message: null }) as unknown as AuthState;

/** Lets every request that the page starts (and the ones those start) go out, and the lazy cards load. */
async function settle() {
  for (let i = 0; i < 30; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function show(world: World, role?: string) {
  setWorld(world);
  render(
    <AuthContext.Provider value={signedIn(role)}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chess" element={<Link to="/">Back home</Link>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  await settle();
}

// The home layout (folded sections, pinned games) is asked once while the site is open, not each time the page opens.
const asked = () => sent.filter((s) => s !== 'from app_settings' && s !== 'rpc my_home_layout');

describe('the home page in one request', () => {

  it('shows a busy pupil the same cards and numbers', async () => {
    await show(busyPupil());
    expect(screen.getAllByText('Level 2').length).toBeGreaterThan(0);
    expect(screen.getByText('60 points')).toBeInTheDocument();
    // Recent games: the newest 3 of every kind, with the points and the classmate's name (the rest are on the profile page).
    const recent = within(screen.getByRole('region', { name: 'Recent games' })).getAllByRole('listitem');
    expect(recent.map((li) => li.textContent)).toEqual([
      'WonChess vs Easy bot+3Today',
      'WonChess vs  Brave Kiwi 7+5Today',
      '1stWormholes & Black Holes with classmatesToday',
    ]);
    expect(screen.getByRole('link', { name: 'See more' })).toHaveAttribute('href', '/profile#stats');
    // The stats tables moved to the profile page.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Games still going: one of each kind with classmates, two friend games and a link to the rest.
    const going = screen.getByRole('region', { name: 'Games still going' });
    expect(within(going).getAllByRole('link', { name: 'Carry on' })).toHaveLength(5);
    expect(within(going).getByText(/Brave Kiwi 7/)).toBeInTheDocument();
    expect(within(going).getByText('1 more game still going: see them in the lobby')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 mine fights')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    // The cards, from the same answer.
    expect(screen.getByRole('region', { name: 'Join your class' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /My maths$/ })).toBeInTheDocument();
    expect(screen.getByText(/You can’t change it until it ends/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show my path' })).not.toBeInTheDocument();
    expect(asked()).toEqual(['rpc my_home_page']);
    // One settings request still serves every switch on the page.
    expect(sent.filter((s) => s === 'from app_settings')).toHaveLength(1);
  });
});
