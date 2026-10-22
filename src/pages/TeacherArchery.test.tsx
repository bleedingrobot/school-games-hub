import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as archery from '../data/archery';
import { ArcheryTeacherPanel } from './TeacherArchery';

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

describe('the Archery Challenge panel on the Teacher page', () => {
  it('shows the game is off to start with, and switches it on and off', async () => {
    const user = userEvent.setup();
    render(<ArcheryTeacherPanel />);
    await user.click(await screen.findByRole('button', { name: 'Switch Archery Challenge on' }));
    expect(archery.saveArcheryEnabled).toHaveBeenCalledWith(true, null);
    expect(await screen.findByRole('status')).toHaveTextContent('Archery Challenge: On.');
    await user.click(await screen.findByRole('button', { name: 'Switch Archery Challenge off' }));
    expect(archery.saveArcheryEnabled).toHaveBeenLastCalledWith(false, null);
  });

  it('has classmate fights on to start with, beside the main switch, and says it only matters while the game is on', async () => {
    const user = userEvent.setup();
    render(<ArcheryTeacherPanel />);
    expect(await screen.findByText(/Off for this class \(pupils/)).toBeInTheDocument();
    expect(screen.getByText(/This only matters while Archery Challenge is on/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch classmate fights off' }));
    expect(archery.saveArcheryDuels).toHaveBeenCalledWith(false, null);
    expect(await screen.findByRole('status')).toHaveTextContent('Classmate fights: Off.');
    await user.click(screen.getByRole('button', { name: 'Switch classmate fights on' }));
    expect(archery.saveArcheryDuels).toHaveBeenLastCalledWith(true, null);
  });

  it('keeps the old setting and says why when saving fails', async () => {
    vi.mocked(archery.saveArcheryDuels).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<ArcheryTeacherPanel />);
    await user.click(await screen.findByRole('button', { name: 'Switch classmate fights off' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Switch classmate fights off' })).toBeInTheDocument();
  });

  it('shows the class summary as counts only', async () => {
    render(<ArcheryTeacherPanel />);
    const list = await screen.findByRole('list', { name: 'Archery Challenge this week' });
    expect(within(list).getByText('18 of 26 pupils played in the last 7 days.')).toBeInTheDocument();
    expect(within(list).getByText('41 fights against the bots and 1 fight between classmates finished.')).toBeInTheDocument();
    expect(within(list).getByText('12 speed rounds in the last day.')).toBeInTheDocument();
  });

  it('still works without the summary, and says so when a switch cannot be loaded', async () => {
    vi.mocked(archery.fetchArcherySummary).mockRejectedValue(new Error('down'));
    vi.mocked(archery.fetchArcheryDuels).mockRejectedValue(new Error('down'));
    render(<ArcheryTeacherPanel />);
    expect(await screen.findByRole('status')).toHaveTextContent('couldn’t load');
    expect(await screen.findByRole('button', { name: 'Switch Archery Challenge on' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
