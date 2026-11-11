import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { parseGame, type RecentChallenge } from '../../data/foundational';
import { bySlowest, ProgressTable, type ProgressRow } from './ProgressTable';
import { firstTryOf, firstTryWords, type CellState } from './state';

const round = (extra: Partial<RecentChallenge> = {}): RecentChallenge => ({ day: '2026-11-10', wrong: 2, taps: 12, level: 3, ...extra });

describe('firstTryOf', () => {
  it('gives % right first try (sum f over sum goes) and the median first-tap time', () => {
    // Goes are taps less wrong taps: 10 each. 9 + 6 + 3 right of 30.
    const f = firstTryOf([round({ firstRight: 9, ms: 3000 }), round({ firstRight: 6, ms: 5000 }), round({ firstRight: 3, ms: 2000 })]);
    expect(f).toEqual({ percent: 60, ms: 3000 });
    expect(firstTryOf([round({ ms: 1000 }), round({ ms: 2000 })])).toEqual({ percent: null, ms: 1500 });
  });

  it('counts only the newest 10 rounds, and skips rounds that say nothing', () => {
    const many = [...Array.from({ length: 10 }, () => round({ firstRight: 10 })), round({ firstRight: 0, ms: 9000 })];
    expect(firstTryOf(many)).toEqual({ percent: 100, ms: null });
    expect(firstTryOf([round()])).toBeNull();
    expect(firstTryOf([])).toBeNull();
  });

  it('words it, and says nothing when there is nothing', () => {
    expect(firstTryWords({ percent: 72, ms: 3100 })).toBe('72% right first try · usually 3.1 s');
    expect(firstTryWords({ percent: null, ms: 2000 })).toBe('usually 2.0 s');
    expect(firstTryWords(null)).toBe('');
  });
});

describe('parseGame', () => {
  it('reads f and ms on a round, and leaves them out when absent or odd', () => {
    const g = parseGame({ daysDone: 1, recent: [{ d: '2026-11-10', m: 0, t: 10, l: 1, f: 8, ms: 2500 }, { d: '2026-11-09', m: 0, t: 10, l: 1, ms: 'x' }] })!;
    expect(g.recent[0]).toMatchObject({ firstRight: 8, ms: 2500 });
    expect(g.recent[1].firstRight).toBeUndefined();
    expect(g.recent[1].ms).toBeUndefined();
  });
});

const cell = (ms: number | null): CellState => ({ state: 'moving', step: { n: 1, of: 6, name: '' }, daysOnStep: 1, firstTry: ms === null ? null : { percent: null, ms } });
const row = (name: string, ms: number | null): ProgressRow => ({ id: name, name, realName: null, cells: { robin: cell(ms) } });

describe('Slowest first', () => {
  it('orders by the slowest usual first tap, with pupils who have no time last', () => {
    expect([row('Zed', 1000), row('Amy', null), row('Bo', 4000)].sort(bySlowest).map((r) => r.name)).toEqual(['Bo', 'Zed', 'Amy']);
  });

  it('is a sort button on the table', () => {
    render(
      <MemoryRouter>
        <ProgressTable classId="c" columns={[{ id: 'robin', name: 'Robin', steps: 6 }]} rows={[row('Zed', 1000), row('Bo', 4000)]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Slowest first' })).toBeTruthy();
  });
});
