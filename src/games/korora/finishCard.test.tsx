import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KororaFinish } from './backend';
import { Finish } from './KororaGame';
import { WORDS } from './words';


afterEach(cleanup);

const result = (over: Partial<KororaFinish> = {}): KororaFinish => ({
  daysDone: 4, lastPebbleDay: '2026-11-07', pebbleChanged: 3, goldenFish: false, shoesWon: null, firstRight: 9, level: 5, levelBefore: 5, topSecure: true, ...over,
});

describe('the finish words (S33)', () => {
  it('say how the day went, still turn the stone, and never say well done', async () => {
    render(<Finish result={result({ topSecure: false, firstRight: 3, pebbleChanged: null })} say={vi.fn()} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: `${WORDS.how.tricky} ${WORDS.doneToday}` })).toBeTruthy();
    expect(screen.getByText(WORDS.trickyChip)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/well done|so good/i);
    cleanup();
    render(<Finish result={result({ topSecure: false, firstRight: 10 })} say={vi.fn()} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: `${WORDS.how.most} ${WORDS.pebbleTurned('bronze')}` })).toBeTruthy();
    expect(screen.queryByText(WORDS.trickyChip)).toBeNull();
  });
});
