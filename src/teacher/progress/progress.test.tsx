import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationalClass, GameProgress } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { buildTable } from './Progress';
import { buildBoard } from './LadderBoard';
import { ProgressTable } from './ProgressTable';
import { cellState } from './state';
import { stepKeys as hopKeys } from '../../../shared/hop/round';

vi.mock('../../data/foundational', async (orig) => ({ ...(await orig<typeof import('../../data/foundational')>()), foundationalClass: async () => data }));

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
  it('cellState gives stuck, top, quiet and moving, and none when not played', () => {
    expect(cellState('robin', robin.stuck, TODAY)).toMatchObject({ state: 'stuck', daysOnStep: 6, step: { n: 3, of: 6 } });
    expect(cellState('robin', robin.top, TODAY).state).toBe('top');
    expect(cellState('robin', robin.quiet, TODAY).state).toBe('quiet');
    expect(cellState('robin', robin.moving, TODAY)).toMatchObject({ state: 'moving', daysOnStep: 2 });
    expect(cellState('robin', undefined, TODAY).state).toBe('none');
  });

  it('is nearly ready for a step game one good go from passing, not before', () => {
    const days = ['2026-11-10', '2026-11-09'];
    expect(cellState('robin', game(2, days, days[0], { good: 1 }), TODAY)).toMatchObject({ state: 'nearly', step: { n: 2 } });
    expect(cellState('robin', game(2, days, days[0], { good: 0 }), TODAY).state).toBe('moving');
    expect(cellState('robin', game(2, days), TODAY).state).toBe('moving');
    // Stuck and top still win.
    expect(cellState('robin', game(6, days, days[0], { good: 1 }), TODAY).state).toBe('top');
  });

  it('is nearly ready for Hop when 60% of the step\'s facts are secure', () => {
    const days = ['2026-11-10'];
    const keys = hopKeys(10);
    const fact = (key: string, box: number) => ({ key, attempts: 3, correct: 3, avgMs: 900, box, lastSeen: 0, quickDays: [] });
    const enough = keys.map((k, i) => fact(k, i < Math.ceil(keys.length * 0.6) ? 2 : 1));
    const few = keys.map((k, i) => fact(k, i < Math.ceil(keys.length * 0.6) - 1 ? 2 : 1));
    expect(cellState('hop', game(10, days), TODAY, enough).state).toBe('nearly');
    expect(cellState('hop', game(10, days), TODAY, few).state).toBe('moving');
    expect(cellState('hop', game(10, days), TODAY).state).toBe('moving');
  });

  it('counts the days on a step from since, today included', () => {
    expect(cellState('robin', game(2, ['2026-11-10', '2026-11-09'], '2026-11-10', { since: '2026-11-06' }), TODAY).daysOnStep).toBe(6);
    expect(cellState('robin', game(2, ['2026-11-10'], '2026-11-10', { since: '2026-11-06' }), TODAY).state).toBe('stuck');
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
});
