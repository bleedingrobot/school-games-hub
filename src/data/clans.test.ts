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
    expect(await fetchClassClanMaths('c12')).toEqual({ players: 3, kinds: [], hardest: [] });
    expect(rpc).toHaveBeenCalledWith('teacher_clan_maths_class', { target_class: 'c12' });
  });

  it('says so when the server refuses (a class the teacher doesn’t teach), and asks nothing else', async () => {
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
