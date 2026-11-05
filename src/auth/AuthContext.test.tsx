import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMyProfile = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
let fire: (event: string, session: unknown) => void = () => {};

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        fire = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => signOut(),
    },
  },
}));
vi.mock('../data/profile', async (load) => ({ ...(await load<typeof import('../data/profile')>()), fetchMyProfile }));

const { AuthProvider, useAuth } = await import('./AuthContext');
const { FriendlyError } = await import('../data/profile');

function Who() {
  const { status, message } = useAuth();
  return <p>{status}{message ? `: ${message}` : ''}</p>;
}

const session = { user: { id: 'pupil-1' }, access_token: 't' };
const profile = { id: 'pupil-1', display_name: 'Brave Kiwi', avatar: null, role: 'student', school_admin: false };

describe('loading the profile after sign-in', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMyProfile.mockReset();
    signOut.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('a Wi-Fi hiccup is tried again instead of signing the pupil out', async () => {
    fetchMyProfile.mockRejectedValueOnce(new FriendlyError("We couldn't load your profile. Please try again.")).mockResolvedValue(profile);
    render(<AuthProvider><Who /></AuthProvider>);
    await act(async () => {
      fire('INITIAL_SESSION', session);
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText('signed-in')).toBeInTheDocument();
    expect(fetchMyProfile).toHaveBeenCalledTimes(2);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('still signs out (with a message) if the profile never loads', async () => {
    fetchMyProfile.mockRejectedValue(new FriendlyError("We couldn't load your profile. Please try again."));
    render(<AuthProvider><Who /></AuthProvider>);
    await act(async () => {
      fire('INITIAL_SESSION', session);
      await vi.runAllTimersAsync();
    });
    expect(screen.getByText("signed-out: We couldn't load your profile. Please try again.")).toBeInTheDocument();
    expect(fetchMyProfile).toHaveBeenCalledTimes(3);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
