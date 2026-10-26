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
});
