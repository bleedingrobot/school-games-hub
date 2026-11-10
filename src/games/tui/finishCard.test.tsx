import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TuiFinish } from './backend';
import { finishLine } from './voiceLines';
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
const parts = [WORDS.how.most, WORDS.flowerTurned('bronze')];

describe('the finish screen’s what’s next card', () => {
  it('shows the card once the top step is secure and Weka is on, reads it after the finish line, and opens Weka', async () => {
    weka.on.mockResolvedValue(true);
    const say = vi.fn((_text: string, onEnd?: () => void) => onEnd?.());
    const onOpenWeka = vi.fn();
    render(<Finish result={result()} say={say} onOpenWeka={onOpenWeka} onNext={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: WORDS.tryWeka }));
    expect(screen.getByText(WORDS.whatsNext)).toBeTruthy();
    expect(say.mock.calls.map((c) => c[0])).toEqual([finishLine(parts, false, 5), WORDS.whatsNext]);
    expect(onOpenWeka).toHaveBeenCalledTimes(1);
  });

  it('shows no card, and asks Weka nothing, until the top step is secure', async () => {
    const say = vi.fn();
    render(<Finish result={result({ topSecure: false })} say={say} onOpenWeka={() => {}} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    expect(screen.queryByRole('button', { name: WORDS.tryWeka })).toBeNull();
    expect(weka.on).not.toHaveBeenCalled();
    expect(say.mock.calls.map((c) => c[0])).toEqual([finishLine(parts, false, 5)]);
  });

  it('shows no card when Weka is switched off for the class', async () => {
    weka.on.mockResolvedValue(false);
    const say = vi.fn();
    render(<Finish result={result()} say={say} onOpenWeka={() => {}} onNext={() => {}} />);
    expect(await screen.findByRole('heading', { name: main })).toBeTruthy();
    expect(screen.queryByRole('button', { name: WORDS.tryWeka })).toBeNull();
    expect(say.mock.calls.map((c) => c[0])).toEqual([finishLine(parts, false, 5)]);
  });
});

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
