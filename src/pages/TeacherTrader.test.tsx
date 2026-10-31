import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as trader from '../data/trader';
import { starTrader } from '../games/trader';
import { GameSwitchSetting, MathsSwitchSetting } from '../teacher/Games';
import { TraderSettings, TraderStudentPanel } from './TeacherTrader';

// Star Trader on the teacher's Games table: the on/off and maths switches in its row, jumps a day and the bank in its Settings,
// and the ship reset on a student's page. All four settings save together, so each change keeps the class's other three.
vi.mock('../data/trader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/trader')>()),
  fetchTraderSettings: vi.fn(),
  saveTraderSettings: vi.fn(),
  resetTraderShip: vi.fn(),
}));

const START: trader.TraderSettings = { enabled: false, jumps: 10, loans: true, maths: 'choose' };

beforeEach(() => {
  vi.mocked(trader.fetchTraderSettings).mockReset().mockResolvedValue(START);
  vi.mocked(trader.saveTraderSettings).mockReset().mockResolvedValue();
  vi.mocked(trader.resetTraderShip).mockReset().mockResolvedValue();
});

const loaded = async (name: string) => {
  const control = await screen.findByRole('switch', { name });
  await waitFor(() => expect(control).toBeEnabled());
  return control;
};

describe('the Star Trader row on the Games table', () => {
  it('switches the game on for the class, keeping its other settings', async () => {
    const user = userEvent.setup();
    render(<GameSwitchSetting game={starTrader} classId="c12" />);
    const on = await loaded('Star Trader');
    expect(trader.fetchTraderSettings).toHaveBeenCalledWith('c12');
    expect(on).toHaveAttribute('aria-checked', 'false');
    await user.click(on);
    expect(trader.saveTraderSettings).toHaveBeenCalledWith({ ...START, enabled: true }, 'c12');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('shows the maths setting and saves a change, keeping the others', async () => {
    const user = userEvent.setup();
    render(<MathsSwitchSetting game={starTrader} classId="c12" />);
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /^Off/ }));
    expect(trader.saveTraderSettings).toHaveBeenCalledWith({ ...START, maths: 'off' }, 'c12');
  });
});

describe('Star Trader’s Settings', () => {
  it('shows jumps a day and the bank, and says they only matter once the game is on', async () => {
    render(<TraderSettings classId="c12" />);
    expect(await loaded('Bank')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('spinbutton', { name: /Jumps a day/ })).toHaveValue(10);
    expect(screen.getByText(/only matter once it’s on/)).toBeInTheDocument();
  });

  it('saves a new number of jumps and closing the bank, each keeping the other settings', async () => {
    const user = userEvent.setup();
    render(<TraderSettings classId="c12" />);
    const bank = await loaded('Bank');
    const jumps = screen.getByRole('spinbutton', { name: /Jumps a day/ });
    await user.clear(jumps);
    await user.type(jumps, '15{Enter}');
    await waitFor(() => expect(trader.saveTraderSettings).toHaveBeenCalledWith({ ...START, jumps: 15 }, 'c12'));
    await user.click(bank);
    await waitFor(() => expect(trader.saveTraderSettings).toHaveBeenLastCalledWith({ ...START, loans: false }, 'c12'));
  });

  it('refuses a number of jumps out of range', async () => {
    const user = userEvent.setup();
    render(<TraderSettings classId="c12" />);
    await loaded('Bank');
    const jumps = screen.getByRole('spinbutton', { name: /Jumps a day/ });
    await user.clear(jumps);
    await user.type(jumps, '31{Enter}');
    expect(await screen.findByText('Pick a whole number from 1 to 30.')).toBeInTheDocument();
    expect(trader.saveTraderSettings).not.toHaveBeenCalled();
  });

  it('doesn’t say it only matters once it’s on while the game is on', async () => {
    vi.mocked(trader.fetchTraderSettings).mockResolvedValue({ ...START, enabled: true });
    render(<TraderSettings classId="c12" />);
    await loaded('Bank');
    expect(screen.queryByText(/only matter once it’s on/)).toBeNull();
  });
});

describe('Star Trader on a student’s page', () => {
  it('asks before resetting the ship, then resets it', async () => {
    const user = userEvent.setup();
    render(<TraderStudentPanel student="s1" />);
    await user.click(screen.getByRole('button', { name: /Reset this student’s ship/ }));
    expect(trader.resetTraderShip).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, reset it' }));
    expect(trader.resetTraderShip).toHaveBeenCalledWith('s1');
    expect(await screen.findByRole('status')).toHaveTextContent('Done.');
  });
});
