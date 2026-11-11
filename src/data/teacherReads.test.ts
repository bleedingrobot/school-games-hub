import { beforeEach, expect, it, vi } from 'vitest';

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

it('still counts a failed read as Off in a student’s game (no class named)', async () => {
  for (const { read } of readers) {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'no' } });
    expect(await read()).toBe('off');
  }
});
