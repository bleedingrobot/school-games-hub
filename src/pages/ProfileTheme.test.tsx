import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Link, MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import type { Profile } from '../data/profile';
import { SoundProvider } from '../sound';

/** D.4b: each pupil picks a theme on their profile page. It is saved inside the avatar, so both must survive each other's saves. */
vi.mock('../lib/supabase', async () => (await import('./homePageFake')).fakeSupabase());

const saved = vi.hoisted(() => ({ avatar: {} as Record<string, unknown>, calls: [] as Record<string, unknown>[] }));
vi.mock('../data/profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/profile')>()),
  fetchNameWords: vi.fn(async () => ({ adjectives: ['Speedy'], animals: ['Otter'] })),
  saveMyAvatar: vi.fn(async (avatar: Record<string, unknown>) => {
    saved.calls.push(avatar);
    saved.avatar = avatar;
  }),
}));

import { busyPupil, setWorld } from './homePageFake';

/** The signed-in pupil, whose profile is read again after each save (as the real AuthProvider does). */
function SignedIn({ start }: { start: Record<string, unknown> }) {
  const [profile, setProfile] = useState<Profile>({ id: 'me', display_name: 'Speedy Otter 27', avatar: start, role: 'student' } as Profile);
  const auth = {
    status: 'signed-in',
    profile,
    message: null,
    signIn: async () => {},
    signOut: async () => {},
    refreshProfile: async () => setProfile((p) => ({ ...p, avatar: saved.avatar })),
  } as AuthState;
  return (
    <SoundProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/profile']}>
          <AppRoutes />
          <Link to="/">Go home</Link>
          <Link to="/chess">Go to chess</Link>
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>
  );
}

const theme = () => document.querySelector('.hub-page')!.getAttribute('data-hub-theme');
const settle = async () => {
  for (let i = 0; i < 10; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
};

async function open(start: Record<string, unknown>) {
  saved.avatar = start;
  saved.calls = [];
  setWorld(busyPupil());
  render(<SignedIn start={start} />);
  await settle();
}

beforeEach(() => localStorage.clear());

describe('My theme on the profile page', () => {
  it('starts on Tidy school when nothing (or something unknown) is saved', async () => {
    await open({ kind: 'robot', theme: 'neon' });
    expect(theme()).toBe('tidy');
    expect(screen.getByRole('radio', { name: 'Tidy school' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save theme' })).toBeDisabled();
  });

  it('changes the page straight away, and Save keeps the avatar as it was saved', async () => {
    const user = userEvent.setup();
    await open({ kind: 'robot', eyes: 'star' });
    // An avatar change that is not saved yet stays out of the theme's save.
    await user.click(screen.getByRole('radio', { name: 'Cat' }));
    await user.click(screen.getByRole('radio', { name: 'Game menu' }));
    expect(theme()).toBe('menu');
    await user.click(screen.getByRole('button', { name: 'Save theme' }));
    await settle();
    expect(saved.calls.at(-1)).toMatchObject({ kind: 'robot', eyes: 'star', theme: 'menu' });
    expect(screen.getByText(/^Saved!/)).toBeInTheDocument();
    expect(theme()).toBe('menu');
  });

  it('keeps the theme when the avatar is saved', async () => {
    const user = userEvent.setup();
    await open({ kind: 'robot', theme: 'soft' });
    expect(theme()).toBe('soft');
    await user.click(screen.getByRole('radio', { name: 'Cat' }));
    await user.click(screen.getByRole('button', { name: 'Save avatar' }));
    await settle();
    expect(saved.calls.at(-1)).toMatchObject({ kind: 'cat', theme: 'soft' });
    expect(theme()).toBe('soft');
  });

  it('goes back to the saved theme when the pupil leaves without saving', async () => {
    const user = userEvent.setup();
    await open({ theme: 'soft' });
    await user.click(screen.getByRole('radio', { name: 'Game menu' }));
    expect(theme()).toBe('menu');
    await user.click(screen.getByRole('link', { name: 'Go home' }));
    await settle();
    expect(theme()).toBe('soft');
    expect(saved.calls).toHaveLength(0);
  });

  it('leaves the games in their own look', async () => {
    const user = userEvent.setup();
    await open({ theme: 'menu' });
    await user.click(screen.getByRole('link', { name: 'Go to chess' }));
    await settle();
    expect(theme()).toBeNull();
  });

  it('shows My stats on the profile page', async () => {
    await open({});
    const stats = screen.getByRole('region', { name: 'My stats' });
    expect(within(stats).getByRole('table', { name: 'Against bots' })).toBeInTheDocument();
    expect(within(stats).getByRole('table', { name: 'Against friends' })).toBeInTheDocument();
  });
});
