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
const playHref = () => screen.getByRole('link', { name: /Play$/ }).getAttribute('href')!;

describe('the home page with the non-maths games switch', () => {
  it('shows chess and checkers when the switch is on', async () => {
    await show(true);
    expect(hrefs().some((h) => h.startsWith('/chess'))).toBe(true);
    expect(hrefs().some((h) => h.startsWith('/checkers'))).toBe(true);
  });

  it('shows them when the class has never set the switch', async () => {
    await show(undefined);
    expect(hrefs().some((h) => h.startsWith('/chess'))).toBe(true);
  });

  it('hides the non-maths cards but keeps the maths games when it is off', async () => {
    await show(false);
    const links = hrefs();
    for (const id of ['chess', 'checkers', '101', 'power-clash']) {
      expect(links.some((h) => h === `/${id}` || h.startsWith(`/${id}?`))).toBe(false);
    }
    expect(links.some((h) => h.startsWith('/space'))).toBe(true);
    expect(links.some((h) => h.startsWith('/monsters'))).toBe(true);
    // The big Play button does not point at a non-maths game.
    expect(playHref()).not.toMatch(/^\/(chess|checkers|101|power-clash)\b/);
  });

  it('keeps the Training tile when the non-maths games are off', async () => {
    await show(false);
    expect(hrefs()).toContain('/training');
  });

  it('still shows a teacher every card', async () => {
    await show(false, 'teacher');
    expect(hrefs().some((h) => h.startsWith('/chess'))).toBe(true);
  });
});
