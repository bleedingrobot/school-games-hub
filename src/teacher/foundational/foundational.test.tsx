import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationalClass } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { parseQuickLooksStudent } from '../../data/foundational';
import { foundationalAlerts, quickLooksAlerts } from './alerts';
import { GAMES, stepOf, stepWords } from './config';
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
import { HOP_STEPS } from '../../../shared/hop/round';
import { LEVELS as KORORA_LEVELS } from '../../../shared/korora/round';
import { LEVELS as PIPI_LEVELS } from '../../../shared/pipi/round';
import { LEVELS as WEKA_LEVELS } from '../../../shared/weka/round';
import { TARGETS } from '../../../shared/beanstalk/round';
import { STEPS as TUI_STEPS } from '../../../shared/tui/round';
import { classRows, tracksOf } from './flags';
import { FoundationalGrid } from './FoundationalGrid';

const student = (id: string, name: string): MapStudent => ({ id, name, realName: null, ladder: {} as MapStudent['ladder'], enabledTables: undefined, division: false, facts: [] });
const names = ['Kiwi Fern', 'Tui Moss', 'Weka Reed', 'Pipi Dune', 'Hoki Bay'];
const stuck = { daysDone: 6, lastDay: '2026-11-06', level: 5, good: null, since: null, recent: ['02', '03', '04', '05', '06', '09'].map((d) => ({ day: `2026-11-${d}`, wrong: 0, taps: 8, level: 5 })) };
const data: FoundationalClass = {
  map: { classId: 'c', className: '3B', yearLevel: 3, auto: false, students: names.map((n, i) => student(`s${i}`, n)) },
  pupils: new Map(names.map((_, i) => [`s${i}`, { games: { hop: { ...stuck, recent: stuck.recent.map((c, j) => ({ ...c, day: `2026-11-0${j + 1}` })) } }, quickLooks: null }])),
};

vi.mock('../../data/foundational', async (orig) => ({ ...(await orig<typeof import('../../data/foundational')>()), foundationalClass: async () => data }));
vi.mock('../../data/hop', () => ({ fetchHopEnabled: async () => true }));
vi.mock('../../data/robin', () => ({ fetchRobinEnabled: async () => true }));

describe('Step words', () => {
  it('every game names every step in its order, and Hop counts in twos as step 3 of 6', () => {
    for (const [id, g] of Object.entries(GAMES)) {
      expect(g.levelWord).toBe('step');
      expect(g.order.length).toBe(Object.keys(g.levels).length);
      for (const v of g.order) expect(g.levels[v], `${id} ${v}`).toBeTruthy();
    }
    expect(stepWords('hop', 2)).toBe('Step 3 of 6: Counting in twos');
    expect(stepOf('hop', 2)).toEqual({ n: 3, of: 6, name: 'Counting in twos' });
    expect(stepWords('beanstalk', 0)).toBe('Step 1 of 4: Bonds to 10');
    expect(stepOf('robin', null)).toBeNull();
  });
});

describe('Foundational grid', () => {
  it('shows each pupil with a mark for every idea, and the Hop alert names made-up pupils and "and N more"', async () => {
    render(<FoundationalGrid rows={classRows(data, '2026-11-09')} className="3B" />);
    expect(screen.getByText('Kiwi Fern')).toBeTruthy();
    expect(screen.getAllByText(/Not started/).length).toBeGreaterThan(0);
    const [alert] = await foundationalAlerts('hop', 'c');
    expect(alert.text).toContain('Hop: 5 pupils on the same step');
    expect(alert.text).toContain('(Kiwi Fern, Tui Moss, Weka Reed and 2 more)');
    expect(alert.section).toBe('progress?show=stuck&game=hop');
  });

  it('keeps flags out of a column: a "! N" button by the name opens the list and closes again', () => {
    render(<FoundationalGrid rows={classRows(data, '2026-11-09')} className="3B" />);
    expect(screen.queryByRole('columnheader', { name: 'Flags' })).toBeNull();
    const button = screen.getAllByRole('button', { name: /flags? for Kiwi Fern/ })[0];
    expect(button).toHaveTextContent(/^! \d+$/);
    expect(screen.queryByRole('region', { name: 'Flags for Kiwi Fern' })).toBeNull();
    fireEvent.click(button);
    expect(screen.getByRole('region', { name: 'Flags for Kiwi Fern' })).toHaveTextContent(/6 days on Step 2/);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Flags for Kiwi Fern' })).toBeNull();
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
    const on3 = { daysDone: 6, lastDay: '2026-11-06', level: 3, good: null, since: null, recent: ['02', '03', '04', '05', '06', '09'].map((d) => ({ day: `2026-11-${d}`, wrong: 0, taps: 8, level: 3 })) };
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

describe('the older games keep up with their longer ladders (S23)', () => {
  it('names every level a child can reach in Hop, Penguin Pairs, Pipi, Tūī and Weka, and top is the last one', () => {
    const reachable = {
      hop: HOP_STEPS.map((s) => s.step as number),
      korora: KORORA_LEVELS.map((l) => l.level as number),
      pipi: PIPI_LEVELS.map((l) => l.level as number),
      tui: TUI_STEPS.map((s) => s.step as number),
      weka: WEKA_LEVELS.map((l) => l.level as number),
      beanstalk: TARGETS.map((_, i) => i),
    };
    for (const [id, levels] of Object.entries(reachable)) {
      const words = GAMES[id as keyof typeof GAMES];
      for (const level of levels) {
        expect(words.levels[level], `${id} level ${level}`).toBeTruthy();
        if (id === 'beanstalk') expect(words.levels[level]).toBe(`Bonds to ${TARGETS[level]}`);
      }
      expect(Object.keys(words.levels).map(Number).sort((a, b) => a - b), id).toEqual([...levels].sort((a, b) => a - b));
      expect(words.top, id).toBe(levels[levels.length - 1]);
    }
  });

  it('shows a Hop pupil on step 200 as top with its name, and one on step 3 with its name and not top', () => {
    const at = (level: number) => tracksOf({ games: { hop: { daysDone: 4, lastDay: '2026-11-06', level, good: null, since: null, recent: [] } }, quickLooks: null }).find((t) => t.id === 'hop')!;
    expect(at(200)).toMatchObject({ levelLabel: 'Step 6 of 6: Counting in tens past 100', top: true });
    expect(at(3)).toMatchObject({ levelLabel: 'Step 4 of 6: Counting in threes', top: false });
  });
});
