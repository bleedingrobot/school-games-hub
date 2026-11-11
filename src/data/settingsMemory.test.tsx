import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const read = vi.fn();
const select = vi.fn(() => ({ maybeSingle: read }));
const from = vi.fn((table: string) => {
  void table;
  return { select };
});
let authChange: (event: string, session: unknown) => void = () => {};
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (table: string) => from(table),
    auth: {
      onAuthStateChange: (callback: typeof authChange) => {
        authChange = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));
vi.mock('./profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./profile')>()),
  fetchMyProfile: vi.fn(async (id: string) => ({ id, display_name: id, avatar: {}, role: 'student' })),
}));

import { AuthProvider } from '../auth/AuthContext';
import { fetchMonstersEnabled} from './monsters';

const ROW = { monsters_enabled: true, lord_enabled: false, clans_enabled: true, multiplayer_enabled: true, space_maths: 'on', lord_forest_per_day: 3 };
const tableReads = () => from.mock.calls.filter(([table]) => table === 'app_settings').length;

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: true, error: null });
  read.mockReset();
  read.mockResolvedValue({ data: ROW, error: null });
  from.mockClear();
  select.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the remembered row is forgotten', () => {

  it('on sign-out, and when a different pupil signs in on the same device', async () => {
    render(<AuthProvider><p>hub</p></AuthProvider>);
    const signIn = async (id: string) => {
      await act(async () => {
        authChange('SIGNED_IN', { user: { id } });
        await new Promise((r) => setTimeout(r, 5));
      });
    };
    await signIn('pupil-a');
    await fetchMonstersEnabled();
    await signIn('pupil-a'); // the same pupil again (a token refresh): still remembered
    await fetchMonstersEnabled();
    expect(tableReads()).toBe(1);

    await signIn('pupil-b');
    await fetchMonstersEnabled();
    expect(tableReads()).toBe(2);

    await act(async () => {
      authChange('SIGNED_OUT', null);
      await new Promise((r) => setTimeout(r, 5));
    });
    await waitFor(() => expect(tableReads()).toBe(2));
    await fetchMonstersEnabled();
    expect(tableReads()).toBe(3);
  });
});
