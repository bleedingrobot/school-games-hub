import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classes from '../data/classes';
import { MyClasses } from './MyClasses';

vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  fetchMySchool: vi.fn(),
  fetchClasses: vi.fn(),
  fetchClassDetail: vi.fn(),
  fetchClassEvents: vi.fn(),
  fetchWarpRequests: vi.fn(),
  fetchUnassigned: vi.fn(),
  fetchSchoolTeachers: vi.fn(),
  createClass: vi.fn(),
  archiveClass: vi.fn(),
  addToClass: vi.fn(),
  moveStudent: vi.fn(),
  removeFromClass: vi.fn(),
  addCoTeacher: vi.fn(),
  removeCoTeacher: vi.fn(),
  setWarpMode: vi.fn(),
  resetWarpCode: vi.fn(),
  answerWarp: vi.fn(),
  updateClass: vi.fn(),
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
  setGroupMember: vi.fn(),
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
  members: 2, teaching: true, groups: 1, waiting: 1,
};
const room14: classes.ClassSummary = { ...room12, id: 'c14', name: 'Room 14', warp_code: 'CDFGH', members: 0, groups: 0, waiting: 0 };

const detail: classes.ClassDetail = {
  id: 'c12', name: 'Room 12', schoolYear: 2026, yearLevel: 5, archived: false, warpCode: 'KM4TP', warpMode: 'on',
  members: [
    { id: 's1', name: 'Speedy Otter 27', realName: 'ana', avatar: {}, hidden: false, joinedAt: '2026-10-18T01:00:00Z', group: 'Kea', groupId: 'g1' },
    { id: 's2', name: 'Brave Kiwi 7', realName: 'ben', avatar: {}, hidden: true, joinedAt: '2026-10-18T01:00:00Z', group: null },
  ],
  groups: [{ id: 'g1', name: 'Kea', warpCode: 'QRTVW', warpMode: 'on', members: 1 }],
  teachers: [{ id: 't1', name: 'Wise Owl 1', realName: 'mr.teacher' }],
};

function show(auth: AuthState = base) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <MyClasses />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(classes.fetchMySchool).mockResolvedValue({ id: 1, name: 'Douglas Park School', admin: false });
  vi.mocked(classes.fetchClasses).mockResolvedValue([room12, room14]);
  vi.mocked(classes.fetchClassDetail).mockResolvedValue(detail);
  vi.mocked(classes.fetchClassEvents).mockResolvedValue([
    { id: 2, at: new Date().toISOString(), kind: 'joined-group', student_name: 'Speedy Otter 27', group_name: 'Kea' },
    { id: 1, at: new Date().toISOString(), kind: 'joined', student_name: 'Brave Kiwi 7', group_name: null },
  ]);
  vi.mocked(classes.fetchWarpRequests).mockResolvedValue([
    { id: 'r1', class_id: 'c12', class_name: 'Room 12', group_name: null, student_name: 'Calm Fox 2', asked_at: new Date().toISOString() },
    { id: 'r2', class_id: 'c14', class_name: 'Room 14', group_name: null, student_name: 'Other Owl 9', asked_at: new Date().toISOString() },
  ]);
  vi.mocked(classes.fetchUnassigned).mockResolvedValue([
    { id: 's3', display_name: 'Quick Tui 3', real_name: 'cat', avatar: {} },
    { id: 's4', display_name: 'Zippy Gecko 4', real_name: 'dan', avatar: {} },
  ]);
  vi.mocked(classes.fetchSchoolTeachers).mockResolvedValue([
    { id: 't1', display_name: 'Wise Owl 1', real_name: 'mr.teacher' },
    { id: 't2', display_name: 'Calm Fox 2', real_name: 'ms.other' },
  ]);
  for (const fn of [classes.createClass, classes.archiveClass, classes.addToClass, classes.moveStudent, classes.removeFromClass,
    classes.addCoTeacher, classes.removeCoTeacher, classes.setWarpMode, classes.resetWarpCode, classes.answerWarp,
    classes.updateClass, classes.createGroup, classes.renameGroup, classes.deleteGroup, classes.setGroupMember]) {
    vi.mocked(fn).mockReset();
  }
  vi.mocked(classes.createClass).mockResolvedValue('c99');
  vi.mocked(classes.addToClass).mockResolvedValue(2);
  vi.mocked(classes.resetWarpCode).mockResolvedValue('JKMNP');
});

afterEach(() => vi.useRealTimers());

describe('My classes', () => {
  it('shows the live "joined" list and who is waiting, and answers a request', async () => {
    const user = userEvent.setup();
    show();
    const log = await screen.findByRole('log', { name: 'Recent warps' });
    expect(within(log).getByText('Speedy Otter 27 joined Kea')).toBeInTheDocument();
    expect(within(log).getByText('Brave Kiwi 7 joined')).toBeInTheDocument();
    // Only this class's request, not the other class's.
    expect(screen.getByText('Calm Fox 2')).toBeInTheDocument();
    expect(screen.queryByText('Other Owl 9')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, let Calm Fox 2 in' }));
    expect(classes.answerWarp).toHaveBeenCalledWith('r1', true);
  });
});
