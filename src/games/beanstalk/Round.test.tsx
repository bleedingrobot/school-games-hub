import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAYS_PER_EGG } from '../../../shared/beanstalk/progress';
import { trialBackend } from './backend';
import { BeanstalkGame } from './BeanstalkGame';

describe("Kiwi's Beanstalk play screen", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('shows the sum to make, and the bridge from bonds to 10 only on the first challenge of a new 100 or 1000 beanstalk', async () => {
    localStorage.setItem('beanstalk-voice', 'off');
    const u = userEvent.setup();
    const { backend, tools } = trialBackend({ storageKey: 'round-test' });
    await backend.choose('jack');
    const playAfter = async (daysDone: number) => {
      cleanup();
      tools.jumpTo(daysDone);
      render(<BeanstalkGame backend={backend} />);
      await u.click(await screen.findByRole('button', { name: 'Play' }));
      await screen.findByRole('button', { name: 'Hear it again' });
    };
    const bridge = () => screen.queryByText(/^Each dot is a/);
    const bridge20 = () => screen.queryByText(/^Two ten-frames make 20/);
    const hand = () => screen.queryByRole('button', { name: /try this one/ });

    await playAfter(3);
    expect(screen.getByText('Make 10')).toBeInTheDocument();
    expect(bridge()).toBeNull();
    expect(hand()).toBeNull();

    // The bonds to 20 beanstalk (maths review R8): the hand and a bridge from the ten-frame, using the numbers of the leaf the hand points at.
    await playAfter(DAYS_PER_EGG);
    expect(screen.getByText('Make 20')).toBeInTheDocument();
    const lead = Number(hand()!.getAttribute('aria-label')!.split(',')[0]);
    expect(bridge20()).toHaveTextContent(`Two ten-frames make 20. ${lead} and ${20 - lead} make 20.`);
    expect(bridge()).toBeNull();

    // A new tūī beanstalk: bonds to 100, with the hand and the bridge, using the numbers of the leaf the hand points at.
    await playAfter(2 * DAYS_PER_EGG);
    expect(screen.getByText('Make 100')).toBeInTheDocument();
    const first = Number(hand()!.getAttribute('aria-label')!.split(',')[0]);
    const tens = (n: number) => `${n / 10} ten${n === 10 ? '' : 's'}`;
    expect(bridge()).toHaveTextContent(`Each dot is a ten. ${tens(first)} and ${tens(100 - first)} make 10 tens. That is 100.`);

    // The next day on the same beanstalk: the badge stays, the bridge and hand don't.
    await playAfter(2 * DAYS_PER_EGG + 1);
    expect(screen.getByText('Make 100')).toBeInTheDocument();
    expect(bridge()).toBeNull();
    expect(hand()).toBeNull();

    await playAfter(3 * DAYS_PER_EGG);
    expect(screen.getByText('Make 1000')).toBeInTheDocument();
    expect(bridge()).toHaveTextContent(/^Each dot is a hundred\. \d hundreds? and \d hundreds? make 10 hundreds\. That is 1000\.$/);
  });

  it('shows why after a wrong pair, greys the tried pair, then looks together and asks for the partner (maths review R5)', async () => {
    localStorage.setItem('beanstalk-voice', 'off');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { backend, tools } = trialBackend({ storageKey: 'round-test' });
    await backend.choose('jack');
    tools.jumpTo(3);
    render(<BeanstalkGame backend={backend} />);
    await u.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('button', { name: 'Hear it again' });
    const leaves = () => screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.getAttribute('aria-label') ?? ''));
    const leaf = (n: number) => leaves().find((b) => b.getAttribute('aria-label') === String(n))!;
    const numbers = leaves().map((b) => Number(b.getAttribute('aria-label')));
    const a = numbers.find((n) => n !== 5)!; // a 5's partner is the other 5, which this test's leaf() can't tell apart
    const [w1, w2] = [...new Set(numbers)].filter((n) => n !== a && n + a !== 10);
    const lo = (x: number, y: number) => (x < y ? [x, y] : [y, x]);

    // Wrong pair 1: the line says why, and with the first leaf picked again, the tried leaf can't be tapped.
    await u.click(leaf(a));
    await u.click(leaf(w1));
    const [p, q] = lo(a, w1);
    expect(screen.getByRole('status')).toHaveTextContent(new RegExp(`^${p} and ${q} make ${p + q}\\.`));
    await u.click(leaf(a));
    expect(leaf(w1)).toBeDisabled();
    expect(leaf(w2)).toBeEnabled();

    // Wrong pair 2: "Let's look together" fills the first leaf's frame, then "Now you try" with it still picked.
    await u.click(leaf(w2));
    expect(screen.getByRole('status')).toHaveTextContent("Let's look together.");
    await u.click(leaf(10 - a)); // no taps while it shows
    expect(screen.getByLabelText('0 of 10 pairs')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(12000));
    expect(screen.getByText(`Now you try: what goes with ${a}?`)).toBeInTheDocument();
    expect(leaf(a)).toHaveAttribute('aria-pressed', 'true');
    await u.click(leaf(10 - a));
    expect(screen.getByLabelText('1 of 10 pairs')).toBeInTheDocument();
  });
  it('shows this child’s own dots, and brings the full dots back for the rest of the round after three goes in a row that began with a wrong tap (maths review R6)', async () => {
    localStorage.setItem('beanstalk-voice', 'off');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { backend, tools } = trialBackend({ storageKey: 'round-test' });
    await backend.choose('jack');
    tools.jumpTo(3); // the calendar would say full dots; this child has none
    tools.setHelp(2);
    render(<BeanstalkGame backend={backend} />);
    await u.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('button', { name: 'Hear it again' });
    const frames = () => document.querySelectorAll('.bs-frame--full').length;
    const leaves = () => screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.getAttribute('aria-label') ?? ''));
    const leaf = (n: number) => leaves().find((b) => b.getAttribute('aria-label') === String(n))!;
    expect(frames()).toBe(0);
    for (let go = 1; go <= 3; go++) {
      expect(frames()).toBe(0); // not yet, however many wrong taps there have been in a go
      const shown = leaves().map((b) => Number(b.getAttribute('aria-label')));
      const a = shown.find((n) => n !== 5 && shown.includes(10 - n))!;
      const w = shown.find((n) => n !== a && n !== 10 - a && n !== 5)!;
      await u.click(leaf(a));
      await u.click(leaf(w)); // a wrong first tap
      await u.click(leaf(a));
      await u.click(leaf(10 - a));
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    expect(screen.getByLabelText('3 of 10 pairs')).toBeInTheDocument();
    expect(frames()).toBeGreaterThan(0);
  });
});
