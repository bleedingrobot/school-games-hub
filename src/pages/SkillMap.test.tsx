import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classes from '../data/classes';
import { FriendlyError } from '../data/profile';
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
const student: AuthState = {
  ...teacher,
  profile: {
    id: 's1',
    display_name: 'Brave Kiwi 7',
    avatar: {},
    role: 'student',
  },
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
  it('is for teachers only', () => {
    show(student);
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(skillMap.fetchClassMap).not.toHaveBeenCalled();
  });

  it('is a table with a row for each student and a column for each of the six stages', async () => {
    show();
    const table = await screen.findByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent ?? '');
    expect(headers.join('|')).toMatch(
      /Student.*On the ladder.*Early number facts.*Times tables.*Place value.*Rounding.*Order of operations.*Fractions, decimals and percentages/,
    );
    expect(within(table).getAllByRole('columnheader')).toHaveLength(8);
    expect(within(table).getByRole('rowheader', { name: /Speedy Otter 27/ })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: /Brave Kiwi 7/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Room 12/ })).toBeInTheDocument();
    expect(skillMap.fetchClassMap).toHaveBeenCalledWith('c12');
  });

  it('shows a real name where teachers already see one, and no year level anywhere', async () => {
    show();
    await screen.findByRole('table');
    expect(screen.getByText('ana')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bYear \d/);
  });

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

  it('says where each student is now and their furthest place, and the warm-up, without years', async () => {
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(
      map([
        ana({
          ladder: {
            ...NO_LADDER,
            on: true,
            placed: 'done',
            placement: 'tables-6-9',
            furthest: 'round-1000',
          },
        }),
        ben({ ladder: { ...NO_LADDER, on: true, placed: 'skipped' } }),
      ]),
    );
    show();
    await screen.findByRole('table');
    const row = screen.getByRole('row', { name: /Speedy Otter 27/ });
    expect(row).toHaveTextContent('Now');
    expect(row).toHaveTextContent('Furthest');
    expect(row).toHaveTextContent('Rounding to the nearest 1000');
    expect(row).toHaveTextContent('Warm-up done');
    expect(screen.getByRole('row', { name: /Brave Kiwi 7/ })).toHaveTextContent('Warm-up skipped');
    expect(document.body.textContent).not.toMatch(/\bYear \d/);
  });

  it('marks the stage a student is working on', async () => {
    show();
    await screen.findByRole('table');
    expect(cellOf('Brave Kiwi 7', 'Early number facts')).toHaveAttribute('data-here', 'true');
    expect(cellOf('Brave Kiwi 7', 'Times tables')).not.toHaveAttribute('data-here');
  });

  it('opens a stage into its skills with a button, from the keyboard too, and closes it again', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    const button = screen.getByRole('button', { name: /Early number facts/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers.join('|')).toContain('Number facts to 10');
    expect(headers.join('|')).toContain('Doubles and halves to 10');
    // A cell for each skill in the stage, with the student and the skill in its name.
    expect(
      screen.getByRole('button', {
        name: /Speedy Otter 27, Number facts to 10: Secure/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Speedy Otter 27, Doubles and halves to 10: Fluent/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Brave Kiwi 7, Number facts to 10: Not started/,
      }),
    ).toBeInTheDocument();
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', {
        name: /Speedy Otter 27, Number facts to 10/,
      }),
    ).toBeNull();
  });

  it('opens and closes every stage at once', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Open every stage' }));
    const built = LADDER.filter((l) => l.built).length;
    expect(screen.getAllByRole('button', { name: /Speedy Otter 27, / })).toHaveLength(built);
    await user.click(screen.getByRole('button', { name: 'Close every stage' }));
    expect(screen.queryAllByRole('button', { name: /Speedy Otter 27, / })).toHaveLength(0);
  });

  it('shows the facts behind a cell for a skill made of question types, and who is in the table', async () => {
    const user = userEvent.setup();
    const types = skill('round-10-100').keys;
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(
      map([
        ana({
          facts: [rec(types[0], 4), { ...rec(types[1], 1), correct: 1, attempts: 4 }],
        }),
        ben(),
      ]),
    );
    show();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /^Rounding/ }));
    await user.click(
      screen.getByRole('button', {
        name: /Speedy Otter 27, Rounding to the nearest 10 and 100: Learning/,
      }),
    );
    const detail = screen.getByRole('region', {
      name: /Speedy Otter 27: Rounding to the nearest 10 and 100/,
    });
    expect(within(detail).getByRole('table', { name: 'Question types' })).toBeInTheDocument();
    expect(within(detail).getAllByRole('row')).toHaveLength(types.length + 1);
    expect(within(detail).getAllByRole('rowheader')).toHaveLength(types.length);
    expect(within(detail).getAllByRole('rowheader')[0]).toHaveTextContent(/Rounding 2-digit numbers to the nearest 10/);
    expect(within(detail).getByText(new RegExp(`2 of ${types.length} asked`))).toBeInTheDocument();
    // The heading takes focus so a keyboard or screen-reader user lands on it.
    expect(
      within(detail).getByRole('heading', {
        name: /Speedy Otter 27: Rounding/,
      }),
    ).toHaveFocus();
  });

  it('opens the 12 × 12 grid for a times-table cell', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /^Times tables/ }));
    await user.click(
      screen.getByRole('button', {
        name: /Speedy Otter 27, Times tables: ×6, ×9: Learning/,
      }),
    );
    const detail = screen.getByRole('region', {
      name: /Speedy Otter 27: Times tables: ×6, ×9/,
    });
    expect(
      within(detail).getByRole('table', {
        name: 'Times tables: how well each fact is known',
      }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByText('6 × 7: Learning, 4 of 4 right', {
        exact: false,
      }),
    ).toBeInTheDocument();
    // Division facts of the table are listed beside the grid.
    expect(within(detail).getByRole('table', { name: 'Division facts' })).toBeInTheDocument();
  });

  it('tapping the same cell again, or closing its stage, closes the detail', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /^Early number facts/ }));
    const cell = screen.getByRole('button', {
      name: /Speedy Otter 27, Number facts to 10: Secure/,
    });
    await user.click(cell);
    expect(cell).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('region', {
        name: /Speedy Otter 27: Number facts to 10/,
      }),
    ).toBeInTheDocument();
    await user.click(cell);
    expect(
      screen.queryByRole('region', {
        name: /Speedy Otter 27: Number facts to 10/,
      }),
    ).toBeNull();
    await user.click(cell);
    await user.click(screen.getByRole('button', { name: /^Early number facts/ }));
    expect(
      screen.queryByRole('region', {
        name: /Speedy Otter 27: Number facts to 10/,
      }),
    ).toBeNull();
  });

  it('leaves out switched-off tables: the cell says so, and is not counted as not started', async () => {
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([ana({ enabledTables: [] })]));
    show();
    await screen.findByRole('table');
    const times = cellOf('Speedy Otter 27', 'Times tables');
    expect(times).toHaveAttribute('data-level', 'off');
    expect(times).toHaveTextContent('Switched off');
  });

  it('links a row and a skill to Set a focus for that student or skill', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    expect(screen.getByRole('link', { name: 'Set focus for Speedy Otter 27' })).toHaveAttribute('href', '/focus?class=c12&student=s1');
    await user.click(screen.getByRole('button', { name: /^Early number facts/ }));
    expect(screen.getByRole('link', { name: 'Set focus on Number facts to 10' })).toHaveAttribute(
      'href',
      '/focus?class=c12&skill=facts-10',
    );
    await user.click(
      screen.getByRole('button', {
        name: /Speedy Otter 27, Number facts to 10/,
      }),
    );
    expect(
      screen.getByRole('link', {
        name: /Set a focus on this for Speedy Otter 27/,
      }),
    ).toHaveAttribute('href', '/focus?class=c12&student=s1&skill=facts-10');
  });

  it('counts how many students are secure at the foot of each column', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    const foot = screen.getAllByRole('row').at(-1)!;
    expect(foot).toHaveTextContent('Secure or fluent');
    expect(foot).toHaveTextContent('0 of 2');
    await user.click(screen.getByRole('button', { name: /^Early number facts/ }));
    expect(screen.getAllByRole('row').at(-1)).toHaveTextContent('1 of 2'); // Number facts to 10 is secure for one of them
  });

  it('says when auto is off for the class, and not when it is on', async () => {
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([ana()], { auto: false }));
    const { unmount } = show();
    expect(await screen.findByText(/Auto is off for this class/)).toBeInTheDocument();
    unmount();
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([ana()], { auto: true }));
    show();
    await screen.findByRole('table');
    expect(screen.queryByText(/Auto is off for this class/)).toBeNull();
  });

  it('picks a class, and asks for the one picked', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([ben()], { classId: 'c14', className: 'Room 14' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Class' }), 'c14');
    expect(await screen.findByRole('heading', { name: /Room 14/ })).toBeInTheDocument();
    expect(skillMap.fetchClassMap).toHaveBeenLastCalledWith('c14');
    expect(screen.queryByRole('rowheader', { name: /Speedy Otter 27/ })).toBeNull();
  });

  it('opens on the class the link names', async () => {
    show(teacher, '/skills?class=c14');
    await screen.findByRole('table');
    expect(skillMap.fetchClassMap).toHaveBeenCalledWith('c14');
  });

  it('says so for a class with no students, and for a teacher with no class', async () => {
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([]));
    const { unmount } = show();
    expect(await screen.findByText(/No students in this class yet/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    unmount();
    vi.mocked(classes.fetchClasses).mockResolvedValue([]);
    show();
    expect(await screen.findByText(/You don’t teach a class yet/)).toBeInTheDocument();
  });

  it("shows the database's message when the map cannot be loaded", async () => {
    vi.mocked(skillMap.fetchClassMap).mockRejectedValue(new FriendlyError('That isn’t one of your classes.'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('That isn’t one of your classes.');
  });

  it('does not keep anything in browser storage', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    show();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /^Early number facts/ }));
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });
});
