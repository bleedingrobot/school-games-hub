import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classes from '../data/classes';
import * as skillMap from '../data/skillMap';
import { LADDER } from '../../shared/maths/ladder';
import { newStats, type FactStats } from '../../shared/maths/leitner';
import { NO_LADDER } from '../../shared/maths/place';
import SkillMap from './SkillMap';

vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  fetchClasses: vi.fn(),
}));
vi.mock('../data/skillMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/skillMap')>()),
  fetchClassMap: vi.fn(),
}));

const teacher: AuthState = {
  status: 'signed-in',
  profile: {
    id: 't1',
    display_name: 'Wise Owl 1',
    avatar: {},
    role: 'teacher',
  },
  message: null,
  signIn: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
  refreshProfile: vi.fn(async () => {}),
};

const room12: classes.ClassSummary = {
  id: 'c12',
  name: 'Room 12',
  school_year: 2026,
  year_level: 5,
  archived: false,
  warp_code: 'KM4TP',
  warp_mode: 'on',
  members: 2,
  teaching: true,
  groups: 0,
  waiting: 0,
};
const room14: classes.ClassSummary = { ...room12, id: 'c14', name: 'Room 14' };

const skill = (id: string) => LADDER.find((s) => s.id === id)!;
const rec = (key: string, box: number): FactStats => ({
  ...newStats(key),
  attempts: 4,
  correct: 4,
  avgMs: 2400,
  box,
});
const known = (id: string, box = 3) => skill(id).keys.map((k) => rec(k, box));

const ana = (over: Partial<skillMap.MapStudent> = {}): skillMap.MapStudent => ({
  id: 's1',
  name: 'Speedy Otter 27',
  realName: 'ana',
  ladder: { ...NO_LADDER, on: true },
  enabledTables: undefined,
  division: true,
  facts: [
    ...known('facts-10'),
    ...known('dbl-half-10', 4),
    ...skill('tables-6-9')
      .keys.filter((k) => k.startsWith('mul:'))
      .slice(0, 4)
      .map((k) => rec(k, 1)),
  ],
  ...over,
});
const ben = (over: Partial<skillMap.MapStudent> = {}): skillMap.MapStudent => ({
  id: 's2',
  name: 'Brave Kiwi 7',
  realName: null,
  ladder: { ...NO_LADDER, on: true },
  enabledTables: undefined,
  division: true,
  facts: [],
  ...over,
});
const map = (students: skillMap.MapStudent[], over: Partial<skillMap.ClassMap> = {}): skillMap.ClassMap => ({
  classId: 'c12',
  className: 'Room 12',
  yearLevel: 5,
  auto: true,
  students,
  ...over,
});

function show(auth: AuthState = teacher, url = '/skills') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[url]}>
        <SkillMap />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(classes.fetchClasses).mockResolvedValue([room12, room14]);
  vi.mocked(skillMap.fetchClassMap).mockReset();
  vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([ana(), ben()]));
});

const cellOf = (student: string, column: string) => {
  const row = screen.getByRole('row', { name: new RegExp(student) });
  const stage = within(row)
    .getAllByRole('cell')
    .find((c) => new RegExp(column).test(c.textContent ?? ''));
  return stage!;
};

describe('the skill map', () => {
  it('colours a closed stage with how many of its skills are secure, and says it in words and a letter', async () => {
    show();
    await screen.findByRole('table');
    const early = cellOf('Speedy Otter 27', 'Early number facts');
    expect(early).toHaveAttribute('data-level', 'learning'); // 2 of 5 secure: some asked, not all secure
    expect(early).toHaveTextContent('2 of 5');
    expect(early).toHaveTextContent('Learning');
    const times = cellOf('Speedy Otter 27', 'Times tables');
    expect(times).toHaveAttribute('data-level', 'learning');
    const idle = cellOf('Brave Kiwi 7', 'Early number facts');
    expect(idle).toHaveAttribute('data-level', 'not-started');
    expect(idle).toHaveTextContent('Not started');
    // The letter is the same information as the colour.
    expect(early.querySelector('[aria-hidden="true"]')).toHaveTextContent('L');
  });
});
