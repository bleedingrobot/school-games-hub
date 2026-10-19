import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { busyPupil, newPupil, sent, setWorld, type World } from './homePageFake';

/**
 * Server load S.2: the home page asks for everything in one request (my_home_page) and its cards take their parts from it.
 * Only the Supabase client is faked (homePageFake.ts); every page, card and data function is the real one.
 */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());

import { Dashboard } from './Dashboard';

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
    // Recent games: the newest 5 of every kind, with the points and the classmate's name.
    const recent = within(screen.getByRole('region', { name: 'Recent games' })).getAllByRole('listitem');
    expect(recent.map((li) => li.textContent)).toEqual([
      'WonChess vs Easy bot+3Today',
      'WonChess vs  Brave Kiwi 7+5Today',
      '1stWormholes & Black Holes with classmatesToday',
      '2nd101 with classmatesToday',
      'LostCheckers vs Medium bot (left early)Today',
    ]);
    expect(statsRow('Against bots', 'Chess')).toBe('Chess3201');
    // 101 and Power Clash with classmates join chess and checkers against friends.
    expect(statsRow('Against friends', 'Chess')).toBe('Chess2101');
    expect(statsRow('Against friends', '101')).toBe('1012110');
    expect(screen.getByText(/Wormholes & Black Holes: 3 games, 1st place 2 times/)).toBeInTheDocument();
    // Games still going: one of each kind with classmates, two friend games and a link to the rest.
    const going = screen.getByRole('region', { name: 'Games still going' });
    expect(within(going).getAllByRole('link', { name: 'Carry on' })).toHaveLength(5);
    expect(within(going).getByText(/Brave Kiwi 7/)).toBeInTheDocument();
    expect(within(going).getByText('1 more game still going: see them in the lobby')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 mine fights')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    // The cards, from the same answer.
    expect(screen.getByRole('region', { name: 'Join your class' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /My maths focus/ })).toBeInTheDocument();
    expect(screen.getByText(/You can’t change it until it ends/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /My maths path/ })).not.toBeInTheDocument();
    expect(asked()).toEqual(['rpc my_home_page']);
  });

  it('shows a new pupil the same cards and numbers', async () => {
    await show(newPupil());
    expect(screen.getByText('No games yet. Press Play to start your first one!')).toBeInTheDocument();
    expect(statsRow('Against bots', 'Chess')).toBe('Chess0000');
    expect(statsRow('Against friends', '101')).toBe('1010000');
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
    expect(statsRow('Against bots', 'Chess')).toBe('Chess––––');
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
    expect(screen.queryByRole('heading', { name: /My maths focus/ })).not.toBeInTheDocument();
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
