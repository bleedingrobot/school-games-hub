import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classes from '../data/classes';
import { ago, eventText, LIVE_MS, MyClasses } from './MyClasses';

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
const student: AuthState = { ...base, profile: { id: 's1', display_name: 'Brave Kiwi 7', avatar: {}, role: 'student' } };

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
  it('is for teachers only', () => {
    show(student);
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(classes.fetchClasses).not.toHaveBeenCalled();
  });

  it('lists the classes with their codes, and opens the first one', async () => {
    show();
    expect(await screen.findByRole('button', { name: /Room 12/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Room 14/ })).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.findByText('KM4 TP', { selector: '.class-panel__code' })).toBeInTheDocument();
    expect(screen.getByText('1 waiting')).toBeInTheDocument();
    expect(screen.getByText('Douglas Park School')).toBeInTheDocument();
  });

  it('makes a class and shows it', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('button', { name: /Room 12/ });
    await user.type(screen.getByLabelText('Class name (optional)'), 'Room 9');
    await user.selectOptions(screen.getByLabelText('Year level (optional)'), '4');
    await user.click(screen.getByRole('button', { name: 'Make class' }));
    expect(classes.createClass).toHaveBeenCalledWith('Room 9', new Date().getFullYear(), 4);
    expect(await screen.findByText(/Class made/)).toBeInTheDocument();
  });

  it('makes a class with no name: the database names it after the teacher\'s email', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('button', { name: /Room 12/ });
    expect(screen.getByRole('button', { name: 'Make class' })).toBeEnabled();
    expect(screen.getByText(/named after your email/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Make class' }));
    expect(classes.createClass).toHaveBeenCalledWith('', new Date().getFullYear(), null);
    expect(await screen.findByText(/Class made/)).toBeInTheDocument();
  });

  it('renames a class', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('KM4 TP', { selector: '.class-panel__code' });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    const box = screen.getByLabelText('Name', { selector: 'input' });
    await user.clear(box);
    await user.type(box, 'Kea Room');
    await user.click(save);
    expect(classes.updateClass).toHaveBeenCalledWith('c12', 'Kea Room', 2026, 5);
    expect(await screen.findByText('Saved. The class is called Kea Room, Year 5.')).toBeInTheDocument();
  });

  it('sets the year level of a class, and clears it', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('KM4 TP', { selector: '.class-panel__code' });
    const level = screen.getByLabelText('Year level', { selector: 'select' });
    await user.selectOptions(level, '4');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(classes.updateClass).toHaveBeenLastCalledWith('c12', expect.any(String), 2026, 4);
    await user.selectOptions(screen.getByLabelText('Year level', { selector: 'select' }), '');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(classes.updateClass).toHaveBeenLastCalledWith('c12', expect.any(String), 2026, null);
  });

  it('links to the maths focus screen for the class', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Choose the maths for this class/ });
    expect(link).toHaveAttribute('href', '/teacher/c12/maths');
  });

  it('makes, renames and deletes groups, and moves a student between them', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('KM4 TP', { selector: '.class-panel__code' });
    // Make
    await user.type(screen.getByLabelText('New group name'), 'Tūī');
    await user.click(screen.getByRole('button', { name: 'Make group' }));
    expect(classes.createGroup).toHaveBeenCalledWith('c12', 'Tūī');
    expect(await screen.findByText(/The Tūī group is made/)).toBeInTheDocument();
    // Rename
    const nameBox = screen.getByLabelText('Name of the Kea group');
    expect(screen.getByRole('button', { name: 'Rename Kea' })).toBeDisabled();
    await user.clear(nameBox);
    await user.type(nameBox, 'Kākā');
    await user.click(screen.getByRole('button', { name: 'Rename Kea' }));
    expect(classes.renameGroup).toHaveBeenCalledWith('g1', 'Kākā');
    // Delete asks first
    await user.click(screen.getByRole('button', { name: 'Delete Kea' }));
    expect(classes.deleteGroup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, delete Kea' }));
    expect(classes.deleteGroup).toHaveBeenCalledWith('g1');
    // A student: in Kea, take out; another goes in
    await user.selectOptions(screen.getByLabelText('Group for Speedy Otter 27'), '');
    expect(classes.setGroupMember).toHaveBeenCalledWith('g1', 's1', false);
    await user.selectOptions(screen.getByLabelText('Group for Brave Kiwi 7'), 'g1');
    expect(classes.setGroupMember).toHaveBeenCalledWith('g1', 's2', true);
  });

  it('turns a code off or to ask-first, and makes a new one only after confirming', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('KM4 TP', { selector: '.class-panel__code' });
    const classMode = screen.getByRole('group', { name: 'What the code does' });
    await user.click(within(classMode).getByRole('radio', { name: /Ask me first/ }));
    expect(classes.setWarpMode).toHaveBeenCalledWith('c12', 'ask');
    await user.click(within(classMode).getByRole('radio', { name: /^Off/ }));
    expect(classes.setWarpMode).toHaveBeenCalledWith('c12', 'off');
    await user.click(screen.getByRole('button', { name: /Make a new code/ }));
    expect(classes.resetWarpCode).not.toHaveBeenCalled();
    expect(screen.getByText(/The old one stops working at once/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, new code' }));
    expect(classes.resetWarpCode).toHaveBeenCalledWith('c12');
    expect(await screen.findByText(/The new code is JKM NP/)).toBeInTheDocument();
  });

  it('controls a group’s code too', async () => {
    const user = userEvent.setup();
    show();
    const groupMode = await screen.findByRole('group', { name: 'What the Kea code does' });
    await user.click(within(groupMode).getByRole('radio', { name: /Off/ }));
    expect(classes.setWarpMode).toHaveBeenCalledWith('c12', 'off', 'g1');
    await user.click(screen.getByRole('button', { name: 'New code for Kea' }));
    expect(classes.resetWarpCode).toHaveBeenCalledWith('c12', 'g1');
  });

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

  describe('looking again for new warps', () => {
    let visibility: DocumentVisibilityState = 'visible';
    const looks = () => vi.mocked(classes.fetchClassEvents).mock.calls.length;
    const pass = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
    const tab = async (now: DocumentVisibilityState) => {
      visibility = now;
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };

    beforeEach(() => {
      visibility = 'visible';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    });
    afterEach(() => {
      delete (document as { visibilityState?: unknown }).visibilityState;
    });

    it('looks again every 30 seconds, not more often', async () => {
      expect(LIVE_MS).toBe(30_000);
      vi.useFakeTimers({ shouldAdvanceTime: true });
      show();
      await screen.findByRole('log', { name: 'Recent warps' });
      const before = looks();
      await pass(20_000);
      expect(looks()).toBe(before);
      await pass(10_100);
      expect(looks()).toBe(before + 1);
      expect(classes.fetchClassDetail).toHaveBeenCalledTimes(before + 1);
      expect(classes.fetchWarpRequests).toHaveBeenCalledTimes(before + 1);
    });

    it("doesn't look while the tab is hidden, and looks straight away when it comes back", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      show();
      await screen.findByRole('log', { name: 'Recent warps' });
      const before = looks();
      await tab('hidden');
      await pass(5 * LIVE_MS);
      expect(looks()).toBe(before);
      await tab('visible');
      expect(looks()).toBe(before + 1);
    });
  });

  it('adds ticked students from the list of students with no class', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('Quick Tui 3');
    const add = screen.getByRole('button', { name: /^Add\s+selected to Room 12/ });
    expect(add).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Quick Tui 3/ }));
    await user.click(screen.getByRole('checkbox', { name: /Zippy Gecko 4/ }));
    await user.click(screen.getByRole('button', { name: /Add 2 selected to Room 12/ }));
    expect(classes.addToClass).toHaveBeenCalledWith('c12', ['s3', 's4']);
    expect(await screen.findByText('Added 2 students to Room 12.')).toBeInTheDocument();
  });

  it('moves a student to another of my classes, and takes one out', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('Move Speedy Otter 27 to');
    const move = screen.getByLabelText('Move Speedy Otter 27 to');
    await user.selectOptions(move, 'c14');
    await user.click(screen.getByRole('button', { name: 'Move Speedy Otter 27' }));
    expect(classes.moveStudent).toHaveBeenCalledWith('s1', 'c14');
    await user.click(screen.getByRole('button', { name: 'Take Brave Kiwi 7 out of the class' }));
    expect(classes.removeFromClass).toHaveBeenCalledWith('s2');
  });

  it('adds and removes a co-teacher', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByLabelText('Add a co-teacher');
    expect(screen.getByRole('option', { name: 'ms.other' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'mr.teacher' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Add a co-teacher'), 't2');
    await user.click(screen.getByRole('button', { name: 'Add teacher' }));
    expect(classes.addCoTeacher).toHaveBeenCalledWith('c12', 't2');
  });

  it('gives only a school admin the archive button, and asks first', async () => {
    const user = userEvent.setup();
    const { unmount } = show();
    await screen.findByText('KM4 TP', { selector: '.class-panel__code' });
    expect(screen.queryByRole('button', { name: /Archive this class/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show archived classes')).not.toBeInTheDocument();
    unmount();
    vi.mocked(classes.fetchMySchool).mockResolvedValue({ id: 1, name: 'Douglas Park School', admin: true });
    show();
    await user.click(await screen.findByRole('button', { name: /Archive this class/ }));
    expect(classes.archiveClass).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, archive it' }));
    expect(classes.archiveClass).toHaveBeenCalledWith('c12', true);
  });

  it('shows a message when the classes cannot be loaded', async () => {
    vi.mocked(classes.fetchClasses).mockRejectedValue(new Error('down'));
    show();
    expect(await screen.findByText(/couldn’t|went wrong/i)).toBeInTheDocument();
  });

  it('tells a teacher with no classes how to start', async () => {
    vi.mocked(classes.fetchClasses).mockResolvedValue([]);
    show();
    expect(await screen.findByText(/You don’t have a class yet/)).toBeInTheDocument();
  });
});

describe('the words on the page', () => {
  it('says what happened in plain words', () => {
    const e = (kind: classes.WarpEventKind, group: string | null = null) => eventText({ id: 1, at: '', kind, student_name: 'Kind Kea 5', group_name: group });
    expect(e('joined')).toBe('Kind Kea 5 joined');
    expect(e('asked', 'Kea')).toBe('Kind Kea 5 asked to join Kea');
    expect(e('moved-out')).toBe('Kind Kea 5 moved to another class');
    expect(e('removed')).toBe('Kind Kea 5 was taken out of the class');
  });

  it('says how long ago', () => {
    const now = Date.parse('2026-10-18T10:00:00Z');
    expect(ago('2026-10-18T09:59:40Z', now)).toBe('just now');
    expect(ago('2026-10-18T09:57:00Z', now)).toBe('3 minutes ago');
    expect(ago('2026-10-18T07:00:00Z', now)).toBe('3 hours ago');
  });
});
