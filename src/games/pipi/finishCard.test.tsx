import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipiFinish } from './backend';
import { Finish } from './PipiGame';
import { WORDS } from './words';

const beanstalk = vi.hoisted(() => ({ on: vi.fn() }));
vi.mock('../../data/beanstalk', () => ({ fetchBeanstalkEnabled: () => beanstalk.on() }));

afterEach(cleanup);
beforeEach(() => beanstalk.on.mockReset());

const result = (over: Partial<PipiFinish> = {}): PipiFinish => ({
  daysDone: 4, lastShellDay: '2026-11-07', shellChanged: 3, pearl: false, firstRight: 9, level: 3, levelBefore: 3, topSecure: true, ...over,
});
const main = `${WORDS.how.most} ${WORDS.shellTurned('bronze')}`;

describe("Pipi's finish words (S33)", () => {
  it('say how the day went, still turn the shell, and never say well done', async () => {
    render(<Finish result={result({ topSecure: false, firstRight: 3, shellChanged: null })} say={vi.fn()} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: `${WORDS.how.tricky} ${WORDS.doneToday}` })).toBeTruthy();
    expect(screen.getByText(WORDS.trickyChip)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/well done|so good/i);
    cleanup();
    render(<Finish result={result({ topSecure: false, firstRight: 10 })} say={vi.fn()} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    expect(screen.queryByText(WORDS.trickyChip)).toBeNull();
  });
});
