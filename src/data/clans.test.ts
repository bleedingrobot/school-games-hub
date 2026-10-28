import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { fetchClassClanMaths, saveClanMathsSettings } from './clans';

beforeEach(() => rpc.mockReset());

describe('Clan Quest’s class report', () => {
  it('asks for the class', async () => {
    rpc.mockResolvedValueOnce({ data: { players: 3, kinds: [], hardest: [] }, error: null });
    expect(await fetchClassClanMaths('c12')).toEqual({ players: 3, kinds: [], hardest: [], wholeSchool: false });
    expect(rpc).toHaveBeenCalledWith('teacher_clan_maths_class', { target_class: 'c12' });
  });

  it('falls back to the whole-school report, and says so, while the database has only the old one', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      .mockResolvedValueOnce({ data: { players: 9, kinds: [], hardest: [] }, error: null });
    expect(await fetchClassClanMaths('c12')).toEqual({ players: 9, kinds: [], hardest: [], wholeSchool: true });
    expect(rpc).toHaveBeenLastCalledWith('teacher_clan_maths_class');
  });

  it('doesn’t fall back for any other error (a class the teacher doesn’t teach)', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'That isn’t one of your classes.' } });
    await expect(fetchClassClanMaths('c99')).rejects.toThrow('We couldn’t load the Clan Quest maths records for this class.');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('saving Clan Quest’s maths settings', () => {
  it('sends only the setting that changed, for the class', async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    await saveClanMathsSettings({ fightsPerDay: 5 }, 'c14');
    expect(rpc).toHaveBeenCalledWith('teacher_set_clan_maths', { settings: { fightsPerDay: 5 }, target_class: 'c14' });
  });

  it('passes on the server’s words when it refuses a value', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'Leave at least one topic on.' } });
    await expect(saveClanMathsSettings({ enabledTopics: [] }, 'c14')).rejects.toThrow('Leave at least one topic on.');
  });
});
