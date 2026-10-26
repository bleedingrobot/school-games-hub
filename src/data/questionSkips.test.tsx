// The class's "Skip button" switch, read for the question box (stage S.3).
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setSkipMode, skipRule, SKIPS_PER_GAME, spendSkip } from '../maths/questionLog';

const readSettings = vi.fn<(columns: string[], classId?: string | null) => Promise<Record<string, unknown> | null>>();
vi.mock('./classSettings', () => ({ readSettings: (columns: string[], classId?: string | null) => readSettings(columns, classId) }));
const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
let profile: { id: string; role: 'student' | 'teacher' } | null = null;
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ profile }) }));

import { fetchSkipMode, parseSkipMode, saveSkipMode, useSkipRuleSync } from './questionSkips';

let go: (to: string) => void = () => {};
function Sync() {
  useSkipRuleSync();
  go = useNavigate();
  return null;
}
const app = () =>
  render(
    <MemoryRouter initialEntries={['/marble']}>
      <Routes>
        <Route path="*" element={<Sync />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  readSettings.mockReset();
  rpc.mockReset();
  profile = null;
});

describe('the Skip button switch', () => {
  it('reads only known modes; anything else is on', () => {
    expect(parseSkipMode('limited')).toBe('limited');
    expect(parseSkipMode('off')).toBe('off');
    expect(parseSkipMode('sometimes')).toBe('on');
    expect(parseSkipMode(undefined)).toBe('on');
  });

  it('hands a student’s class setting to the question box', async () => {
    profile = { id: 's', role: 'student' };
    readSettings.mockResolvedValue({ question_skips: 'off' });
    app();
    await waitFor(() => expect(skipRule()).toEqual({ canSkip: false, left: null }));
    expect(readSettings).toHaveBeenCalledWith(['question_skips'], undefined);
  });

  it('never limits a teacher (and doesn’t even ask)', async () => {
    profile = { id: 't', role: 'teacher' };
    setSkipMode('off');
    app();
    await waitFor(() => expect(skipRule().canSkip).toBe(true));
    expect(readSettings).not.toHaveBeenCalled();
  });

  it('starts the 3 skips again on a new page', async () => {
    profile = { id: 's', role: 'student' };
    readSettings.mockResolvedValue({ question_skips: 'limited' });
    app();
    await waitFor(() => expect(skipRule().left).toBe(SKIPS_PER_GAME));
    spendSkip();
    expect(skipRule().left).toBe(SKIPS_PER_GAME - 1);
    go('/space-game/abc');
    await waitFor(() => expect(skipRule().left).toBe(SKIPS_PER_GAME));
  });

  it('keeps the rule as it was if the settings can’t be read', async () => {
    profile = { id: 's', role: 'student' };
    readSettings.mockResolvedValue(null);
    app();
    await waitFor(() => expect(readSettings).toHaveBeenCalled());
    expect(skipRule()).toEqual({ canSkip: true, left: null });
  });

  it('the teacher page reads and saves it for the picked class', async () => {
    readSettings.mockResolvedValue({ question_skips: 'limited' });
    await expect(fetchSkipMode('room-2')).resolves.toBe('limited');
    expect(readSettings).toHaveBeenCalledWith(['question_skips'], 'room-2');
    readSettings.mockResolvedValue(null);
    await expect(fetchSkipMode('room-2')).rejects.toThrow();
    rpc.mockResolvedValue({ error: null });
    await saveSkipMode('off', 'room-2');
    expect(rpc).toHaveBeenCalledWith('teacher_set_question_skips', { mode: 'off', target_class: 'room-2' });
    rpc.mockResolvedValue({ error: { message: 'no' } });
    await expect(saveSkipMode('on', null)).rejects.toThrow('We couldn’t save that');
  });
});
