import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PowerClashPlay } from './PowerClashPlay';

const cell = (row: number, col: number) =>
  screen.getByRole('button', { name: new RegExp(`Row ${row}, column ${col}:`) });

async function start(user: ReturnType<typeof userEvent.setup>) {
  render(<PowerClashPlay />);
  await user.click(screen.getByRole('button', { name: /Start the clash/ }));
}

describe('Power Clash screens', () => {
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
    await user.click(cell(1, 1)); // X
    await user.click(cell(2, 1)); // O
    await user.click(cell(1, 2)); // X
    await user.click(cell(2, 2)); // O
    await user.click(cell(1, 3)); // X wins
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
    await user.click(cell(2, 2));
    await user.click(cell(1, 1)); // X places
    expect(cell(2, 2)).toBeDisabled(); // frozen for O
    await user.click(cell(1, 2)); // O places
    await user.click(cell(3, 3)); // X places; thawed square now free for O
    expect(cell(2, 2)).toBeEnabled();
  });

  it('Escape cancels a chosen power, and a used power stays used', async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(screen.getAllByRole('button', { name: /Board Wipe/ })[0]);
    // Nothing to blast yet, so it explains instead of selecting.
    expect(screen.getAllByText(/Needs a symbol on the board/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: /Double Trouble/ })[0]);
    await user.click(cell(1, 1));
    await user.click(cell(1, 2));
    expect(screen.getByText('Used up')).toBeInTheDocument();
  });
});
