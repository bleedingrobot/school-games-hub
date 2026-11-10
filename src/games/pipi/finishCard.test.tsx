import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipiFinish } from './backend';
import { Finish } from './PipiGame';
import { finishLine } from './voiceLines';
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

describe("Pipi's what's next card (Kiwi's Beanstalk)", () => {
  it('shows when the top level is secure and Beanstalk is on, reads after the finish line, and opens Beanstalk', async () => {
    beanstalk.on.mockResolvedValue(true);
    const say = vi.fn((_text: string, onEnd?: () => void) => onEnd?.());
    const open = vi.fn();
    render(<Finish result={result()} say={say} onOpenBeanstalk={open} onNext={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: WORDS.tryBeanstalk }));
    expect(say.mock.calls.map((c) => c[0])).toEqual([finishLine([WORDS.how.most, WORDS.shellTurned('bronze')], false, null), WORDS.whatsNext]);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('shows no card when the top level is not secure, on a level-up day, or when Beanstalk is off', async () => {
    const say = vi.fn();
    render(<Finish result={result({ topSecure: false })} say={say} onOpenBeanstalk={() => {}} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    cleanup();
    render(<Finish result={result({ levelBefore: 2 })} say={say} onOpenBeanstalk={() => {}} onNext={() => {}} />);
    expect(await screen.findByText(WORDS.levelUp(3))).toBeTruthy();
    expect(beanstalk.on).not.toHaveBeenCalled();
    cleanup();
    beanstalk.on.mockResolvedValue(false);
    render(<Finish result={result()} say={say} onOpenBeanstalk={() => {}} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    expect(screen.queryByRole('button', { name: WORDS.tryBeanstalk })).toBeNull();
  });
});
