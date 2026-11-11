import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as kingdom from '../../data/kingdom';
import { GameSwitchSetting } from '../../teacher/Games';
import { kingdomKeeper } from '.';

// Kingdom Keeper's row on the teacher's Games table: the on/off switch, "Follows focus" for its maths, and nothing to open.
vi.mock('../../data/kingdom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/kingdom')>()),
  fetchKingdomEnabled: vi.fn(),
  saveKingdomEnabled: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(kingdom.fetchKingdomEnabled).mockReset().mockResolvedValue(false);
  vi.mocked(kingdom.saveKingdomEnabled).mockReset().mockResolvedValue();
});

const loadedSwitch = async () => {
  const on = await screen.findByRole('switch', { name: 'Kingdom Keeper' });
  await waitFor(() => expect(on).toBeEnabled());
  return on;
};

describe('the Kingdom Keeper row on the Games table', () => {
  it('shows the game is off to start with, and switches it on and off for the class', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={kingdomKeeper} classId="c12" />);
    const on = await loadedSwitch();
    expect(kingdom.fetchKingdomEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(kingdom.saveKingdomEnabled).toHaveBeenCalledWith(true, 'c12');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    await user.click(on);
    expect(kingdom.saveKingdomEnabled).toHaveBeenLastCalledWith(false, 'c12');
  });
});
