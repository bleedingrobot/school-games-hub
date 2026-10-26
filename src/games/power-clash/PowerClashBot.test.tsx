import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PowerClashPlay } from './PowerClashPlay';

const cells = () => screen.getAllByRole('button', { name: /^Row \d, column \d:/ });
const openCells = () => cells().filter((c) => !(c as HTMLButtonElement).disabled);
const prompt = () => document.querySelector('.pc__prompt')!.textContent ?? '';

async function chooseBot(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Play a bot' }));
  await user.click(screen.getByRole('button', { name: /Start the clash/ }));
}

describe('Power Clash against a bot', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the bot replies after the student, and says what it did', async () => {
    const user = userEvent.setup();
    render(<PowerClashPlay timeScale={0} />);
    await chooseBot(user);
    expect(screen.getByText('Practice game: this one won’t be saved.')).toBeInTheDocument();
    await user.click(openCells()[4]);
    await waitFor(() => expect(cells().filter((c) => /: O$/.test(c.getAttribute('aria-label')!))).toHaveLength(1));
    expect(document.querySelector('.pc__message')!.textContent).toMatch(/^The bot put O on /);
    await waitFor(() => expect(openCells().length).toBeGreaterThan(0)); // the student's turn again
    expect(prompt()).toMatch(/^Your go/);
  });
});
