import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classes from '../data/classes';
import * as settings from '../data/classSettings';
import * as focus from '../data/focus';
import * as skillMap from '../data/skillMap';
import SetFocus from './SetFocus';

vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  fetchClasses: vi.fn(),
  fetchClassDetail: vi.fn(),
}));
vi.mock('../data/classSettings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classSettings')>()),
  fetchStudentsChooseFocus: vi.fn(),
  saveStudentsChooseFocus: vi.fn(),
  fetchMathsAuto: vi.fn(),
  saveMathsAuto: vi.fn(),
}));
vi.mock('../data/focus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/focus')>()),
  fetchFocuses: vi.fn(),
  setFocus: vi.fn(),
  extendFocus: vi.fn(),
  endFocus: vi.fn(),
}));

vi.mock('../data/skillMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/skillMap')>()),
  fetchFocusHistory: vi.fn(),
  fetchFocusResults: vi.fn(),
  fetchClassMap: vi.fn(),
}));

const base: AuthState = {
  status: 'signed-in',
  profile: { id: 't1', display_name: 'Wise Owl 1', avatar: {}, role: 'teacher' },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};

const room12: classes.ClassSummary = {
  id: 'c12', name: 'Room 12', school_year: 2026, year_level: 5, archived: false, warp_code: 'KM4TP', warp_mode: 'on',
  members: 3, teaching: true, groups: 1, waiting: 0,
};
const room14: classes.ClassSummary = { ...room12, id: 'c14', name: 'Room 14' };
const detail: classes.ClassDetail = {
  id: 'c12', name: 'Room 12', schoolYear: 2026, yearLevel: 5, archived: false, warpCode: 'KM4TP', warpMode: 'on',
  members: [
    { id: 's1', name: 'Speedy Otter 27', realName: 'ana', avatar: {}, hidden: false, joinedAt: '2026-10-18T01:00:00Z', group: 'Kea', groupId: 'g1' },
    { id: 's2', name: 'Brave Kiwi 7', realName: 'ben', avatar: {}, hidden: false, joinedAt: '2026-10-18T01:00:00Z', group: null },
  ],
  groups: [{ id: 'g1', name: 'Kea', warpCode: 'QRTVW', warpMode: 'on', members: 1 }],
  teachers: [{ id: 't1', name: 'Wise Owl 1', realName: 'mr.teacher' }],
};
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const classFocus: focus.FocusBatch = {
  batch: 'b1', classId: 'c12', className: 'Room 12', scope: 'class', targets: [], skills: ['tables-6-9'], onlyThese: false,
  startsAt: new Date().toISOString(), endsAt: inDays(2), createdAt: new Date().toISOString(), status: 'running',
};
const studentFocus: focus.FocusBatch = {
  ...classFocus, batch: 'b2', scope: 'student', targets: [{ id: 's1', name: 'Speedy Otter 27' }, { id: 's2', name: 'Brave Kiwi 7' }],
  skills: ['facts-10', 'dbl-half-10'], onlyThese: true, endsAt: new Date(Date.now() + 40 * 60_000).toISOString(),
};

function show(auth: AuthState = base, url = '/focus') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[url]}>
        <SetFocus />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(classes.fetchClasses).mockResolvedValue([room12, room14]);
  vi.mocked(classes.fetchClassDetail).mockResolvedValue(detail);
  vi.mocked(settings.fetchStudentsChooseFocus).mockResolvedValue(true);
  vi.mocked(settings.saveStudentsChooseFocus).mockReset();
  vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([]);
  vi.mocked(settings.fetchMathsAuto).mockResolvedValue(false);
  vi.mocked(settings.saveMathsAuto).mockReset();
  vi.mocked(focus.fetchFocuses).mockResolvedValue([classFocus, studentFocus]);
  for (const fn of [focus.setFocus, focus.extendFocus, focus.endFocus]) vi.mocked(fn).mockReset();
  vi.mocked(focus.setFocus).mockResolvedValue(1);
  vi.mocked(focus.extendFocus).mockResolvedValue(inDays(7));
});

afterEach(() => vi.useRealTimers());

describe('the Set focus screen', () => {
  it('sets a focus for the whole class until Friday by default', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('heading', { name: 'Set a focus' }, { timeout: 5000 });
    const button = screen.getByRole('button', { name: 'Set focus' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Pick at least one skill.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Until Friday/ })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /Times tables: ×6, ×9/ }));
    expect(button).toBeEnabled();
    await user.click(button);
    expect(focus.setFocus).toHaveBeenCalledWith({
      classId: 'c12', scope: 'class', targets: [], skills: ['tables-6-9'], onlyThese: false, length: 'friday', custom: undefined,
    });
    expect(await screen.findByText(/Focus set for the whole class: ×6, ×9 until friday/)).toBeInTheDocument();
  });
});
