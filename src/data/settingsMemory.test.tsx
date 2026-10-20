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
import { fetchStudentsChooseFocus, readSettings, saveMathsAuto } from './classSettings';
import { fetchClansEnabled, saveClansEnabled, startClansNewSeason } from './clans';
import { fetchLordEnabled, saveLordSettings } from './lord';
import { fetchMonstersEnabled, saveMonstersSettings } from './monsters';
import { fetchMultiplayerEnabled } from './multiplayer';
import { fetchMathsSwitch } from './spaceGames';
import { setMultiplayer, setSpaceMaths, setSpaceReactions } from './teacher';
import { saveGemKeepSettings } from './gemKeep';
import { DEFAULT_SETTINGS } from '../games/gem-keep/settings';
import { SETTINGS_KEEP_MS } from './settingsMemory';

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

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('the game switches are read once', () => {
  it('the three switches on the home page, asked together, send one request for the whole row', async () => {
    expect(await Promise.all([fetchMonstersEnabled(), fetchLordEnabled(), fetchClansEnabled()])).toEqual([true, false, true]);
    expect(tableReads()).toBe(1);
    expect(select).toHaveBeenCalledWith('*');
  });

  it('two pages asking at the same moment share the one request, and each gets its own switch', async () => {
    let finish: (v: unknown) => void = () => {};
    read.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const lobby = fetchMultiplayerEnabled();
    const space = fetchMathsSwitch();
    expect(tableReads()).toBe(1);
    finish({ data: ROW, error: null });
    expect(await lobby).toBe(true);
    expect(await space).toBe('on');
    expect(tableReads()).toBe(1);
  });

  it('uses the remembered row for 5 minutes, then reads it again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await fetchMonstersEnabled();
    vi.setSystemTime(Date.now() + SETTINGS_KEEP_MS - 1000);
    await fetchClansEnabled();
    expect(tableReads()).toBe(1);
    vi.setSystemTime(Date.now() + 2000);
    await fetchClansEnabled();
    expect(tableReads()).toBe(2);
  });

  it('does not remember a failed read: the next caller tries again', async () => {
    read.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } });
    await expect(fetchMonstersEnabled()).rejects.toThrow('We couldn’t load this setting.');
    expect(await fetchMonstersEnabled()).toBe(true);
    expect(tableReads()).toBe(2);
    read.mockRejectedValueOnce(new Error('offline'));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + SETTINGS_KEEP_MS + 1);
    await expect(readSettings(['monsters_enabled'])).rejects.toThrow('offline');
    expect(await readSettings(['monsters_enabled'])).toEqual(ROW);
    expect(tableReads()).toBe(4);
  });

  it('keeps the switches each caller had before (a missing row is the same as before)', async () => {
    read.mockResolvedValue({ data: null, error: null });
    expect(await fetchStudentsChooseFocus()).toBe(true);
    await expect(fetchClansEnabled()).rejects.toThrow('We couldn’t load the Clan Quest setting.');
  });

  it('the teacher class picker reads that class fresh every time', async () => {
    rpc.mockResolvedValue({ data: { ...ROW, clans_enabled: false }, error: null });
    expect(await fetchClansEnabled('c1')).toBe(false);
    expect(await fetchClansEnabled('c1')).toBe(false);
    expect(await fetchLordEnabled()).toBe(false);
    expect(rpc.mock.calls.filter(([name]) => name === 'teacher_class_settings')).toHaveLength(2);
    expect(tableReads()).toBe(1);
  });
});

describe('the remembered row is forgotten', () => {
  it('when the tab comes back after being hidden for more than 5 minutes (not after a short break)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await fetchMonstersEnabled();
    setHidden(true);
    vi.setSystemTime(Date.now() + 60_000);
    setHidden(false);
    await fetchMonstersEnabled();
    expect(tableReads()).toBe(1);
    setHidden(true);
    vi.setSystemTime(Date.now() + SETTINGS_KEEP_MS + 1);
    setHidden(false);
    await fetchMonstersEnabled();
    expect(tableReads()).toBe(2);
  });

  it('straight after each teacher save from this device', async () => {
    const saves: [string, () => Promise<unknown>][] = [
      ['teacher_set_maths_auto', () => saveMathsAuto(true)],
      ['teacher_set_clans', () => saveClansEnabled(true)],
      ['teacher_clans_new_season', () => startClansNewSeason('NEW SEASON')],
      ['teacher_set_lord', () => saveLordSettings({ enabled: true })],
      ['teacher_set_monsters', () => saveMonstersSettings({ enabled: true, topics: [] })],
      ['teacher_set_multiplayer', () => setMultiplayer(false)],
      ['teacher_set_space_reactions', () => setSpaceReactions(true)],
      ['teacher_set_space_maths', () => setSpaceMaths('off')],
      ['teacher_set_gem_keep', () => saveGemKeepSettings(DEFAULT_SETTINGS)],
    ];
    await fetchMonstersEnabled();
    for (const [name, save] of saves) {
      const before = tableReads();
      await save().catch(() => {});
      expect(rpc).toHaveBeenLastCalledWith(name, expect.anything());
      await fetchMonstersEnabled();
      expect(tableReads(), name).toBe(before + 1);
    }
  });

  it('when a read was on its way as it was forgotten, the old answer is not kept', async () => {
    let finish: (v: unknown) => void = () => {};
    read.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const old = fetchMonstersEnabled();
    await setMultiplayer(true);
    finish({ data: { ...ROW, monsters_enabled: false }, error: null });
    expect(await old).toBe(false);
    expect(await fetchMonstersEnabled()).toBe(true);
    expect(tableReads()).toBe(2);
  });

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
