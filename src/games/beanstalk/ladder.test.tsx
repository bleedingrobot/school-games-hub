import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAYS_PER_EGG } from '../../../shared/beanstalk/progress';
import type { FactStats } from '../../../shared/maths/leitner';
import { trialBackend } from './backend';
import { BeanstalkGame } from './BeanstalkGame';
import { sumSecure, type Signpost } from './signpost';

const leaves = () => screen.getAllByRole('button').filter((b) => /^\d+(, try this one)?$/.test(b.getAttribute('aria-label') ?? ''));
const value = (b: HTMLElement) => Number(b.getAttribute('aria-label')!.split(',')[0]);

/** Makes one right pair: the leaf already picked (a missing-leaf go) and its partner, or any two leaves that make the sum. */
async function makePair(u: ReturnType<typeof userEvent.setup>, target: number) {
  const all = leaves();
  const picked = all.find((b) => b.getAttribute('aria-pressed') === 'true');
  const a = picked ?? all.find((x) => all.some((y) => y !== x && value(x) + value(y) === target))!;
  const b = all.find((y) => y !== a && value(a) + value(y) === target)!;
  if (!picked) await u.click(a);
  await u.click(b);
  await act(() => vi.advanceTimersByTimeAsync(1000));
}

async function start(daysDone: number, signpost?: Signpost) {
  localStorage.setItem('beanstalk-voice', 'off');
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const { backend, tools } = trialBackend({ storageKey: 'ladder-test' });
  await backend.choose('jack');
  tools.jumpTo(daysDone);
  render(<BeanstalkGame backend={backend} signpost={signpost} />);
  await u.click(await screen.findByRole('button', { name: 'Play' }));
  await screen.findByRole('button', { name: 'Hear it again' });
  return u;
}

describe('the missing leaf and the what’s-next card (maths review R8)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('picks one leaf of the 4th pair for the child and asks "7 + ? = 10", then says "So 10 take 7 is 3" once the missing leaf is tapped', async () => {
    const u = await start(3);
    for (let go = 0; go < 3; go++) {
      expect(screen.getByText('Make 10')).toBeInTheDocument(); // the first three goes are the usual two taps
      expect(leaves().some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(false);
      await makePair(u, 10);
    }
    expect(screen.getByLabelText('3 of 10 pairs')).toBeInTheDocument();
    const anchor = leaves().find((b) => b.getAttribute('aria-pressed') === 'true')!;
    const a = value(anchor);
    expect(screen.getByText(`${a} + ? = 10`)).toBeInTheDocument();
    await u.click(anchor); // the picked leaf is not the answer, and a tap on it does nothing
    expect(anchor).toHaveAttribute('aria-pressed', 'true');
    await u.click(leaves().find((b) => value(b) === 10 - a && b !== anchor)!);
    expect(screen.getByLabelText('4 of 10 pairs')).toBeInTheDocument();
    expect(screen.getByText(`So 10 take ${a} is ${10 - a}.`)).toBeInTheDocument();
  });

  it('shows the card to Weka on the finish screen only when Weka is on, the sum is bonds to 20 or more, and its pairs are secure', async () => {
    const open = vi.fn();
    const card = () => screen.queryByRole('heading', { name: 'You know your pairs. Use them to add across ten.' });
    for (const [name, days, wekaOn, secure, shown] of [
      ['all three', DAYS_PER_EGG, true, true, true],
      ['Weka off', DAYS_PER_EGG, false, true, false],
      ['pairs not secure', DAYS_PER_EGG, true, false, false],
      ['bonds to 10 (the game’s own next step first)', 3, true, true, false],
    ] as const) {
      const target = days === DAYS_PER_EGG ? 20 : 10;
      const u = await start(days, { wekaOn, secure: async () => secure, open });
      for (let go = 0; go < 10; go++) await makePair(u, target);
      await screen.findByRole('heading', { name: /Well done/ });
      await act(() => vi.advanceTimersByTimeAsync(200));
      expect(card() !== null, name).toBe(shown);
      if (shown) {
        await u.click(screen.getByRole('button', { name: 'Try Weka' }));
        expect(open).toHaveBeenCalledTimes(1);
      }
      cleanup();
      localStorage.clear();
    }
  });

  it('calls a sum secure when at least 70 percent of its facts are at box 2 or more', () => {
    const fact = (key: string, box: number): FactStats => ({ key, attempts: 5, correct: 4, avgMs: 2000, box, lastSeen: 0, quickDays: [] });
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `bond20:${n}+${20 - n}`);
    expect(sumSecure(keys.map((k, i) => fact(k, i < 7 ? 2 : 1)), 20)).toBe(true); // 7 of 9
    expect(sumSecure(keys.map((k, i) => fact(k, i < 6 ? 2 : 1)), 20)).toBe(false); // 6 of 9
    expect(sumSecure([fact('bond100:tens', 3)], 100)).toBe(true);
    expect(sumSecure([], 100)).toBe(false);
  });
});
