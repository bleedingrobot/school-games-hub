import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAYS_PER_EGG } from '../../../shared/beanstalk/progress';
import { trialBackend } from './backend';
import { BeanstalkGame } from './BeanstalkGame';

describe("Kiwi's Beanstalk play screen", () => {
  beforeEach(() => localStorage.clear());

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
    const hand = () => screen.queryByRole('button', { name: /try this one/ });

    await playAfter(3);
    expect(screen.getByText('Make 10')).toBeInTheDocument();
    expect(bridge()).toBeNull();
    expect(hand()).toBeNull();

    // A new tūī beanstalk: bonds to 100, with the hand and the bridge, using the numbers of the leaf the hand points at.
    await playAfter(DAYS_PER_EGG);
    expect(screen.getByText('Make 100')).toBeInTheDocument();
    const first = Number(hand()!.getAttribute('aria-label')!.split(',')[0]);
    const tens = (n: number) => `${n / 10} ten${n === 10 ? '' : 's'}`;
    expect(bridge()).toHaveTextContent(`Each dot is a ten. ${tens(first)} and ${tens(100 - first)} make 10 tens. That is 100.`);

    // The next day on the same beanstalk: the badge stays, the bridge and hand don't.
    await playAfter(DAYS_PER_EGG + 1);
    expect(screen.getByText('Make 100')).toBeInTheDocument();
    expect(bridge()).toBeNull();
    expect(hand()).toBeNull();

    await playAfter(2 * DAYS_PER_EGG);
    expect(screen.getByText('Make 1000')).toBeInTheDocument();
    expect(bridge()).toHaveTextContent(/^Each dot is a hundred\. \d hundreds? and \d hundreds? make 10 hundreds\. That is 1000\.$/);
  });
});
