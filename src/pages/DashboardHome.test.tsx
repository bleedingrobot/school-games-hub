import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { busyPupil, newPupil, sent, setWorld, type World } from './homePageFake';

/**
 * Server load S.2: the home page asks for everything in one request (my_home_page) and its cards take their parts from it.
 * Only the Supabase client is faked (homePageFake.ts); every page, card and data function is the real one.
 */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());

import { Dashboard } from './Dashboard';
import { Profile } from './Profile';

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

const asked = () => sent.filter((s) => s !== 'from app_settings');
const statsRow = (table: string, game: string) =>
  within(screen.getByRole('table', { name: table }))
    .getByRole('rowheader', { name: game })
    .closest('tr')!
    .textContent;

describe('the home page in one request', () => {
  it('sends one request when it opens, plus at most the switch read', async () => {
    await show(busyPupil());
    expect(asked()).toEqual(['rpc my_home_page']);
    expect(sent.filter((s) => s === 'from app_settings').length).toBeLessThanOrEqual(1);
  });

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
  });

  it('shows a new pupil the same cards and numbers', async () => {
    await show(newPupil());
    expect(screen.getByText('No games yet. Press Play to start your first one!')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Games still going' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Join your class' })).not.toBeInTheDocument();
    expect(screen.getByText('Your teacher has set the games to pick for you.')).toBeInTheDocument();
    expect(screen.getByText('0 of 0')).toBeInTheDocument();
    expect(asked()).toEqual(['rpc my_home_page']);
  });

  it('shows the old messages when the one request fails, and asks nothing more', async () => {
    await show({ ...busyPupil(), down: true });
    expect(screen.getByText('We couldn’t load your games just now.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Achievements/ })).getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/points$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Join your class' })).not.toBeInTheDocument();
    // The focus card falls back to auto, as it did when its own request failed.
    expect(screen.getByText(/Auto: the games pick the next maths for you/)).toBeInTheDocument();
    expect(asked()).toEqual(['rpc my_home_page']);
  });

  it('a card asks for itself when the answer has no part for it', async () => {
    await show({ ...busyPupil(), missing: ['myClass', 'focus', 'ladder'] });
    expect([...asked()].sort()).toEqual(['rpc my_class', 'rpc my_home_page', 'rpc my_ladder', 'rpc my_maths_focus']);
    expect(screen.getByRole('region', { name: 'Join your class' })).toBeInTheDocument();
    expect(screen.getByText(/You can’t change it until it ends/)).toBeInTheDocument();
  });

  it('a teacher gets one request and no pupil cards', async () => {
    await show(busyPupil(), 'teacher');
    expect(asked()).toEqual(['rpc my_home_page']);
    expect(screen.queryByRole('region', { name: 'Join your class' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /My maths/ })).not.toBeInTheDocument();
  });

  it('asks again when the pupil comes back from a game, and the switches are still remembered', async () => {
    await show(busyPupil());
    fireEvent.click(screen.getByRole('link', { name: /Play$/ }));
    await settle();
    fireEvent.click(screen.getByRole('link', { name: 'Back home' }));
    await settle();
    expect(asked()).toEqual(['rpc my_home_page', 'rpc my_home_page']);
    expect(sent.filter((s) => s === 'from app_settings').length).toBeLessThanOrEqual(1);
    expect(screen.getByText('60 points')).toBeInTheDocument();
  });
});

describe('My stats on the profile page', () => {
  async function showProfile(world: World) {
    setWorld(world);
    render(
      <AuthContext.Provider value={signedIn()}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await settle();
  }
  const profileAsked = () => sent.filter((s) => s.startsWith('rpc'));

  it('shows the stats tables that moved from the home page, from the same one request', async () => {
    await showProfile(busyPupil());
    const stats = screen.getByRole('region', { name: 'My stats' });
    expect(statsRow('Against bots', 'Chess')).toBe('Chess3201');
    // 101 and Power Clash with classmates join chess and checkers against friends.
    expect(statsRow('Against friends', 'Chess')).toBe('Chess2101');
    expect(statsRow('Against friends', '101')).toBe('1012110');
    expect(within(stats).getByText(/Wormholes & Black Holes: 3 games, 1st place 2 times/)).toBeInTheDocument();
    // More recent games than the home page's 3.
    expect(within(stats).getAllByRole('listitem').length).toBeGreaterThan(3);
    expect(within(stats).getByText(/Checkers vs Medium bot/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'My progress' })).toBeInTheDocument();
    expect(profileAsked()).toEqual(['rpc my_home_page']);
  });

  it('shows a new pupil empty tables', async () => {
    await showProfile(newPupil());
    expect(statsRow('Against bots', 'Chess')).toBe('Chess0000');
    expect(statsRow('Against friends', '101')).toBe('1010000');
  });

  it('shows dashes and a kind message when the request fails', async () => {
    await showProfile({ ...busyPupil(), down: true });
    expect(statsRow('Against bots', 'Chess')).toBe('Chess––––');
    expect(screen.getByText('We couldn’t load your points just now.')).toBeInTheDocument();
  });
});
