import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { FoundationalClass, GameProgress } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { PupilSteps } from './PupilSteps';

vi.mock('../../data/foundational', async (orig) => ({ ...(await orig<typeof import('../../data/foundational')>()), foundationalClass: async () => data }));
vi.mock('../foundational/alerts', () => ({ enabledGames: async () => ['robin', 'pipi'] }));

const recent = (day: string) => [{ day, wrong: 0, taps: 8, level: 3 }];
const day = new Date().toISOString().slice(0, 10);
const robin: GameProgress = {
  daysDone: 2,
  lastDay: day,
  level: 3,
  good: null,
  since: day,
  recent: recent(day),
  moves: [
    { from: 3, to: 4, day: '2026-11-06', estimated: false },
    { from: 2, to: 3, day: '2026-11-03', estimated: true },
  ],
};
const student = (id: string): MapStudent => ({ id, name: id, realName: null, ladder: {} as MapStudent['ladder'], enabledTables: undefined, division: false, facts: [] });
const data: FoundationalClass = {
  map: { classId: 'c', className: '3B', yearLevel: 3, auto: false, students: [student('a'), student('b')] },
  pupils: new Map([['a', { games: { robin }, quickLooks: null }]]),
};

const show = (id: string) =>
  render(
    <MemoryRouter>
      <PupilSteps classId="c" studentId={id} />
    </MemoryRouter>,
  );

describe('PupilSteps', () => {
  it('shows three filled boxes and the step name for a pupil on Robin step 3 of 6', async () => {
    const { container } = show('a');
    expect(await screen.findByText('Step 3 of 6: Give 6 to 10')).toBeTruthy();
    const row = container.querySelector('[data-state]')!;
    expect(row.querySelectorAll('.pupil-steps__box').length).toBe(6);
    expect(row.querySelectorAll('.pupil-steps__box--on').length).toBe(3);
    expect(row.querySelectorAll('.pupil-steps__box--current').length).toBe(1);
    expect(screen.getByText('Not played yet')).toBeTruthy(); // Pipi
  });

  it('says when the pupil last moved up, and gives a small timeline', async () => {
    const { container } = show('a');
    expect(await screen.findByText(/up to step 4 on 6 Nov/)).toBeTruthy();
    expect(container.querySelector('.pupil-steps__timeline')?.textContent).toBe('step 3 about 3 Nov → step 4 on 6 Nov');
  });

  it('says Not played yet for a pupil with no Robin row', async () => {
    show('b');
    await waitFor(() => expect(screen.getAllByText('Not played yet').length).toBe(2));
  });
});
