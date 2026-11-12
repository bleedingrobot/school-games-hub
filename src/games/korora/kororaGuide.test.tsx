import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fastClock } from '../../fastClock';
import { SoundProvider } from '../../sound';
import { trialBackend } from './backend';
import { KororaGame } from './KororaGame';

const hand = () => document.querySelector('.kr-hand');

describe('Penguin Pairs help', () => {
  let stop = () => {};
  beforeEach(() => {
    localStorage.clear();
    stop = fastClock();
  });
  afterEach(() => {
    cleanup();
    stop();
  });

  it("guides the very first go to the right number, then shows why after wrong taps: a grey stone and a line, Let's look together, Now you try one like it, then the hand", async () => {
    const trial = trialBackend({ storageKey: 'guide' });
    render(<SoundProvider><KororaGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
    // Double 2: the hand moves from the fish to the right number, 4.
    await waitFor(() => expect(hand()).not.toBeNull(), { timeout: 6000 });
    expect(hand()!.closest('button')!.getAttribute('aria-label')).toBe('4, try this one');
    cleanup();

    // A later day, no hand to start with. One wrong stone greys out and says why; the second wrong stone is "Let's look
    // together" (taps off); then a sister go (a neighbouring number), and a wrong stone on it brings the first go back with the hand on its right stone.
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
    await waitFor(() => expect(document.querySelector('.kr-why--try')).toHaveTextContent('Now you try one like it.'), { timeout: 16000 });
    // A sister go: a neighbouring number, every stone back, nothing pointed at. A wrong stone on it shows why, then the first go
    // comes back with its right stone pointed at.
    const sisterAsk = document.querySelector('.kr-ask')!.textContent!;
    expect(sisterAsk).not.toBe(ask);
    const sisterAnswer = Number(sisterAsk.match(/(\d+)/)![1]);
    const sisterRight = String(sisterAsk.startsWith('Half') ? sisterAnswer / 2 : sisterAnswer * 2);
    expect(stones().every((b) => !b.hasAttribute('disabled'))).toBe(true);
    expect(hand()).toBeNull();
    await userEvent.click(stones().find((b) => !b.getAttribute('aria-label')!.startsWith(sisterRight))!);
    expect(document.querySelector('.kr-why--look')).toBeNull();
    expect(document.querySelector('.kr-why')).not.toHaveTextContent('Now you try');
    await waitFor(() => expect(hand()!.closest('button')!.getAttribute('aria-label')).toBe(`${right}, try this one`), { timeout: 6000 });
    expect(document.querySelector('.kr-ask')!.textContent).toBe(ask);
  }, 40000);
});
