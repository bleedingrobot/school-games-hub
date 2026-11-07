import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SoundProvider } from '../../sound';
import { trialBackend } from './backend';
import { KororaGame } from './KororaGame';

const hand = () => document.querySelector('.kr-hand');

describe('Penguin Pairs help', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("guides the very first go to the right number, then shows why after wrong taps: a grey stone and a line, Let's look together, Now you try, then the hand", async () => {
    const trial = trialBackend({ storageKey: 'guide' });
    render(<SoundProvider><KororaGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
    // Double 2: the hand moves from the fish to the right number, 4.
    await waitFor(() => expect(hand()).not.toBeNull(), { timeout: 6000 });
    expect(hand()!.closest('button')!.getAttribute('aria-label')).toBe('4, try this one');
    cleanup();

    // A later day, no hand to start with. One wrong stone greys out and says why; the second wrong stone is "Let's look
    // together" (taps off); then the same go comes back with every stone, and the hand points after two more wrong taps.
    trial.tools.jumpTo(3);
    render(<SoundProvider><KororaGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: /Play/ }));
    const group = await screen.findByRole('group');
    expect(hand()).toBeNull();
    const ask = document.querySelector('.kr-ask')!.textContent!;
    const answer = Number(ask.match(/(\d+)/)![1]);
    const right = String(ask.startsWith('Half') ? answer / 2 : answer * 2);
    const stones = () => [...group.querySelectorAll('button')];
    const wrong = stones().filter((b) => !b.getAttribute('aria-label')!.startsWith(right));
    expect(wrong).toHaveLength(3);
    await userEvent.click(wrong[0]);
    expect(wrong[0]).toBeDisabled();
    expect(wrong[0].className).toContain('kr-choice--grey');
    expect(document.querySelector('.kr-why')).toHaveTextContent(/\w/);
    expect(document.querySelector('.kr-why--look')).toBeNull();
    await userEvent.click(wrong[1]);
    expect(document.querySelector('.kr-why--look')).toHaveTextContent('Let’s look together.');
    await userEvent.click(wrong[2]); // taps are off while Bella explains
    expect(wrong[2]).not.toBeDisabled();
    await waitFor(() => expect(document.querySelector('.kr-why--try')).toHaveTextContent('Now you try.'), { timeout: 16000 });
    expect(stones().every((b) => !b.hasAttribute('disabled'))).toBe(true);
    expect(hand()).toBeNull();
    await userEvent.click(stones().find((b) => !b.getAttribute('aria-label')!.startsWith(right))!);
    expect(document.querySelector('.kr-why--look')).toBeNull();
    expect(document.querySelector('.kr-why')).not.toHaveTextContent('Now you try.'); // a wrong stone shows why again
    expect(hand()).toBeNull();
    await userEvent.click(stones().find((b) => !b.hasAttribute('disabled') && !b.getAttribute('aria-label')!.startsWith(right))!);
    expect(hand()!.closest('button')!.getAttribute('aria-label')).toBe(`${right}, try this one`);
  }, 40000);
});
