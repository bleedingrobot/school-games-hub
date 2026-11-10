import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FinishReply } from '../../../shared/beanstalk/server';
import { Finish } from './BeanstalkGame';
import { finishLine } from './voiceLines';
import { WORDS } from './words';

afterEach(cleanup);

const reply = (over: Partial<FinishReply> = {}): FinishReply => ({
  daysDone: 4, lastLeafDay: '2026-11-07', leafChanged: 3, egg: false, firstRight: 9, help: 0, helpMissing: 0, stage: 0, moved: 0, ...over,
});
const show = (result: FinishReply, say = vi.fn()) => render(<Finish result={result} child="jack" say={say} onNext={() => {}} />);

describe("Kiwi's Beanstalk finish words (S33)", () => {
  it('say how the day went, still turn the leaf, and never say well done', async () => {
    const say = vi.fn();
    show(reply({ firstRight: 3, leafChanged: null }), say);
    expect(await screen.findByRole('heading', { name: `${WORDS.how.tricky} ${WORDS.doneToday}` })).toBeTruthy();
    expect(screen.getByText(WORDS.trickyChip)).toBeTruthy();
    expect(say.mock.calls[0][0]).toBe(finishLine([WORDS.how.tricky, WORDS.doneToday], true));
    expect(document.body.textContent).not.toMatch(/well done|so good/i);
    cleanup();
    show(reply({ firstRight: 10 }));
    expect(await screen.findByRole('heading', { name: `${WORDS.how.most} ${WORDS.leafTurned('bronze')}` })).toBeTruthy();
    expect(screen.queryByText(WORDS.trickyChip)).toBeNull();
  });
});
