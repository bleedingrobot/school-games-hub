import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as mine from '../../data/mine';
import { GameSwitchSetting, MathsSwitchSetting } from '../../teacher/Games';
import { mineRunner } from '.';

// Mine Runner's row on the teacher's Games table: the On column and the Maths column (these checks were the old panel's).
vi.mock('../../data/mine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/mine')>()),
  fetchMineMaths: vi.fn(),
  saveMineMaths: vi.fn(),
  fetchMineEnabled: vi.fn(),
  saveMineEnabled: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(mine.fetchMineMaths).mockReset().mockResolvedValue('choose');
  vi.mocked(mine.saveMineMaths).mockReset().mockResolvedValue();
  vi.mocked(mine.fetchMineEnabled).mockReset().mockResolvedValue(false);
  vi.mocked(mine.saveMineEnabled).mockReset().mockResolvedValue();
});

const loadedSwitch = async () => {
  const on = await screen.findByRole('switch', { name: 'Mine Runner' });
  await waitFor(() => expect(on).toBeEnabled());
  return on;
};

describe('the Mine Runner switch on the Games table', () => {
  it('shows the game is off to start with, and switches it on and off for the class', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={mineRunner} classId="c12" />);
    const on = await loadedSwitch();
    expect(mine.fetchMineEnabled).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(mine.saveMineEnabled).toHaveBeenCalledWith(true, 'c12');
    expect(on).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    await user.click(on);
    expect(mine.saveMineEnabled).toHaveBeenLastCalledWith(false, 'c12');
  });

  it('says why when the switch cannot be saved, and keeps the old setting', async () => {
    vi.mocked(mine.saveMineEnabled).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<GameSwitchSetting game={mineRunner} classId="c12" />);
    const on = await loadedSwitch();
    await user.click(on);
    await waitFor(() => expect(on).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByRole('status')).toHaveTextContent('Something went wrong');
  });

  it('is never a red button', async () => {
    const { container } = render(<GameSwitchSetting game={mineRunner} classId="c12" />);
    await loadedSwitch();
    expect(container.querySelector('.button--danger')).toBeNull();
  });
});

describe('the Mine Runner maths switch on the Games table', () => {
  it('shows the current setting, with all three choices', async () => {
    render(<MathsSwitchSetting game={mineRunner} classId="c12" />);
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    expect(mine.fetchMineMaths).toHaveBeenCalledWith('c12');
    expect(screen.getByRole('radio', { name: /^Off/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /On for everyone/ })).not.toBeChecked();
  });

  it('saves a change for the class and says so', async () => {
    const user = userEvent.setup();
    render(<MathsSwitchSetting game={mineRunner} classId="c12" />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    expect(mine.saveMineMaths).toHaveBeenCalledWith('on', 'c12');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /On for everyone/ })).toBeChecked();
  });

  it('keeps the old setting and says why when saving fails', async () => {
    vi.mocked(mine.saveMineMaths).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<MathsSwitchSetting game={mineRunner} classId="c12" />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /Students choose/ })).toBeChecked());
    expect(screen.getByRole('status')).toHaveTextContent('Something went wrong');
  });

  it('says so when the setting cannot be loaded', async () => {
    vi.mocked(mine.fetchMineMaths).mockRejectedValue(new Error('down'));
    render(<MathsSwitchSetting game={mineRunner} classId="c12" />);
    expect(await screen.findByRole('status')).toHaveTextContent('couldn’t load');
  });
});
