import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SoundProvider } from '../../sound';
import { trialBackend } from './backend';
import { WekaGame } from './WekaGame';

const hand = () => document.querySelector('.wk-hand');
const label = () => hand()!.closest('button')!.getAttribute('aria-label');

describe('Weka’s Stepping Stones help', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('guides the very first go in two steps (to the big rock, then on), then gives hints after wrong taps: the make-ten sentence, then the hand', async () => {
    const trial = trialBackend({ storageKey: 'guide' });
    render(<SoundProvider><WekaGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
    // 9 + 2: first how many hops to the big rock (1), then where Weka lands (11).
    expect(await screen.findByText('9 + 2: how many hops to 10?')).toBeTruthy();
    await waitFor(() => expect(hand()).not.toBeNull(), { timeout: 6000 });
    expect(label()).toBe('1, try this one');
    await userEvent.click(hand()!.closest('button')!);
    await waitFor(() => expect(document.querySelector('.wk-stem')!.textContent).toBe('9 + 1 = 10, then + 1'), { timeout: 4000 });
    await waitFor(() => expect(label()).toBe('11, try this one'), { timeout: 6000 });
    cleanup();

    // A later day with help off: one tap, no hand until the third wrong tap; the second brings back the picture and sentence.
    trial.tools.setHelp('off');
    trial.tools.jumpTo(3);
    render(<SoundProvider><WekaGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: /Play/ }));
    const group = await screen.findByRole('group');
    expect(hand()).toBeNull();
    expect(document.querySelector('.wk-path')).toBeNull();
    const [a, b] = document.querySelector('.wk-ask')!.textContent!.match(/\d+/g)!.map(Number);
    const right = String(a + b);
    const wrong = [...group.querySelectorAll('button')].filter((x) => x.getAttribute('aria-label') !== right);
    await userEvent.click(wrong[0]);
    await userEvent.click(wrong[1]);
    expect(document.querySelector('.wk-path')).not.toBeNull();
    expect(document.querySelector('.wk-stem')!.textContent).toMatch(/= 10, then \+ \d/);
    expect(hand()).toBeNull();
    await userEvent.click(wrong[2]);
    expect(label()).toBe(`${right}, try this one`);
  }, 20000);
});
