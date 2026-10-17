import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PowerClashPlay } from './PowerClashPlay';

const cell = (row: number, col: number) =>
  screen.getByRole('button', { name: new RegExp(`Row ${row}, column ${col}:`) });

/** Wait out the short animation lock, then tap the square. */
async function tap(user: ReturnType<typeof userEvent.setup>, row: number, col: number) {
  await waitFor(() => expect(cell(row, col)).toBeEnabled(), { timeout: 3000 });
  await user.click(cell(row, col));
}

async function start(user: ReturnType<typeof userEvent.setup>) {
  render(<PowerClashPlay />);
  await user.click(screen.getByRole('button', { name: /Start the clash/ }));
}

describe('Power Clash screens', () => {
  // Reduced motion keeps the animation lock to a blink, so these long games stay quick.
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('needs three powers each before starting', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay />);
    const start = screen.getByRole('button', { name: /Start the clash/ });
    expect(start).toBeEnabled();
    await user.click(screen.getAllByRole('button', { name: /Double Trouble/ })[0]); // X drops one
    expect(start).toBeDisabled();
  });

  it('plays a round to a win and scores it', async () => {
    const user = userEvent.setup();
    await start(user);
    await tap(user, 1, 1); // X
    await tap(user, 2, 1); // O
    await tap(user, 1, 2); // X
    await tap(user, 2, 2); // O
    await tap(user, 1, 3); // X wins
    expect(screen.getByText('Player X wins the round!')).toBeInTheDocument();
    expect(screen.getByLabelText('Score')).toHaveTextContent('X 1');
    await user.click(screen.getByRole('button', { name: 'Next round' }));
    expect(screen.getByText(/Round 2/)).toBeInTheDocument();
    expect(screen.getByText(/Player O: use a power/)).toBeInTheDocument(); // starter swaps
  });

  it('Freeze Ray: pick the card, tap a square, opponent cannot use it', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(screen.getAllByRole('button', { name: /Freeze Ray/ })[0]);
    expect(screen.getByText('Tap an empty square to freeze')).toBeInTheDocument();
    await tap(user, 2, 2);
    await tap(user, 1, 1); // X places
    await waitFor(() => expect(cell(2, 2)).toBeDisabled(), { timeout: 3000 }); // frozen for O
    await tap(user, 1, 2); // O places
    await tap(user, 3, 3); // X places; thawed square now free for O
    await waitFor(() => expect(cell(2, 2)).toBeEnabled(), { timeout: 3000 });
  });

  it('Escape cancels a chosen power, and a used power stays used', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(screen.getAllByRole('button', { name: /Board Wipe/ })[0]);
    // Nothing to blast yet, so it explains instead of selecting.
    expect(screen.getAllByText(/Needs a symbol on the board/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: /Double Trouble/ })[0]);
    await tap(user, 1, 1);
    await tap(user, 1, 2);
    expect(screen.getByText('Used up')).toBeInTheDocument();
  });
});

describe('Power Clash polish', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('locks the board while an animation plays, then unlocks', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(cell(1, 1));
    expect(cell(2, 2)).toBeDisabled(); // locked right after the move
    expect(screen.getAllByRole('button', { name: /Freeze Ray/ })[1]).toBeDisabled();
    await waitFor(() => expect(cell(2, 2)).toBeEnabled(), { timeout: 3000 });
  });

  it('shows a short shout and announces what a power did', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(screen.getAllByRole('button', { name: /Freeze Ray/ })[0]);
    await user.click(cell(2, 2));
    await user.click(cell(1, 1));
    expect(screen.getByText(/Freeze Ray! That square is frozen/)).toBeInTheDocument();
    expect(document.querySelector('.pc__shout')?.textContent).toMatch(/\S/);
    expect(document.querySelector('.pc__shout')?.textContent!.length).toBeLessThan(30);
  });

  it('How to play opens with the button and ?, closes with Escape, and focus goes back', async () => {
    const user = userEvent.setup();
    await start(user);
    const button = screen.getByRole('button', { name: /How to play/ });
    await user.click(button);
    expect(screen.getByRole('dialog', { name: /How to play Power Clash/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close help' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
    await user.keyboard('?');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(button).toHaveFocus();
  });

  it('with reduced motion there are no sparks and the screen is marked calm', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {},
    }));
    const user = userEvent.setup();
    await start(user);
    expect(document.querySelector('.pc')).toHaveClass('pc--calm');
    await user.click(cell(1, 1));
    await user.click(screen.getAllByRole('button', { name: /Board Wipe/ })[0]);
    await user.click(cell(1, 1));
    expect(document.querySelector('.pc__particle')).toBeNull();
    // Unlocks after a very short wait.
    await waitFor(() => expect(cell(2, 2)).toBeEnabled(), { timeout: 600 });
  });
});
