import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationalClass } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { parseQuickLooksStudent } from '../../data/foundational';
import { foundationalAlerts, quickLooksAlerts } from './alerts';
import { GAMES } from './config';
import { keyWords } from './ideas';
import { stepName as pigeonStep } from '../../../shared/pigeon/round';
import { stepName as lizardStep } from '../../../shared/lizard/round';
import { stepName as swamphenStep } from '../../../shared/swamphen/round';
import { stepName as parrotStep, TOP_STEP as PARROT_TOP } from '../../../shared/parrot/config';
import { stepName as robinStep, TOP_STEP as ROBIN_TOP } from '../../../shared/robin/config';
import { TOP_STEP as PIGEON_TOP } from '../../../shared/pigeon/config';
import { TOP_STEP as LIZARD_TOP } from '../../../shared/lizard/config';
import { TOP_STEP as SWAMPHEN_TOP } from '../../../shared/swamphen/config';
import { GAME_IDS } from '../../data/foundational';
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
vi.mock('../../data/robin', () => ({ fetchRobinEnabled: async () => true }));

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

  it("says a pupil's usual Quick looks slip only once it was seen three times, with one away ahead of too many or too few", () => {
    const wrong = (key: string, given: number, at: number) => ({ key, given, correct: false, at });
    const over = [wrong('sub:five-3', 5, 1), wrong('sub:five-4', 7, 2), wrong('sub:five-4', 9, 3)];
    expect(parseQuickLooksStudent({ answers: over, student: null }, 20).slip).toBe('over');
    const under = [wrong('sub:five-4', 1, 1), wrong('sub:five-4', 2, 2), wrong('sub:five-5', 1, 3)];
    expect(parseQuickLooksStudent({ answers: under, student: null }, 20).slip).toBe('under');
    const near = [wrong('sub:five-3', 4, 1), wrong('sub:five-4', 3, 2), wrong('sub:five-4', 5, 3)];
    expect(parseQuickLooksStudent({ answers: near, student: null }, 20).slip).toBe('near');
    expect(parseQuickLooksStudent({ answers: over.slice(0, 2), student: null }, 20).slip).toBeNull();
    // A wrong answer given with help does not count.
    expect(parseQuickLooksStudent({ answers: over.map((a) => ({ ...a, key: a.key.replace('sub:', 'subh:') })), student: null }, 20).slip).toBeNull();
  });
});

describe('the five newer games in the teacher view (S17)', () => {
  it('names every step of every newer game and has the real top step', () => {
    const real = { pigeon: [PIGEON_TOP, pigeonStep], parrot: [PARROT_TOP, parrotStep], lizard: [LIZARD_TOP, lizardStep], swamphen: [SWAMPHEN_TOP, swamphenStep], robin: [ROBIN_TOP, robinStep] } as const;
    for (const [id, [top, name]] of Object.entries(real)) {
      expect(GAME_IDS).toContain(id);
      const words = GAMES[id as keyof typeof GAMES];
      expect(words.top).toBe(top);
      for (let step = 1; step <= top; step++) expect(words.levels[step], `${id} step ${step}`).toBe(name(step as never));
    }
  });

  it('says "Robin: 5 pupils on the same step" when five pupils sit on step 3 for 5 or more days', async () => {
    const on3 = { daysDone: 6, lastDay: '2026-11-06', level: 3, recent: ['02', '03', '04', '05', '06', '09'].map((d) => ({ day: `2026-11-${d}`, wrong: 0, taps: 8, level: 3 })) };
    const robin: FoundationalClass = { ...data, pupils: new Map(names.map((_, i) => [`s${i}`, { games: { robin: on3 }, quickLooks: null }])) };
    const spy = vi.spyOn(await import('../../data/foundational'), 'foundationalClass').mockResolvedValue(robin);
    const [alert] = await foundationalAlerts('robin', 'c');
    spy.mockRestore();
    expect(alert.text).toContain('Robin: 5 pupils on the same step for 5 or more days');
  });

  it('turns one key of each new family into words', () => {
    const table: [string, string][] = [
      ['place100:n63', 'Place 63 on the line to 100'], ['read1000:n140', 'Read 140 on the line'], ['tens100:-63', '63 \u2212 10'], ['pvbuild:n47', 'Build 47 with bundles'],
      ['pvregroup:b23', 'Tie 23 sticks into bundles'], ['eqmiss:3=1+?', '3 = 1 + ?'], ['eqsub:11=20-?', '11 = 20 \u2212 ?'], ['give:n6', 'Give 6'], ['howmany:n6:ring', 'How many? 6'],
      ['counton:5+1', 'One more than 5'], ['rows:4x6', '4 rows of 6'], ['share:24/4', '24 shared into 4 rows'], ['cut:6x7', 'Cut 6 rows of 7'], ['which:3x5', 'Which picture is 3 rows of 5?'],
    ];
    for (const [key, words] of table) expect(keyWords(key)).toBe(words);
  });
});
