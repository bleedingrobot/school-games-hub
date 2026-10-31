import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as archery from '../data/archery';
import { archeryChallenge } from '../games/archery';
import { useArcherySummary } from '../games/archery/teacher';
import { GameSwitchSetting } from '../teacher/Games';
import { ArcherySettings } from './TeacherArchery';

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

  it('sums up whether classmate fights are on, and says when it can’t tell', async () => {
    const { result, rerender } = renderHook(({ classId }) => useArcherySummary(classId), { initialProps: { classId: 'c12' } });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('Classmate fights on'));
    expect(archery.fetchArcheryDuels).toHaveBeenCalledWith('c12');
    vi.mocked(archery.fetchArcheryDuels).mockResolvedValue(false);
    rerender({ classId: 'c14' });
    await waitFor(() => expect(result.current).toBe('Classmate fights off'));
    vi.mocked(archery.fetchArcheryDuels).mockRejectedValue(new Error('down'));
    rerender({ classId: 'c16' });
    await waitFor(() => expect(result.current).toBe('Couldn’t load'));
  });
});

describe('Archery Challenge’s Settings', () => {
  it('has classmate fights on to start with, and says it only matters while the game is on', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArcherySettings classId="c12" />);
    const fights = await loaded('Classmate fights');
    expect(fights).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText(/only matters once it’s on/)).toBeInTheDocument();
    expect(container.querySelector('.button--danger')).toBeNull();
    await user.click(fights);
    expect(archery.saveArcheryDuels).toHaveBeenCalledWith(false, 'c12');
    expect(fights).toHaveAttribute('aria-checked', 'false');
    await user.click(fights);
    expect(archery.saveArcheryDuels).toHaveBeenLastCalledWith(true, 'c12');
  });

  it('doesn’t say it only matters once it’s on while the game is on', async () => {
    vi.mocked(archery.fetchArcheryEnabled).mockResolvedValue(true);
    render(<ArcherySettings classId="c12" />);
    await loaded('Classmate fights');
    await waitFor(() => expect(archery.fetchArcheryEnabled).toHaveBeenCalledWith('c12'));
    expect(screen.queryByText(/only matters once it’s on/)).toBeNull();
  });

  it('keeps the old setting and says why when saving fails', async () => {
    vi.mocked(archery.saveArcheryDuels).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<ArcherySettings classId="c12" />);
    const fights = await loaded('Classmate fights');
    await user.click(fights);
    await waitFor(() => expect(fights).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('status')).toHaveTextContent('Something went wrong');
  });

  it('shows the class summary as counts only, for the class', async () => {
    render(<ArcherySettings classId="c12" />);
    const list = await screen.findByRole('list', { name: 'Archery Challenge this week' });
    expect(archery.fetchArcherySummary).toHaveBeenCalledWith('c12');
    expect(within(list).getByText('18 of 26 pupils played in the last 7 days.')).toBeInTheDocument();
    expect(within(list).getByText('41 fights against the bots and 1 fight between classmates finished.')).toBeInTheDocument();
    expect(within(list).getByText('12 speed rounds in the last day.')).toBeInTheDocument();
  });

  it('still works without the summary, and says so when the switch cannot be loaded', async () => {
    vi.mocked(archery.fetchArcherySummary).mockRejectedValue(new Error('down'));
    vi.mocked(archery.fetchArcheryDuels).mockRejectedValue(new Error('down'));
    render(<ArcherySettings classId="c12" />);
    expect(await screen.findByRole('status')).toHaveTextContent('couldn’t load');
    expect(screen.getByText(/Points: finishing a bot fight/)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
