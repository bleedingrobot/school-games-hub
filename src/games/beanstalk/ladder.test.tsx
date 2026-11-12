import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { } from '../../../shared/maths/leitner';
import { trialBackend } from './backend';
import { BeanstalkGame } from './BeanstalkGame';
import { type Signpost } from './signpost';

const leaves = () => screen.getAllByRole('button').filter((b) => /^\d+(, try this one)?$/.test(b.getAttribute('aria-label') ?? ''));
const value = (b: HTMLElement) => Number(b.getAttribute('aria-label')!.split(',')[0]);

/** Makes one right pair: the leaf already picked (a missing-leaf go) and its partner, or any two leaves that make the sum. */
async function makePair(u: ReturnType<typeof userEvent.setup>, target: number) {
  if (document.querySelector('.bs-demo-panel')) await act(() => vi.advanceTimersByTimeAsync(4000)); // the first missing-leaf go's demo (show me first) plays out
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

  it('shows the missing leaf first on the very first missing-leaf go (show me first): taps wait, the question follows, and it never plays again', async () => {
    const u = await start(0);
    for (let go = 0; go < 2; go++) await makePair(u, 10);
    expect(document.querySelector('.bs-demo-panel')).not.toBeNull();
    const anchor = leaves().find((b) => b.getAttribute('aria-pressed') === 'true')!;
    await u.click(leaves().find((b) => value(b) === 10 - value(anchor) && b !== anchor)!);
    expect(screen.getByLabelText('2 of 10 pairs')).toBeInTheDocument(); // a tap during the demo is not an answer
    await act(() => vi.advanceTimersByTimeAsync(3500));
    expect(document.querySelector('.bs-demo-panel')).toBeNull();
    await u.click(leaves().find((b) => value(b) === 10 - value(anchor) && b !== anchor)!);
    expect(screen.getByLabelText('3 of 10 pairs')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    for (let go = 3; go < 4; go++) await makePair(u, 10);
    expect(document.querySelector('.bs-demo-panel')).toBeNull(); // the 5th go: no demo this time
    expect(screen.getByText(/\+ \? = 10/)).toBeInTheDocument();
  });

});
