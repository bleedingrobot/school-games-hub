/**
 * Pip's guided first go (test 8 of the game's 8, docs/ISLES-PLAN.md section 9): a pupil can press through it with the
 * buttons it lights, skip it, and it catches up when they go their own way. Finished or skipped, the server
 * remembers, so it doesn't come back.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seededRandom } from '../../../shared/maths/serverQuestions';
import { newIsland, type Island } from '../../../shared/isles/engine';
import { IslesPlay } from './IslesPlay';
import { createTrialBackend } from './trialBackend';
import { goalWords } from './words';

const grand = (extra: Partial<Island>): Island => ({
  ...newIsland(),
  spots: Array.from({ length: 16 }, () => ({ kind: 'farm' as const, level: 1 })),
  ...extra,
});

const guide = () => document.querySelector('.si-guide p')?.textContent ?? null;
const litButton = () => document.querySelector<HTMLElement>('.si-lit');

async function start(name: string) {
  const u = userEvent.setup();
  const backend = createTrialBackend(name, { save: false, random: seededRandom(name) });
  const view = render(<IslesPlay backend={backend} />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose your Sky Keeper' })).toHaveFocus());
  await u.click(screen.getByRole('radio', { name: 'Sky Keeper 3' }));
  await u.click(screen.getByRole('button', { name: 'This is my keeper' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'My island', level: 2 })).toHaveFocus());
  return { u, backend, view };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Pip's guided first go", () => {
  it('walks a new pupil through their first turn with the buttons it lights, then cheers', async () => {
    const { u, backend, view } = await start('guide-through');
    expect(guide()).toMatch(/^Welcome to your island!/);
    expect(litButton()).toHaveTextContent('Play a turn');
    await u.click(litButton()!);
    // The sky pilot's question: Pip never helps with the maths, so it's skipped here like any pupil can.
    await u.click(await screen.findByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(guide()).toMatch(/^Every building makes coins/));
    await u.click(litButton()!);
    expect(guide()).toMatch(/^Build time!/);
    expect(litButton()).toHaveAccessibleName('Spot 6: Empty spot');
    await u.click(litButton()!);
    expect(guide()).toMatch(/^Choose Workshop/);
    await u.click(litButton()!);
    expect(guide()).toMatch(/^Well done!/);
    await u.click(litButton()!);
    expect(guide()).toMatch(/^Last step!/);
    expect(litButton()).toHaveTextContent('End turn');
    await u.click(litButton()!);
    expect(await screen.findByRole('heading', { name: 'Your island grew!' })).toBeInTheDocument();
    expect(guide()).toBeNull();
    expect(screen.getByRole('img', { name: 'Spot 6: Workshop, level 1' })).toBeInTheDocument();

    // Finished: opened again (another Chromebook), the guide doesn't come back.
    view.unmount();
    render(<IslesPlay backend={backend} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My island', level: 2 })).toHaveFocus());
    expect(guide()).toBeNull();

    // After the guide, the goal box on My island says what to do next, with the numbers, up to the lit Lighthouse
    // (James, 24 Nov 2026). Checked here, not in a test of its own, to stay within Sky Isles' test budget.
    expect(screen.getByText(/^Next: /)).toBeTruthy();
    expect(goalWords({ ...newIsland(), driftLeft: 0 }).next).toBe('Next: more land drifts by tomorrow. Save 300 coins to anchor it.');
    expect(goalWords({ ...newIsland(), driftLeft: 1, coins: 100 })).toEqual({
      label: 'Road to Grand Isle: 6 of 16 building spots',
      next: 'Next: save 300 coins to anchor the land drifting by. You have 100.',
    });
    expect(goalWords({ ...newIsland(), driftLeft: 1, coins: 300 }).next).toBe('Next: land is drifting by! Anchor it on your turn for 300 coins.');
    // A full island with land still in the drift talks about the Lighthouse, not land.
    expect(goalWords(grand({ lighthouse: 2, coins: 500, crystals: 30.75, driftLeft: 2 }))).toEqual({
      label: 'Grand Isle! Sky Lighthouse: 2 of 4 stages',
      next: 'Next: Lighthouse stage 3 costs 900 coins and 20 sky crystals. You need 400 more coins.',
    });
    expect(goalWords(grand({ lighthouse: 0, coins: 600, crystals: 9.75 })).next).toContain('You need 1 more sky crystal.');
    expect(goalWords(grand({ lighthouse: 3, coins: 2000, crystals: 68 })).next).toContain('You have enough: build it on your turn!');
    expect(goalWords(grand({ lighthouse: 4 })).label).toBe('Sky Lighthouse lit!');
  }, 30_000);

});
