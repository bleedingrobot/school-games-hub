import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationalClass, GameProgress } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { buildTable } from './Progress';
import { ProgressTable } from './ProgressTable';
import { cellState } from './state';

vi.mock('../../data/foundational', async (orig) => ({ ...(await orig<typeof import('../../data/foundational')>()), foundationalClass: async () => data }));

const TODAY = '2026-11-11';
const rounds = (level: number, days: string[]) => days.map((day) => ({ day, wrong: 0, taps: 8, level }));
const game = (level: number, days: string[], lastDay = days[0]): GameProgress => ({ daysDone: days.length, lastDay, level, recent: rounds(level, days) });
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
  it('cellState gives stuck, top, quiet and moving, and none when not played', () => {
    expect(cellState('robin', robin.stuck, TODAY)).toMatchObject({ state: 'stuck', daysOnStep: 6, step: { n: 3, of: 6 } });
    expect(cellState('robin', robin.top, TODAY).state).toBe('top');
    expect(cellState('robin', robin.quiet, TODAY).state).toBe('quiet');
    expect(cellState('robin', robin.moving, TODAY)).toMatchObject({ state: 'moving', daysOnStep: 2 });
    expect(cellState('robin', undefined, TODAY).state).toBe('none');
  });

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

  it('a cell links to the pupil page with ?game=', () => {
    const { columns, rows } = buildTable(data, ['robin'], TODAY);
    render(
      <MemoryRouter>
        <ProgressTable classId="c" columns={columns} rows={rows} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Pupil stuck, Robin: Step 3 of 6: Give 6 to 10, 6 days on this step, stuck/ });
    expect(link).toHaveAttribute('href', '/teacher/c/students/s0?game=robin');
    expect(within(link).getByText('3')).toBeTruthy();
  });
});
