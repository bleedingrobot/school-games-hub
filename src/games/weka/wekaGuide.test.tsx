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

  it('guides the very first go in two steps (to the big rock, then on), the pebbles and the split after it, then gives hints after wrong taps: the make-ten sentence, then the hand', async () => {
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
    // Then the same question with pebbles: 9 gold and 2 silver; one silver moves across to fill the first ten.
    await userEvent.click(hand()!.closest('button')!);
    await waitFor(() => expect(document.querySelector('.wk-pebbles__sum')!.textContent).toBe('9 + 2'), { timeout: 8000 });
    expect(document.querySelectorAll('.wk-pebble--move')).toHaveLength(2);
    await waitFor(() => expect(label()).toMatch(/move it to the first ten-frame, try this one$/));
    await userEvent.click(hand()!.closest('button')!);
    // Nothing stops by itself: the child taps Check.
    expect(screen.queryByRole('button', { name: /Next/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(document.querySelector('.wk-pebbles__said')!.textContent).toBe('9 + 1 = 10, 10 + 1 = 11');
    expect(document.querySelectorAll('.wk-pebble--move')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    // Then the split as a bond: the 2 is 1 to the big rock and 1 more, with the hand showing each part on the guided go.
    await waitFor(() => expect(document.querySelector('.wk-bond__whole')!.textContent).toBe('2'), { timeout: 8000 });
    expect(label()).toBe('1, try this one');
    await userEvent.click(hand()!.closest('button')!);
    expect(document.querySelector('.wk-bond__part--to')!.textContent).toBe('1');
    await userEvent.click(hand()!.closest('button')!);
    expect(document.querySelector('.wk-bond__said')!.textContent)
      .toBe('You solved 9 + 2 by splitting the 2 into 1 and 1. You added the 1 first to make ten, then the other 1.');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(document.querySelector('.wk-bond')).toBeNull());
    cleanup();

    // A later day with help off: one tap, no hand at first. The first wrong tap greys that number out and shows why (the
    // stones come back); the second is "Let's look together" with the make-ten sentence; then the same go again at the
    // child's own help ("Now you try"), and the hand points after the third wrong tap.
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
    expect(wrong[0].hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('.wk-why')).not.toBeNull();
    expect(document.querySelector('.wk-path')).not.toBeNull();
    await userEvent.click(wrong[1]);
    expect(document.querySelector('.wk-why--look')).not.toBeNull();
    expect(document.querySelector('.wk-stem')!.textContent).toMatch(/= 10, then \+ \d/);
    await waitFor(() => expect(document.querySelector('.wk-why--try')).not.toBeNull(), { timeout: 15000 });
    expect(document.querySelector('.wk-path')).toBeNull();
    expect(wrong.every((x) => !x.hasAttribute('disabled'))).toBe(true);
    expect(hand()).toBeNull();
    await userEvent.click(wrong[2]);
    expect(label()).toBe(`${right}, try this one`);
  }, 40000);
});
