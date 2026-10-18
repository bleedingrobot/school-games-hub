import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classes from '../data/classes';
import * as settings from '../data/classSettings';
import * as focus from '../data/focus';
import * as skillMap from '../data/skillMap';
import { FriendlyError } from '../data/profile';
import SetFocus, { REFRESH_MS, whoFor } from './SetFocus';

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
const student: AuthState = { ...base, profile: { id: 's1', display_name: 'Brave Kiwi 7', avatar: {}, role: 'student' } };

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
  it('is for teachers only', () => {
    show(student);
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(classes.fetchClasses).not.toHaveBeenCalled();
  });

  it('tells a teacher with no class how to start', async () => {
    vi.mocked(classes.fetchClasses).mockResolvedValue([]);
    show();
    expect(await screen.findByText(/You don’t teach a class yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My classes page/ })).toHaveAttribute('href', '/classes');
  });

  it('opens on the first class, or the class in the address', async () => {
    show();
    expect(await screen.findByRole('heading', { name: /Running focuses/ })).toBeInTheDocument();
    expect(classes.fetchClassDetail).toHaveBeenCalledWith('c12');
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveValue('c12');
  });

  it('opens the class named in the address', async () => {
    vi.mocked(classes.fetchClassDetail).mockResolvedValue({ ...detail, id: 'c14', name: 'Room 14' });
    show(base, '/focus?class=c14');
    await screen.findByRole('heading', { name: /Running focuses/ });
    expect(classes.fetchClassDetail).toHaveBeenCalledWith('c14');
    expect(focus.fetchFocuses).toHaveBeenCalledWith('c14');
  });

  it('lists the running focuses with who, what and how long is left', async () => {
    show();
    expect(await screen.findByText(/Whole class: ×6, ×9/)).toBeInTheDocument();
    expect(screen.getByText(/ends in 2 days/)).toBeInTheDocument();
    expect(screen.getByText(/Speedy Otter 27, Brave Kiwi 7: Number facts to 10 and Doubles and halves to 10/)).toBeInTheDocument();
    expect(screen.getByText('Only these')).toBeInTheDocument();
    expect(screen.getByText(/ends in 40 minutes \(for another 40 minutes\)/)).toBeInTheDocument();
  });

  it('says so when nothing is running', async () => {
    vi.mocked(focus.fetchFocuses).mockResolvedValue([]);
    show();
    expect(await screen.findByText(/None running/)).toBeInTheDocument();
  });

  it('ends a focus now', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'End now: Whole class' }));
    expect(focus.endFocus).toHaveBeenCalledWith('b1');
    expect(await screen.findByText(/Ended: Whole class go back/)).toBeInTheDocument();
    expect(focus.fetchFocuses).toHaveBeenCalledTimes(2);
  });

  it('extends a focus to a week, or to a time picked in New Zealand time', async () => {
    const user = userEvent.setup();
    show();
    const [extend] = await screen.findAllByRole('button', { name: 'Extend' });
    await user.click(extend);
    await user.click(screen.getByRole('button', { name: 'Extend it' }));
    expect(focus.extendFocus).toHaveBeenLastCalledWith('b1', 'week', undefined);
    expect(await screen.findByText(/It now runs/)).toBeInTheDocument();
    await user.click((await screen.findAllByRole('button', { name: 'Extend' }))[0]);
    await user.click(within(screen.getByRole('group', { name: 'Run it until…' })).getByRole('radio', { name: /Pick a time/ }));
    await user.click(screen.getByRole('button', { name: 'Extend it' }));
    expect(focus.extendFocus).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Pick a date and time first.')).toBeInTheDocument();
    await user.type(within(screen.getByRole('group', { name: 'Run it until…' })).getByLabelText('Ends at (New Zealand time)'), '2099-10-23T15:30');
    await user.click(screen.getByRole('button', { name: 'Extend it' }));
    expect(focus.extendFocus).toHaveBeenLastCalledWith('b1', 'custom', '2099-10-23T02:30:00.000Z');
  });

  it('shows why an extension was refused', async () => {
    vi.mocked(focus.extendFocus).mockRejectedValue(new FriendlyError('That is not longer than it already runs.'));
    const user = userEvent.setup();
    show();
    await user.click((await screen.findAllByRole('button', { name: 'Extend' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Extend it' }));
    expect(await screen.findByText('That is not longer than it already runs.')).toBeInTheDocument();
  });

  it('looks again by itself, so a focus that has ended drops off', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show();
    await screen.findByText(/Whole class: ×6, ×9/);
    vi.mocked(focus.fetchFocuses).mockResolvedValue([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS + 100);
    });
    expect(await screen.findByText(/None running/)).toBeInTheDocument();
  });

  it('sets a focus for the whole class until Friday by default', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('heading', { name: 'Set a focus' });
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

  it('sets a focus for a group, with only these skills and a lesson length', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('heading', { name: 'Set a focus' });
    await user.click(screen.getByRole('radio', { name: /A group/ }));
    expect(screen.getByRole('button', { name: 'Set focus' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Number facts to 20/ }));
    expect(screen.getByText('Pick a group.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Group'), 'g1');
    await user.click(screen.getByRole('checkbox', { name: /Only these skills/ }));
    await user.click(screen.getByRole('radio', { name: /This lesson/ }));
    await user.click(screen.getByRole('button', { name: 'Set focus' }));
    expect(focus.setFocus).toHaveBeenCalledWith({
      classId: 'c12', scope: 'group', targets: ['g1'], skills: ['facts-20'], onlyThese: true, length: 'lesson', custom: undefined,
    });
  });

  it('sets a focus for some students, with a time of its own', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('heading', { name: 'Set a focus' });
    await user.click(screen.getByRole('radio', { name: /Some students/ }));
    await user.click(screen.getByRole('checkbox', { name: /Number facts to 10/ }));
    expect(screen.getByText('Pick at least one student.')).toBeInTheDocument();
    const students = within(screen.getByRole('list', { name: 'Students' }));
    await user.click(students.getByRole('checkbox', { name: /Speedy Otter 27/ }));
    await user.click(students.getByRole('checkbox', { name: /Brave Kiwi 7/ }));
    await user.click(screen.getByRole('radio', { name: /Pick a time/ }));
    expect(screen.getByText('Pick an end time.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Ends at (New Zealand time)'), '2099-07-23T15:30');
    await user.click(screen.getByRole('button', { name: 'Set focus' }));
    expect(focus.setFocus).toHaveBeenCalledWith({
      classId: 'c12', scope: 'student', targets: ['s1', 's2'], skills: ['facts-10'], onlyThese: false, length: 'custom', custom: '2099-07-23T03:30:00.000Z',
    });
    expect(await screen.findByText(/Focus set for 2 students/)).toBeInTheDocument();
  });

  it('shows why a focus was refused', async () => {
    vi.mocked(focus.setFocus).mockRejectedValue(new FriendlyError('That student isn’t in this class.'));
    const user = userEvent.setup();
    show();
    await screen.findByRole('heading', { name: 'Set a focus' });
    await user.click(screen.getByRole('checkbox', { name: /Number facts to 10/ }));
    await user.click(screen.getByRole('button', { name: 'Set focus' }));
    expect(await screen.findByText('That student isn’t in this class.')).toBeInTheDocument();
  });

  it('turns the groups option off when the class has none', async () => {
    vi.mocked(classes.fetchClassDetail).mockResolvedValue({ ...detail, groups: [] });
    show();
    await screen.findByRole('heading', { name: 'Set a focus' });
    expect(screen.getByRole('radio', { name: /A group/ })).toBeDisabled();
    expect(screen.getByText(/make a group on the My classes page first/)).toBeInTheDocument();
  });

  it('turns auto (the whole ladder for students with no focus) on and off, for this class only', async () => {
    const user = userEvent.setup();
    show();
    const box = await screen.findByRole('checkbox', { name: /Games pick the maths \(auto\) when there is no focus/ });
    expect(box).not.toBeChecked(); // off unless the teacher turns it on
    expect(settings.fetchMathsAuto).toHaveBeenCalledWith('c12');
    await user.click(box);
    expect(settings.saveMathsAuto).toHaveBeenCalledWith(true, 'c12');
    expect(await screen.findByText(/now pick the maths for students with no focus/)).toBeInTheDocument();
    expect(box).toBeChecked();
    await user.click(box);
    expect(settings.saveMathsAuto).toHaveBeenLastCalledWith(false, 'c12');
    expect(await screen.findByText(/ask the times tables for students with no focus, as before/)).toBeInTheDocument();
  });

  it('says so when the switch could not be saved, and leaves it as it was', async () => {
    const user = userEvent.setup();
    vi.mocked(settings.saveMathsAuto).mockRejectedValue(new Error('Nope.'));
    show();
    const box = await screen.findByRole('checkbox', { name: /Games pick the maths/ });
    await user.click(box);
    expect(await screen.findByText(/Something went wrong|Nope/)).toBeInTheDocument();
    expect(box).not.toBeChecked();
  });

  it('turns students choosing their own focus off and on, for this class', async () => {
    const user = userEvent.setup();
    show();
    const box = await screen.findByRole('checkbox', { name: 'Students can choose their own focus' });
    expect(box).toBeChecked();
    await user.click(box);
    expect(settings.saveStudentsChooseFocus).toHaveBeenCalledWith(false, 'c12');
    expect(await screen.findByText(/Students can’t choose their own focus/)).toBeInTheDocument();
    expect(box).not.toBeChecked();
  });

  it('shows this term\'s history by default, and every earlier focus when asked', async () => {
    const ended: skillMap.HistoryBatch = {
      batch: 'old', scope: 'class', targets: [], skills: ['tables-2-5-10'], onlyThese: false, startsAt: '2026-10-05T00:00:00Z',
      endsAt: '2026-10-09T11:00:00Z', createdAt: '2026-10-05T00:00:00Z', status: 'ended', setBy: 'Wise Owl 1', setByReal: 'mr.teacher',
    };
    vi.mocked(skillMap.fetchFocusHistory).mockImplementation(async (_c, since) => (since ? [ended] : [ended, { ...ended, batch: 'older', skills: ['facts-10'] }]));
    const user = userEvent.setup();
    show();
    expect(await screen.findByText(/Whole class/, { selector: 'strong' })).toBeInTheDocument();
    expect(skillMap.fetchFocusHistory).toHaveBeenLastCalledWith('c12', expect.any(Date));
    expect(screen.getByText(/set by Wise Owl 1/)).toBeInTheDocument();
    expect(screen.getByText(/Mon,? 5 Oct to Sat,? 10 Oct/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Show every earlier focus/ }));
    expect(skillMap.fetchFocusHistory).toHaveBeenLastCalledWith('c12', null);
    expect(await screen.findAllByText(/Whole class/, { selector: 'strong' })).toHaveLength(2);
  });

  it('says so when no focus has ended this term', async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([]);
    show();
    expect(await screen.findByText('No focuses have ended this term.')).toBeInTheDocument();
  });

  it('opens with a student and a skill already ticked when the skill map sends you here', async () => {
    show(base, '/focus?class=c12&student=s1&skill=tables-6-9');
    expect(await screen.findByRole('radio', { name: 'Some students' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Speedy Otter 27/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Speedy Otter 27/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /×6, ×9/ })).toBeChecked();
  });

  it('ticks only a skill for the whole class when the link names no student, and ignores a name it does not know', async () => {
    show(base, '/focus?class=c12&skill=facts-10&student=nobody');
    expect(await screen.findByRole('radio', { name: 'The whole class' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Number facts to 10/ })).toBeChecked();
  });

  it('ignores a skill that is not on the ladder', async () => {
    show(base, '/focus?class=c12&skill=../../etc');
    expect(await screen.findByRole('radio', { name: 'The whole class' })).toBeChecked();
    expect(screen.getAllByRole('checkbox', { checked: true }).filter((b) => /Number facts|×/.test(b.getAttribute('aria-label') ?? b.parentElement?.textContent ?? ''))).toHaveLength(0);
  });
});

describe('who a focus is for', () => {
  it('says it in words', () => {
    expect(whoFor(classFocus)).toBe('Whole class');
    expect(whoFor({ ...classFocus, scope: 'group', targets: [{ id: 'g1', name: 'Kea' }] })).toBe('Group Kea');
    expect(whoFor({ ...classFocus, scope: 'group', targets: [{ id: 'g1', name: 'Kea' }, { id: 'g2', name: 'Tūī' }] })).toBe('Groups Kea, Tūī');
    const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => ({ id: n, name: n }));
    expect(whoFor({ ...classFocus, scope: 'student', targets: six })).toBe('A, B, C, D and 2 more');
  });
});
