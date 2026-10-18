import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassDetail } from '../data/classes';
import { FriendlyError } from '../data/profile';
import * as skillMap from '../data/skillMap';
import { LADDER } from '../../shared/maths/ladder';
import { newStats } from '../../shared/maths/leitner';
import { NO_LADDER } from '../../shared/maths/place';
import { FocusHistory, studentsOf } from './FocusHistory';

vi.mock('../data/skillMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/skillMap')>()),
  fetchFocusHistory: vi.fn(),
  fetchClassMap: vi.fn(),
  fetchFocusResults: vi.fn(),
}));

const member = (id: string, name: string, group: string | null) => ({
  id,
  name,
  realName: null,
  avatar: {},
  hidden: false,
  joinedAt: '2026-10-01T00:00:00Z',
  group,
});
const detail: ClassDetail = {
  id: 'c12',
  name: 'Room 12',
  schoolYear: 2026,
  yearLevel: 5,
  archived: false,
  warpCode: 'X',
  warpMode: 'on',
  members: [member('s1', 'Speedy Otter 27', 'Kea'), member('s2', 'Brave Kiwi 7', null), member('s3', 'Calm Fern 3', 'Kea')],
  groups: [{ id: 'g1', name: 'Kea', warpCode: 'Y', warpMode: 'on', members: 2 }],
  teachers: [],
};
const batch = (over: Partial<skillMap.HistoryBatch> = {}): skillMap.HistoryBatch => ({
  batch: 'b1',
  scope: 'class',
  targets: [],
  skills: ['facts-10'],
  onlyThese: false,
  startsAt: '2026-10-12T00:00:00Z',
  endsAt: '2026-10-16T11:00:00Z',
  createdAt: '2026-10-12T00:00:00Z',
  status: 'ended',
  setBy: 'Wise Owl 1',
  setByReal: 'mr.teacher',
  ...over,
});
const keys = LADDER.find((s) => s.id === 'facts-10')!.keys;
const mapOf = (): skillMap.ClassMap => ({
  classId: 'c12',
  className: 'Room 12',
  yearLevel: 5,
  auto: true,
  students: [
    {
      id: 's1',
      name: 'Speedy Otter 27',
      realName: null,
      ladder: { ...NO_LADDER, on: true },
      enabledTables: undefined,
      division: true,
      facts: keys.map((k) => ({
        ...newStats(k),
        attempts: 3,
        correct: 3,
        box: 3,
      })),
    },
    {
      id: 's2',
      name: 'Brave Kiwi 7',
      realName: null,
      ladder: { ...NO_LADDER, on: true },
      enabledTables: undefined,
      division: true,
      facts: [],
    },
    {
      id: 's3',
      name: 'Calm Fern 3',
      realName: null,
      ladder: { ...NO_LADDER, on: true },
      enabledTables: undefined,
      division: true,
      facts: [],
    },
  ],
});

beforeEach(() => {
  vi.mocked(skillMap.fetchFocusHistory).mockReset();
  vi.mocked(skillMap.fetchClassMap).mockReset();
  vi.mocked(skillMap.fetchClassMap).mockResolvedValue(mapOf());
});

describe('who a finished focus was for', () => {
  it("is the class, a group's members, or the students named", () => {
    expect(studentsOf(batch(), detail)).toEqual(['s1', 's2', 's3']);
    expect(studentsOf(batch({ scope: 'group', targets: [{ id: 'g1', name: 'Kea' }] }), detail)).toEqual(['s1', 's3']);
    expect(
      studentsOf(
        batch({
          scope: 'student',
          targets: [{ id: 's2', name: 'Brave Kiwi 7' }],
        }),
        detail,
      ),
    ).toEqual(['s2']);
    expect(studentsOf(batch(), null)).toBeNull();
  });
});

describe('the focus history', () => {
  it('asks for the last 10 weeks by default and for everything when switched', async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([batch()]);
    const user = userEvent.setup();
    render(<FocusHistory classId="c12" detail={detail} now={new Date('2026-10-19T02:00:00Z')} />);
    expect(await screen.findByText(/Whole class/, { selector: 'strong' })).toBeInTheDocument();
    expect(skillMap.fetchFocusHistory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(skillMap.fetchFocusHistory).mock.calls[0][1]?.toISOString()).toBe('2026-08-10T02:00:00.000Z');
    await user.click(screen.getByRole('checkbox', { name: /Show every earlier focus/ }));
    expect(skillMap.fetchFocusHistory).toHaveBeenLastCalledWith('c12', null);
    expect(skillMap.fetchFocusHistory).toHaveBeenCalledTimes(2);
  });

  it('asks once, not again and again, while nothing changes', async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([batch()]);
    render(<FocusHistory classId="c12" detail={detail} />);
    await screen.findByText(/Whole class/, { selector: 'strong' });
    await new Promise((r) => setTimeout(r, 50));
    expect(skillMap.fetchFocusHistory).toHaveBeenCalledTimes(1);
  });

  it('says what was practised, when, for whom and who set it', async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([
      batch({
        scope: 'group',
        targets: [{ id: 'g1', name: 'Kea' }],
        skills: ['tables-6-9', 'facts-10'],
        onlyThese: true,
      }),
      batch({ batch: 'b2', setBy: '', setByReal: 'mr.teacher' }),
    ]);
    render(<FocusHistory classId="c12" detail={detail} />);
    expect(await screen.findByText('Group Kea', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByText(/Number facts to 10 and ×6, ×9/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\(only these\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Mon,? 12 Oct to Sat,? 17 Oct/)).toHaveLength(2);
    expect(screen.getByText(/set by Wise Owl 1/)).toBeInTheDocument();
    expect(screen.getByText(/set by mr\.teacher/)).toBeInTheDocument(); // falls back to the school name when no player name
  });

  it('offers how students did while the focus ran, loaded only when opened', async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([batch()]);
    vi.mocked(skillMap.fetchFocusResults).mockResolvedValue({
      since: new Date('2026-10-01T00:00:00Z'),
      students: [{ id: 's1', name: 'Speedy Otter 27', realName: null, answers: 7, correct: 6, quick: 5 }],
      total: { answers: 7, correct: 6, quick: 5 },
    });
    const user = userEvent.setup();
    render(<FocusHistory classId="c12" detail={detail} />);
    await user.click(await screen.findByText('How they did'));
    expect(skillMap.fetchFocusResults).toHaveBeenCalledWith('b1');
    expect(await screen.findByRole('row', { name: /Speedy Otter 27/ })).toHaveTextContent('7');
  });

  it("shows where each student stands now on the focus's skills, only for those it was for, and only when opened", async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([batch({ scope: 'group', targets: [{ id: 'g1', name: 'Kea' }] })]);
    const user = userEvent.setup();
    render(<FocusHistory classId="c12" detail={detail} />);
    await screen.findByText('Group Kea', { selector: 'strong' });
    expect(skillMap.fetchClassMap).not.toHaveBeenCalled();
    await user.click(screen.getByText('Where they are now on these skills'));
    const table = await screen.findByRole('table', {
      name: 'Where each student is now on the skills of this focus',
    });
    expect(skillMap.fetchClassMap).toHaveBeenCalledTimes(1);
    expect(within(table).getByRole('rowheader', { name: 'Speedy Otter 27' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Calm Fern 3' })).toBeInTheDocument();
    expect(within(table).queryByRole('rowheader', { name: 'Brave Kiwi 7' })).toBeNull(); // not in the group
    expect(within(table).getByRole('row', { name: /Speedy Otter 27/ })).toHaveTextContent('Secure');
    expect(within(table).getByRole('row', { name: /Calm Fern 3/ })).toHaveTextContent('Not started');
  });

  it('says so for an empty 10 weeks and for everything', async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<FocusHistory classId="c12" detail={detail} />);
    expect(await screen.findByText('No focuses have ended in the last 10 weeks.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Show every earlier focus/ }));
    expect(await screen.findByText('No earlier focuses yet.')).toBeInTheDocument();
  });

  it("shows the database's message when it cannot be read", async () => {
    vi.mocked(skillMap.fetchFocusHistory).mockRejectedValue(new FriendlyError('That isn’t one of your classes.'));
    render(<FocusHistory classId="c12" detail={detail} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('That isn’t one of your classes.');
  });
});
