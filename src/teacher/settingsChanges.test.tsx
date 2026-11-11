import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { SettingToggle } from './Settings';
import { describeChange } from './RecentChanges';
import { changedLine, parseChanges, useChangedLine, whenText } from '../data/settingsChanges';
import { forgetSettings } from '../data/settingsMemory';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));

afterEach(() => {
  rpc.mockReset();
  forgetSettings();
});

const NOW = new Date('2026-11-12T03:00:00Z'); // 4pm, 12 Nov, in Auckland
const ME = '00000000-0000-0000-0000-0000000000a1';

  it('says who changed a setting and when, under the switch, and in Recent changes', async () => {
    const mine = { id: 1, at: '2026-11-11T20:12:00Z', by: ME, who: 'tane', setting: 'pipi_enabled', from: true, to: false };
    expect(whenText(mine.at, NOW)).toBe('9:12am');
    expect(changedLine(mine, ME, NOW)).toBe('Changed by you, 9:12am');
    expect(changedLine({ ...mine, by: 'someone-else', at: '2026-11-10T20:12:00Z' }, ME, NOW)).toBe('Changed by tane, yesterday');
    expect(changedLine(undefined, ME, NOW)).toBeUndefined();
    expect(parseChanges([{ id: 3, changedAt: 'x', changedBy: null, name: 'Brave Kiwi 3', realName: '', setting: 'a', oldValue: 1, newValue: 2 }])[0]).toMatchObject({
      id: 3,
      by: null,
      who: 'Brave Kiwi 3',
    });
    expect(parseChanges(null)).toEqual([]);

    rpc.mockResolvedValue({
      data: [{ id: 1, changedAt: new Date().toISOString(), changedBy: ME, name: 'x', realName: 'tane', setting: 'pipi_enabled', oldValue: true, newValue: false }],
      error: null,
    });
    const auth = { profile: { id: ME, role: 'teacher' } } as unknown as AuthState;
    function Row() {
      const changed = useChangedLine('class-1');
      return <SettingToggle label="Pipi" value={false} changed={changed('pipi_enabled')} save={vi.fn()} />;
    }
    const wrap = (children: ReactNode) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
    render(wrap(<Row />));
    expect(await screen.findByText(/^Changed by you, /)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('teacher_settings_changes', { target_class: 'class-1', max_rows: 200, latest_per_setting: true });

    expect(describeChange({ who: 'tane', setting: 'clans_enabled', from: true, to: false })).toBe('tane turned Clan Quest off');
    expect(describeChange({ who: 'tane', setting: 'question_skips', from: 'on', to: 'limited' })).toBe('tane changed Skip button from On to limited');
    expect(describeChange({ who: 'tane', setting: 'space_maths', from: 'choose', to: 'on' })).toMatch(/changed .* maths from Students choose to On/);
  });
