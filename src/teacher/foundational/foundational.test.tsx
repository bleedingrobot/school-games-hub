import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationalClass } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { foundationalAlerts } from './alerts';
import { classRows } from './flags';
import { FoundationalGrid } from './FoundationalGrid';

const student = (id: string, name: string): MapStudent => ({ id, name, realName: null, ladder: {} as MapStudent['ladder'], enabledTables: undefined, division: false, facts: [] });
const names = ['Kiwi Fern', 'Tui Moss', 'Weka Reed', 'Pipi Dune', 'Hoki Bay'];
const stuck = { daysDone: 6, lastDay: '2026-11-06', level: 5, recent: ['02', '03', '04', '05', '06', '09'].map((d) => ({ day: `2026-11-${d}`, wrong: 0, taps: 8, level: 5 })) };
const data: FoundationalClass = {
  map: { classId: 'c', className: '3B', yearLevel: 3, auto: false, students: names.map((n, i) => student(`s${i}`, n)) },
  pupils: new Map(names.map((_, i) => [`s${i}`, { games: { hop: { ...stuck, recent: stuck.recent.map((c, j) => ({ ...c, day: `2026-11-0${j + 1}` })) } }, quickLooks: null }])),
};

vi.mock('../../data/foundational', async (orig) => ({ ...(await orig<typeof import('../../data/foundational')>()), foundationalClass: async () => data }));
vi.mock('../../data/hop', () => ({ fetchHopEnabled: async () => true }));

describe('Foundational grid', () => {
  it('shows each pupil with a mark for every idea, and the Hop alert names made-up pupils and "and N more"', async () => {
    render(<FoundationalGrid rows={classRows(data, '2026-11-09')} className="3B" />);
    expect(screen.getByText('Kiwi Fern')).toBeTruthy();
    expect(screen.getAllByText(/Not started/).length).toBeGreaterThan(0);
    const [alert] = await foundationalAlerts('hop', 'c');
    expect(alert.text).toContain('Hop: 5 pupils on the same step');
    expect(alert.text).toContain('(Kiwi Fern, Tui Moss, Weka Reed and 2 more)');
  });
});
