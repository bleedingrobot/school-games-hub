/**
 * Pip's guided first go (test 8 of the game's 8, docs/ISLES-PLAN.md section 9): a pupil can press through it with the
 * buttons it lights, skip it, and it catches up when they go their own way. Finished or skipped, the server
 * remembers, so it doesn't come back.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seededRandom } from '../../../shared/maths/serverQuestions';
import { IslesPlay } from './IslesPlay';
import { createTrialBackend } from './trialBackend';

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
  }, 30_000);

});
