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

  it('guides the very first go to the right number, then gives hints after wrong taps: counting together, then the hand', async () => {
    const trial = trialBackend({ storageKey: 'guide' });
    render(<SoundProvider><KororaGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
    // Double 2: the hand moves from the fish to the right number, 4.
    await waitFor(() => expect(hand()).not.toBeNull(), { timeout: 6000 });
    expect(hand()!.closest('button')!.getAttribute('aria-label')).toBe('4, try this one');
    cleanup();

    // A later day: no hand until the third wrong tap; the second brings the counting.
    trial.tools.jumpTo(3);
    render(<SoundProvider><KororaGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: /Play/ }));
    const group = await screen.findByRole('group');
    expect(hand()).toBeNull();
    const wrongs = () => [...group.querySelectorAll('button')].filter((b) => !b.classList.contains('kr-choice--pointed'));
    const answer = Number(document.querySelector('.kr-ask')!.textContent!.match(/(\d+)/)![1]);
    const kind = document.querySelector('.kr-ask')!.textContent!.startsWith('Half') ? 'half' : 'double';
    const right = String(kind === 'half' ? answer / 2 : answer * 2);
    const wrong = wrongs().filter((b) => !b.getAttribute('aria-label')!.startsWith(right));
    await userEvent.click(wrong[0]);
    await userEvent.click(wrong[1]);
    await waitFor(() => expect(document.querySelectorAll('.kr-fish--counted').length).toBeGreaterThan(0), { timeout: 4000 });
    expect(hand()).toBeNull();
    await userEvent.click(wrong[2]);
    expect(hand()!.closest('button')!.getAttribute('aria-label')).toBe(`${right}, try this one`);
  }, 20000);
});
