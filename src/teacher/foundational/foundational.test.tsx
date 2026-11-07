import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationalClass } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { parseQuickLooksStudent } from '../../data/foundational';
import { foundationalAlerts, quickLooksAlerts } from './alerts';
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

describe('Foundational grid, stage 2', () => {
  it('opens a cell: pressing it hands back the pupil and the idea', () => {
    const onPick = vi.fn();
    render(<FoundationalGrid rows={classRows(data, '2026-11-09')} className="3B" picked={null} onPick={onPick} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Kiwi Fern, Bonds to 10: Not started/ })[0]);
    expect(onPick).toHaveBeenCalledWith({ student: 's0', idea: 'bonds-10' });
  });

  it('the Quick looks alert counts pupils under 60% right on the last 20 pictures, with made-up names', async () => {
    const quick = { finished: 2, placed: true, guided: false, sessions: 3, answered: 20, correct: 8, last30: 25, lastDay: '2026-11-06' };
    const withQuick: FoundationalClass = { ...data, pupils: new Map(names.slice(0, 2).map((_, i) => [`s${i}`, { games: {}, quickLooks: quick }])) };
    const lone = vi.spyOn(await import('../../data/foundational'), 'foundationalClass').mockResolvedValue(withQuick);
    const [alert] = await quickLooksAlerts('c');
    lone.mockRestore();
    expect(alert.text).toBe('Quick looks: 2 pupils under 60% right on their last 20 pictures (Kiwi Fern, Tui Moss)');
    expect(alert.section).toBe('maths/foundational');
  });

  it('reads a pupil\'s Quick looks panel: finished stages, setting, recent accuracy (not helped ones), and "not used"', () => {
    const answers = [
      { key: 'sub:five-3', correct: true, at: 1 },
      { key: 'sub:five-4', correct: false, at: 2 },
      { key: 'subh:five-4', correct: false, at: 3 },
    ];
    const q = parseQuickLooksStudent({ answers, student: { typing: { q: { p: 1, s: 1, f: 3, g: 1, v: 2 } }, sessionsDone: 4 } }, 20);
    expect(q).toMatchObject({ used: true, finished: 3, guided: true, sessions: 4, answered: 2, correct: 1 });
    expect(parseQuickLooksStudent({ answers: [], student: null }, 20).used).toBe(false);
  });
});
