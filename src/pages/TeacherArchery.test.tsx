import { render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as archery from '../data/archery';
import { archeryChallenge } from '../games/archery';
import { GameSwitchSetting } from '../teacher/Games';

// Archery Challenge on the teacher's Games table: the on/off switch and a one-line summary in its row, and classmate fights,
// the points and the class's week in its Settings.
vi.mock('../data/archery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/archery')>()),
  fetchArcheryEnabled: vi.fn(),
  saveArcheryEnabled: vi.fn(),
  fetchArcheryDuels: vi.fn(),
  saveArcheryDuels: vi.fn(),
  fetchArcherySummary: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(archery.fetchArcheryEnabled).mockReset().mockResolvedValue(false);
  vi.mocked(archery.saveArcheryEnabled).mockReset().mockResolvedValue();
  vi.mocked(archery.fetchArcheryDuels).mockReset().mockResolvedValue(true);
  vi.mocked(archery.saveArcheryDuels).mockReset().mockResolvedValue();
  vi.mocked(archery.fetchArcherySummary).mockReset().mockResolvedValue({ pupils: 26, played: 18, botFights: 41, duels: 1, rounds: 12 });
});

const loaded = async (name: string) => {
  const control = await screen.findByRole('switch', { name });
  await waitFor(() => expect(control).toBeEnabled());
  return control;
};

describe('the Archery Challenge row on the Games table', () => {
  it('shows the game is off to start with, and switches it on and off for the class', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={archeryChallenge} classId="c12" />);
    const on = await loaded('Archery Challenge');
    expect(archery.fetchArcheryEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(archery.saveArcheryEnabled).toHaveBeenCalledWith(true, 'c12');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    await user.click(on);
    expect(archery.saveArcheryEnabled).toHaveBeenLastCalledWith(false, 'c12');
  });
});
