import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { newPupil, setWorld } from './homePageFake';

/** The class switch for the non-maths games (chess, checkers, 101, Power Clash), seen from the home page. Only Supabase is faked. */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());

import { Dashboard } from './Dashboard';

const signedIn = (role = 'student') =>
  ({ status: 'signed-in', profile: { id: 'me', display_name: 'Speedy Otter 27', avatar: {}, role }, message: null }) as unknown as AuthState;

async function settle() {
  for (let i = 0; i < 30; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function show(nonMaths: boolean | undefined, role?: string) {
  const world = newPupil();
  world.tables.app_settings = [
    { monsters_enabled: true, lord_enabled: true, clans_enabled: true, multiplayer_enabled: true, space_maths: 'choose', ...(nonMaths === undefined ? {} : { non_maths_games: nonMaths }) },
  ];
  setWorld(world);
  render(
    <AuthContext.Provider value={signedIn(role)}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  await settle();
}

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');

describe('the home page with the non-maths games switch', () => {

  it('hides the non-maths cards but keeps the maths games when it is off', async () => {
    await show(false);
    const links = hrefs();
    for (const id of ['chess', 'checkers', '101', 'power-clash']) {
      expect(links.some((h) => h === `/${id}` || h.startsWith(`/${id}?`))).toBe(false);
    }
    expect(links.some((h) => h.startsWith('/space'))).toBe(true);
    expect(links.some((h) => h.startsWith('/monsters'))).toBe(true);
    // No big Play button (James, 11 Nov 2026: My games takes its place), so nothing can point at a non-maths game from the top.
    expect(screen.queryByRole('link', { name: /^▶?\s*Play$/ })).toBeNull();
  });

  it('still shows a teacher every card', async () => {
    await show(false, 'teacher');
    expect(hrefs().some((h) => h.startsWith('/chess'))).toBe(true);
  });
});
