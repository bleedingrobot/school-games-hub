import { render, screen} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FoundationalClass, GameProgress } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { buildTable, columnGames} from './Progress';
import Progress from './Progress';
import { buildBoard } from './LadderBoard';
import { ProgressTable } from './ProgressTable';

vi.mock('../TeacherClass', () => ({ useTeacherClass: () => ({ current: { id: 'c', name: '3B' } }) }));
vi.mock('../foundational/alerts', () => ({ enabledGames: async () => ['robin'] }));
vi.mock('../../data/foundational', async (orig) => ({ ...(await orig<typeof import('../../data/foundational')>()), foundationalClass: async () => data }));

// Two stand-in games: one names `progressColumns` (Pupil top has played, Pupil moving was last here a month ago), one doesn't.
const { withColumns, withoutColumns } = vi.hoisted(() => {
  const cells = new Map([
    ['s1', { value: 7, lastPlayed: '2026-11-10T01:00:00Z' }],
    ['s3', { value: 4, lastPlayed: '2026-10-01T01:00:00Z' }],
  ]);
  const base = { name: 'Level Game', tagline: '', colours: ['#000', '#000'] as [string, string], Icon: () => null, Play: () => null };
  return {
    withColumns: { ...base, id: 'level-game', teacher: { progressColumns: { note: 'level passed', useCells: () => cells } } },
    withoutColumns: { ...base, id: 'plain-game', name: 'Plain Game', teacher: {} },
  };
});
vi.mock('../../games/registry', () => ({ GAMES: [withColumns, withoutColumns] }));

const TODAY = '2026-11-11';
const rounds = (level: number, days: string[]) => days.map((day) => ({ day, wrong: 0, taps: 8, level }));
const game = (level: number, days: string[], lastDay = days[0], extra: Partial<GameProgress> = {}): GameProgress => ({ daysDone: days.length, lastDay, level, good: null, since: null, ...extra, recent: rounds(level, days) });
const student = (id: string, name: string): MapStudent => ({ id, name, realName: `${id}.x`, ladder: {} as MapStudent['ladder'], enabledTables: undefined, division: false, facts: [] });

const robin = {
  stuck: game(3, ['2026-11-10', '2026-11-09', '2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03']),
  top: game(6, ['2026-11-10', '2026-11-09']),
  quiet: game(2, ['2026-10-20', '2026-10-19']),
  moving: game(2, ['2026-11-10', '2026-11-09']),
};
const names = Object.keys(robin) as (keyof typeof robin)[];
const data: FoundationalClass = {
  map: { classId: 'c', className: '3B', yearLevel: 3, auto: false, students: names.map((n, i) => student(`s${i}`, `Pupil ${n}`)) },
  pupils: new Map(names.map((n, i) => [`s${i}`, { games: { robin: robin[n] }, quickLooks: null }])),
};

describe('Progress', () => {
  // The page works out "today" from the clock: pin it to TODAY (NZ time) so the stand-in data never goes stale.
  beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date(`${TODAY}T01:00:00Z`) }));
  afterAll(() => vi.useRealTimers());

  it('shows a row for each pupil and a column only for games that are on', () => {
    const { columns, rows } = buildTable(data, ['robin'], TODAY);
    render(
      <MemoryRouter>
        <ProgressTable classId="c" columns={columns} rows={rows} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Student', 'Robin6 steps']);
    expect(screen.queryByText(/Hop/)).toBeNull();
    expect(screen.getAllByText('6d')).toHaveLength(1);
    expect(screen.getAllByText('★')).toHaveLength(2);
    expect(screen.getAllByText('zz')).toHaveLength(2);
  });

  it('the board puts pupils in the right step column, and pupils with no progress in Not started', () => {
    const mk = (vals: number[], g: 'hop' | 'robin'): FoundationalClass => ({
      map: { ...data.map, students: [...vals.map((_, i) => student(`p${i}`, `P${i}`)), student('none', 'Nobody')] },
      pupils: new Map(vals.map((v, i) => [`p${i}`, { games: { [g]: game(v, ['2026-11-10']) }, quickLooks: null }])),
    });
    const hop = buildBoard(mk([10, 5, 2, 3, 4, 200], 'hop'), 'hop', TODAY);
    expect(hop.map((c) => c.label)).toEqual(['Not started', 'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6']);
    expect(hop.map((c) => c.pupils.map((p) => p.name))).toEqual([['Nobody'], ['P0'], ['P1'], ['P2'], ['P3'], ['P4'], ['P5']]);
    const robinBoard = buildBoard(mk([1, 2, 3, 4, 5, 6], 'robin'), 'robin', TODAY);
    expect(robinBoard.map((c) => c.pupils.map((p) => p.name))).toEqual([['Nobody'], ['P0'], ['P1'], ['P2'], ['P3'], ['P4'], ['P5']]);
    expect(robinBoard[3].sub).toBe('Give 6 to 10');
  });

  it('a game with progressColumns gets an Other games column with its number and zz, and a game without gets none', async () => {
    expect(columnGames([withColumns, withoutColumns] as never).map((g) => g.id)).toEqual(['level-game']);
    const { columns, rows } = buildTable(data, ['robin'], TODAY, [{ id: 'level-game', name: 'Level Game', note: 'level passed', cells: withColumns.teacher.progressColumns.useCells() }]);
    expect(columns.map((c) => c.id)).toEqual(['robin', 'level-game']);
    expect(rows.map((r) => r.cells['level-game'].state)).toEqual(['none', 'moving', 'none', 'quiet']);
    render(
      <MemoryRouter initialEntries={['/teacher/c/progress']}>
        <Progress />
      </MemoryRouter>,
    );
    await screen.findByText('Pupil stuck');
    // The Other games column comes in once its cells have loaded, which can be after the pupils show on a busy machine.
    expect(await screen.findByRole('columnheader', { name: /Level Game/ })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Other games' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /Plain Game/ })).toBeNull();
    expect(await screen.findByRole('link', { name: /Pupil top, Level Game: 7 level passed/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Pupil moving, Level Game: 4 level passed, not played for 10 school days/ })).toBeTruthy();
  });
});
