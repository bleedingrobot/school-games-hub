import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TuiFinish } from './backend';
import { Finish } from './TuiGame';
import { WORDS } from './words';

const weka = vi.hoisted(() => ({ on: vi.fn() }));
vi.mock('../../data/weka', () => ({ fetchWekaEnabled: () => weka.on() }));

afterEach(cleanup);
beforeEach(() => weka.on.mockReset());

// The tenth day: the last flower turned bronze, and the top step is not yet passed.
const result = (over: Partial<TuiFinish> = {}): TuiFinish => ({
  daysDone: 10, lastFlowerDay: '2026-11-07', flowerChanged: 9, goldenNest: false, firstRight: 8,
  step: 5, level: 4, stepBefore: 4, levelBefore: 4, kindLevels: {}, topSecure: true, ...over,
});
const main = `${WORDS.how.most} ${WORDS.flowerTurned('bronze')}`;

describe('the finish words (S33)', () => {
  it('say how the day went, still turn the flower, and never say well done', async () => {
    render(<Finish result={result({ topSecure: false, firstRight: 3, flowerChanged: null, step: 4 })} say={vi.fn()} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: `${WORDS.how.tricky} ${WORDS.doneToday}` })).toBeTruthy();
    expect(screen.getByText(WORDS.trickyChip)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/well done|so good/i);
    cleanup();
    render(<Finish result={result({ topSecure: false, firstRight: 10, step: 4 })} say={vi.fn()} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    expect(screen.queryByText(WORDS.trickyChip)).toBeNull();
  });
});
