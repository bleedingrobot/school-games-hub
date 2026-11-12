import { render, screen, waitFor, within } from '@testing-library/react';
import { Suspense } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router';
import { teacherRoutes } from '../App';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import * as classes from '../data/classes';
import * as skillMap from '../data/skillMap';
import { LADDER } from '../../shared/maths/ladder';
import { newStats, type FactStats } from '../../shared/maths/leitner';
import { NO_LADDER } from '../../shared/maths/place';

vi.mock('../data/classes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/classes')>()),
  fetchClasses: vi.fn(),
}));
vi.mock('../data/skillMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/skillMap')>()),
  fetchClassMap: vi.fn(),
}));

// The teacher pages load lazily: on a busy machine the first one can take longer than findBy's usual second.

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

async function show(auth: AuthState = teacher, url = '/skills') {
  // The teacher pages load when opened (dashboard plan D7): wait for them before looking.
  const view = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[url]}>
        <Suspense fallback={<p data-page-loading>Loading…</p>}>
          <Routes>{teacherRoutes()}</Routes>
        </Suspense>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  await waitFor(() => expect(document.querySelector('[data-page-loading]')).toBeNull(), { timeout: 10_000 });
  return view;
}

beforeEach(() => {
  sessionStorage.clear(); // the teacher pages remember the last class for the visit
  vi.mocked(classes.fetchClasses).mockResolvedValue([room12, room14]);
  vi.mocked(skillMap.fetchClassMap).mockReset();
  vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([ana(), ben()]));
});

describe('the skill map', () => {
  it('is for teachers; shows the skills in use on one line per pupil; a cell opens a side panel with focus links', async () => {
    const first = await show(student);
    expect(screen.getByRole('heading', { name: 'Teachers only' })).toBeInTheDocument();
    expect(skillMap.fetchClassMap).not.toHaveBeenCalled();
    first.unmount();
    localStorage.clear();

    // A class with no ladder answers is pointed at the Foundational pages.
    vi.mocked(skillMap.fetchClassMap).mockResolvedValueOnce(map([ben()]));
    const empty = await show(teacher, '/teacher/c12/maths/skills');
    const nobody = await screen.findByText(/Nobody in Room 12 has answered ladder maths yet/, {}, { timeout: 5000 });
    expect(within(nobody).getByRole('link', { name: 'Progress' })).toHaveAttribute('href', '/teacher/c12/progress');
    empty.unmount();

    const cara = (id: string) =>
      ana({
        id,
        name: `Calm Tui ${id}`,
        realName: null,
        facts: ['facts-10', 'dbl-half-10', 'ten-and', 'facts-20', 'dbl-half-20'].flatMap((k) => known(k)),
      });
    vi.mocked(skillMap.fetchClassMap).mockResolvedValue(map([ana(), ben(), cara('c1'), cara('c2'), cara('c3')]));
    await show(teacher, '/teacher/c12/maths/skills?pupil=s2');
    const grid = await screen.findByRole('table', {}, { timeout: 5000 });
    // Skills in use: Ana's skills and the next one, short names with class counts; untouched stages fold into one column.
    const head = within(grid).getByRole('columnheader', { name: /Doubles and halves to 10/ });
    expect(head).toHaveAttribute('title', 'Doubles and halves to 10');
    expect(head).toHaveTextContent('Doubles, halves 10');
    expect(head).toHaveTextContent('4 of 5');
    expect(within(grid).queryByRole('columnheader', { name: /Rounding to the nearest 10 and 100/ })).toBeNull();
    expect(within(grid).getByRole('button', { name: /Rounding.*nobody yet/ })).toBeInTheDocument();
    expect(within(grid).queryByRole('link', { name: /Set focus/ })).toBeNull();
    expect(within(grid).getByRole('rowheader', { name: /Speedy Otter 27/ })).toHaveTextContent('ana');
    // ?pupil= (from the Students tab) lights up that row and opens nothing.
    expect(
      within(grid)
        .getByRole('rowheader', { name: /Brave Kiwi 7/ })
        .closest('tr'),
    ).toHaveAttribute('data-marked');
    expect(screen.queryByRole('dialog')).toBeNull();

    // Who needs a look: most of the class is 3 skills past Ana and Brave Kiwi; the pill keeps only those two, in the address too.
    await userEvent.click(screen.getByRole('button', { name: '2 behind the class' }));
    expect(screen.getByText(/Showing 2 of 5/)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByRole('rowheader', { name: /Calm Tui/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'all');
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: /Rounding to the nearest 10 and 100/ })).toBeInTheDocument();
    expect(localStorage.getItem('skill-map-show')).toBe('all');

    const cell = screen.getByRole('button', { name: /Speedy Otter 27, Doubles and halves to 10: Fluent/ });
    await userEvent.click(cell);
    const panel = screen.getByRole('dialog', { name: /Speedy Otter 27: Doubles and halves to 10/ });
    expect(within(panel).getByRole('link', { name: /Set a focus for Speedy/ })).toHaveAttribute(
      'href',
      '/teacher/c12/maths?student=s1&skill=dbl-half-10',
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    // By skill (iPad portrait, phones): one card per skill, name chips open the same panel; the choice is kept.
    await userEvent.click(screen.getByRole('button', { name: 'By skill' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(localStorage.getItem('skill-map-view')).toBe('skill');
    await userEvent.click(
      within(screen.getAllByRole('region')[0]).getAllByRole('button', { name: /Speedy Otter 27|Brave Kiwi|Calm Tui/ })[0],
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
