import { beforeEach, describe, expect, it, vi } from 'vitest';

// The three maths switches the teacher's Games table reads (Wormholes & Black Holes, Mine Runner, Marble Rush). A teacher's read
// for a named class says when it fails, so the table never shows Off for a setting it couldn't read. A student's game still
// counts a failed read as maths off.
const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({ select: () => ({ maybeSingle: () => maybeSingle() }) }),
  },
}));

import { fetchMarbleSwitches } from './marble';
import { fetchMineMaths } from './mine';
import { forgetSettings } from './settingsMemory';
import { fetchMathsSwitch } from './spaceGames';

const readers = [
  { game: 'Wormholes & Black Holes', column: 'space_maths', read: (c?: string) => fetchMathsSwitch(c) },
  { game: 'Mine Runner', column: 'mine_maths', read: (c?: string) => fetchMineMaths(c) },
  { game: 'Marble Rush', column: 'marble_maths', read: (c?: string) => fetchMarbleSwitches(c).then((s) => s.maths) },
];

beforeEach(() => {
  rpc.mockReset();
  maybeSingle.mockReset();
  forgetSettings();
});

describe.each(readers)('$game maths, read for the teacher’s Games table', ({ column, read }) => {
  it('reads the class’s setting', async () => {
    rpc.mockResolvedValue({ data: { [column]: 'on' }, error: null });
    expect(await read('c12')).toBe('on');
    expect(rpc).toHaveBeenCalledWith('teacher_class_settings', { target_class: 'c12' });
  });

  it('says it couldn’t load, instead of Off, when the class’s settings can’t be read', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'x' } });
    await expect(read('c12')).rejects.toThrow('We couldn’t load this setting.');
  });

  it('still counts a failed read as Off in a student’s game (no class named)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'no' } });
    expect(await read()).toBe('off');
  });
});
