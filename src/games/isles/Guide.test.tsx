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

  it('can be skipped, and stays skipped', async () => {
    const { u, backend, view } = await start('guide-skip');
    await u.click(screen.getByRole('button', { name: 'Skip the guide' }));
    expect(guide()).toBeNull();
    view.unmount();
    render(<IslesPlay backend={backend} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My island', level: 2 })).toHaveFocus());
    expect(guide()).toBeNull();
    expect(screen.getByRole('button', { name: 'Play a turn' })).toBeInTheDocument();
  }, 30_000);

  it('catches up when the pupil goes their own way, and can be replayed', async () => {
    const { u } = await start('guide-own-way');
    await u.click(screen.getByRole('button', { name: 'Play a turn' }));
    await u.click(await screen.findByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(guide()).toMatch(/^Every building makes coins/));
    await u.click(screen.getByRole('button', { name: 'Next' }));
    // Not the glowing spot: a spot with a Farm on it. Pip points back to the island.
    await u.click(screen.getByRole('button', { name: 'Spot 1: Farm, level 1' }));
    expect(guide()).toMatch(/has a building already/);
    expect(litButton()).toHaveTextContent('Back to the island');
    // Straight on without building: Pip catches up at the last step.
    await u.click(screen.getByRole('button', { name: 'Back to the island' }));
    await u.click(screen.getByRole('button', { name: 'Done building' }));
    expect(guide()).toMatch(/^Last step!/);
    // Stopping the turn: back to the start of the guide.
    await u.click(screen.getByRole('button', { name: 'Stop, back to my island' }));
    expect(guide()).toMatch(/^Welcome to your island!/);
    // Skipped, then replayed from How to play.
    await u.click(screen.getByRole('button', { name: 'Skip the guide' }));
    await u.click(screen.getByRole('button', { name: 'How to play' }));
    await u.click(screen.getByRole('button', { name: 'Replay the guide' }));
    expect(guide()).toMatch(/^Welcome to your island!/);
  }, 30_000);
});

describe("Pip's help", () => {
  it('Lots shows Show me, Some leaves it out, Off keeps Pip quiet, and the choice is kept', async () => {
    const { u } = await start('guide-help');
    await u.click(screen.getByRole('button', { name: 'Skip the guide' }));
    /** Into a turn's Build step, where Pip's line has a Show me on Lots. */
    const toBuild = async () => {
      await u.click(screen.getByRole('button', { name: 'Play a turn' }));
      await u.click(await screen.findByRole('button', { name: 'Skip' }));
      await u.click(await screen.findByRole('button', { name: 'Next' }));
    };
    const choose = async (help: string) => {
      await u.click(screen.getByRole('button', { name: 'Stop, back to my island' }));
      await u.click(screen.getByRole('button', { name: 'How to play' }));
      await u.click(screen.getByRole('radio', { name: help }));
      expect(screen.getByRole('radio', { name: help })).toHaveAttribute('aria-checked', 'true');
      await u.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    };
    await toBuild();
    expect(screen.getByRole('button', { name: 'Show me' })).toBeInTheDocument();
    await choose('Some');
    expect(screen.getByText(/^Next turn: build a /)).toBeInTheDocument();
    await toBuild();
    expect(screen.queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument();
    expect(screen.getByText(/^Build a Workshop/)).toBeInTheDocument();
    await choose('Off');
    expect(screen.queryByText(/^Next turn: build a /)).not.toBeInTheDocument();
    expect(localStorage.getItem('isles-help')).toBe('off');
  }, 30_000);

  it('shows a first-time tip once', async () => {
    const { u } = await start('guide-tips');
    await u.click(screen.getByRole('button', { name: 'Skip the guide' }));
    // The preview's pretend classmate left a gift: the gift tip, once.
    expect(screen.getByText(/Classmates can leave you gifts/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/Classmates can leave you gifts/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('isles-tips-seen')!)).toEqual(['gift']);
  }, 30_000);
});
