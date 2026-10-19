import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}));

import { fetchStudentsChooseFocus, readSettings, saveStudentsChooseFocus } from './classSettings';
import { clearMyFocus, endFocus, extendFocus, fetchFocuses, fetchMyFocus, saveMyFocus, setFocus, tryFetchMyFocus } from './focus';
import { FriendlyError } from './profile';

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe('a student\'s focus', () => {
  const server = { source: 'teacher-class', skills: ['tables-6-9'], onlyThese: false, endsAt: '2099-01-01T00:00:00Z', canChoose: false, own: null };

  it('asks the database for it and reads it safely', async () => {
    rpc.mockResolvedValue({ data: server, error: null });
    expect(await fetchMyFocus()).toMatchObject({ source: 'teacher-class', skills: ['tables-6-9'], canChoose: false });
    expect(rpc).toHaveBeenCalledWith('my_maths_focus');
  });

  it('counts anything odd as auto, so a game never waits or breaks', async () => {
    rpc.mockResolvedValue({ data: { source: 'hacked', skills: ['<script>'] }, error: null });
    expect((await fetchMyFocus()).source).toBe('auto');
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
    expect((await fetchMyFocus()).source).toBe('auto');
    rpc.mockRejectedValue(new Error('offline'));
    expect((await fetchMyFocus()).source).toBe('auto');
  });

  it('between levels, a failed lookup is an error (so the game keeps the focus it has)', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
    await expect(tryFetchMyFocus()).rejects.toBeInstanceOf(FriendlyError);
    rpc.mockRejectedValue(new Error('offline'));
    await expect(tryFetchMyFocus()).rejects.toThrow();
  });

  it('saves their own choice and goes back to auto', async () => {
    rpc.mockResolvedValue({ data: { source: 'student', skills: ['facts-10'], onlyThese: true, endsAt: null, canChoose: true, own: { skills: ['facts-10'], onlyThese: true } }, error: null });
    expect(await saveMyFocus(['facts-10'], true)).toMatchObject({ source: 'student', onlyThese: true });
    expect(rpc).toHaveBeenCalledWith('set_my_maths_focus', { skills: ['facts-10'], only_these: true });
    rpc.mockResolvedValue({ data: { source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: true, own: null }, error: null });
    expect((await clearMyFocus()).source).toBe('auto');
    expect(rpc).toHaveBeenLastCalledWith('clear_my_maths_focus');
  });

  it('shows the database\'s own words when the teacher has turned choosing off, and plain ones otherwise', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Your teacher has turned off choosing your own maths focus.' } });
    await expect(saveMyFocus(['facts-10'], false)).rejects.toThrow('Your teacher has turned off choosing your own maths focus.');
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for table x' } });
    await expect(saveMyFocus(['facts-10'], false)).rejects.toThrow('We couldn’t save that. Please try again.');
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'secret details' } });
    await expect(saveMyFocus(['facts-10'], false)).rejects.toThrow('We couldn’t save that. Please try again.');
  });
});

describe('a teacher\'s focuses', () => {
  it('sets one for a class, a group or students', async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    expect(await setFocus({ classId: 'c1', scope: 'student', targets: ['s1', 's2'], skills: ['facts-10'], onlyThese: true, length: 'friday' })).toBe(2);
    expect(rpc).toHaveBeenCalledWith('teacher_set_maths_focus', {
      target_class: 'c1', scope: 'student', targets: ['s1', 's2'], skills: ['facts-10'], only_these: true, length: 'friday', custom: null,
    });
    await setFocus({ classId: 'c1', scope: 'class', targets: ['ignored'], skills: ['facts-10'], onlyThese: false, length: 'custom', custom: '2099-01-01T00:00:00Z' });
    expect(rpc).toHaveBeenLastCalledWith('teacher_set_maths_focus', expect.objectContaining({ targets: null, length: 'custom', custom: '2099-01-01T00:00:00Z' }));
  });

  it('shows the database\'s words for a refusal', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'That isn\'t one of your classes.' } });
    await expect(setFocus({ classId: 'c1', scope: 'class', targets: [], skills: ['facts-10'], onlyThese: false, length: 'week' })).rejects.toThrow('That isn\'t one of your classes.');
  });

  it('lists, extends and ends', async () => {
    rpc.mockResolvedValue({ data: [{ batch: 'b1' }], error: null });
    expect(await fetchFocuses('c1', true)).toEqual([{ batch: 'b1' }]);
    expect(rpc).toHaveBeenCalledWith('teacher_maths_focuses', { target_class: 'c1', include_ended: true });
    rpc.mockResolvedValue({ data: '2099-01-01T00:00:00Z', error: null });
    expect(await extendFocus('b1', 'week')).toBe('2099-01-01T00:00:00Z');
    expect(rpc).toHaveBeenLastCalledWith('teacher_extend_maths_focus', { batch: 'b1', length: 'week', custom: null });
    rpc.mockResolvedValue({ data: 2, error: null });
    await endFocus('b1');
    expect(rpc).toHaveBeenLastCalledWith('teacher_end_maths_focus', { batch: 'b1' });
  });

  it('fails kindly', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'secret' } });
    await expect(fetchFocuses(null)).rejects.toThrow('We couldn’t load the focuses.');
    await expect(endFocus('b1')).rejects.toThrow('We couldn’t end that focus.');
    await expect(extendFocus('b1', 'week')).rejects.toThrow('We couldn’t extend that focus.');
  });
});

describe('reading the settings of one class', () => {
  it('reads the one row that applies to me straight from the table when no class is picked', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { students_choose_focus: false }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    from.mockReturnValue({ select });
    expect(await readSettings(['students_choose_focus'])).toEqual({ students_choose_focus: false });
    expect(from).toHaveBeenCalledWith('app_settings');
    expect(select).toHaveBeenCalledWith('*'); // the whole row, shared by every switch for 5 minutes
    expect(await fetchStudentsChooseFocus()).toBe(false);
  });

  it('asks the database for a picked class\'s row', async () => {
    rpc.mockResolvedValue({ data: { students_choose_focus: false, space_maths: 'on' }, error: null });
    expect(await readSettings(['space_maths'], 'c1')).toMatchObject({ space_maths: 'on' });
    expect(rpc).toHaveBeenCalledWith('teacher_class_settings', { target_class: 'c1' });
    expect(from).not.toHaveBeenCalled();
  });

  it('gives null when it cannot be read, and the switch counts as on', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no' } });
    expect(await readSettings(['space_maths'], 'c1')).toBeNull();
    expect(await fetchStudentsChooseFocus('c1')).toBe(true);
  });

  it('saves the switch for the picked class', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await saveStudentsChooseFocus(false, 'c1');
    expect(rpc).toHaveBeenCalledWith('teacher_set_students_choose_focus', { enabled: false, target_class: 'c1' });
    await saveStudentsChooseFocus(true);
    expect(rpc).toHaveBeenLastCalledWith('teacher_set_students_choose_focus', { enabled: true, target_class: null });
    rpc.mockResolvedValue({ data: null, error: { message: 'no' } });
    await expect(saveStudentsChooseFocus(true, 'c1')).rejects.toThrow('no');
  });
});
