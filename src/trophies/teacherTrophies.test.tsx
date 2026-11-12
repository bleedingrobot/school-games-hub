import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { resetAvatar, saveTrophySeason, type TrophySeason } from '../data/trophyTools';
import { PupilTrophies, TrophySeasonPanel } from './TeacherTrophies';

const season: TrophySeason = {
  season: 3, start: '2026-10-18', days: 35, pausedSince: null, seasonStart: '2026-12-27', seasonEnd: '2027-01-30', daysLeft: 12,
};

vi.mock('../data/trophyTools', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/trophyTools')>()),
  fetchTrophySeason: vi.fn(async () => season),
  saveTrophySeason: vi.fn(async () => ({ ...season, pausedSince: '2027-01-18' })),
  fetchPupilTrophies: vi.fn(async () => [
    { id: 'isles-all', game: 'isles', name: 'Island Hopper', how: '', kind: 'trophy', tier: 'gold', count: 3, lastAt: '2026-11-10T01:00:00Z' },
  ]),
  resetAvatar: vi.fn(async () => {}),
}));

describe("teachers' trophy tools (P12)", () => {
  it('shows the season and pauses it; a pupil page lists trophies and resets the avatar only after Yes', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TrophySeasonPanel />);
    expect(await screen.findByText(/Season 3: 12 days left/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pause for the holidays/ }));
    expect(saveTrophySeason).toHaveBeenCalledWith({ paused: true });
    expect(await screen.findByRole('button', { name: /Start the clock again/ })).toBeInTheDocument();
    unmount();

    const changed = vi.fn();
    render(<PupilTrophies student="p1" name="Brave Kiwi 7" onChanged={changed} />);
    expect(await screen.findByText('Island Hopper')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reset avatar/ }));
    expect(resetAvatar).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, reset' }));
    expect(resetAvatar).toHaveBeenCalledWith('p1');
    expect(changed).toHaveBeenCalled();
  });
});
