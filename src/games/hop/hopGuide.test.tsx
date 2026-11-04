import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SoundProvider } from '../../sound';
import { trialBackend } from './backend';
import { HopGame } from './HopGame';

const hand = () => document.querySelector('.hp-hand');

describe("Hop's guided first go", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('points at the right glow-worm on the very first hop only, and not on a later day', async () => {
    const trial = trialBackend({ storageKey: 'guide' });
    render(<SoundProvider><HopGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await waitFor(() => expect(hand()).not.toBeNull());
    expect(document.querySelectorAll('.hp-hand')).toHaveLength(1);
    expect(hand()!.closest('button')!.getAttribute('aria-label')).toMatch(/try this one/);
    cleanup();

    // A pupil who has finished a day gets no hand.
    trial.tools.jumpTo(3);
    render(<SoundProvider><HopGame backend={trial.backend} /></SoundProvider>);
    await userEvent.click(await screen.findByRole('button', { name: /Play/ }));
    await screen.findByRole('group');
    expect(hand()).toBeNull();
  });
});
