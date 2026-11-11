import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { fetchClassClanMaths} from './clans';

beforeEach(() => rpc.mockReset());

describe('Clan Quest’s class report', () => {

  it('says so when the server refuses (a class the teacher doesn’t teach), and asks nothing else', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'That isn’t one of your classes.' } });
    await expect(fetchClassClanMaths('c99')).rejects.toThrow('We couldn’t load the Clan Quest maths records for this class.');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
