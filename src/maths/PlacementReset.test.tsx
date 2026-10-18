import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendlyError } from '../data/profile';
import * as skillMap from '../data/skillMap';
import { NO_LADDER, type LadderInfo } from '../../shared/maths/place';
import { PlacementReset } from './PlacementReset';

vi.mock('../data/skillMap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/skillMap')>()),
  fetchStudentLadder: vi.fn(),
  resetPlacement: vi.fn(),
}));

const info = (over: Partial<LadderInfo> = {}): LadderInfo => ({
  ...NO_LADDER,
  on: true,
  ...over,
});
const show = () => render(<PlacementReset student="s1" name="Speedy Otter 27" />);

beforeEach(() => {
  vi.mocked(skillMap.fetchStudentLadder).mockReset();
  vi.mocked(skillMap.resetPlacement).mockReset();
});

describe('the warm-up reset on a student card', () => {
  it('says where the warm-up started them and their furthest place', async () => {
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info({ placed: 'done', placement: 'tables-6-9', furthest: 'round-1000' }));
    show();
    expect(await screen.findByText(/warm-up done, started at ×6, ×9/)).toBeInTheDocument();
    expect(screen.getByText(/Furthest place: Rounding to the nearest 1000/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bYear \d/);
  });

  it('says a skip is a skip, and that none is none', async () => {
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info({ placed: 'skipped' }));
    const { unmount } = show();
    expect(await screen.findByText(/warm-up skipped/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Offer the warm-up again' })).toBeInTheDocument();
    unmount();
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info());
    show();
    expect(await screen.findByText(/warm-up not done yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Offer the warm-up again' })).toBeNull(); // nothing to clear
  });

  it('asks first, and does nothing when you cancel', async () => {
    const user = userEvent.setup();
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info({ placed: 'done', placement: 'tables-6-9', furthest: 'tables-6-9' }));
    show();
    await user.click(await screen.findByRole('button', { name: 'Offer the warm-up again' }));
    const confirm = screen.getByRole('group', {
      name: 'Confirm warm-up reset',
    });
    expect(confirm).toHaveTextContent('furthest place on the ladder is kept');
    expect(skillMap.resetPlacement).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Confirm warm-up reset' })).toBeNull();
    expect(skillMap.resetPlacement).not.toHaveBeenCalled();
  });

  it('clears it on yes, says so, keeps showing the furthest place and offers no second clear', async () => {
    const user = userEvent.setup();
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info({ placed: 'done', placement: 'tables-6-9', furthest: 'tables-6-9' }));
    vi.mocked(skillMap.resetPlacement).mockResolvedValue(true);
    show();
    await user.click(await screen.findByRole('button', { name: 'Offer the warm-up again' }));
    await user.click(screen.getByRole('button', { name: 'Yes, offer it again' }));
    expect(skillMap.resetPlacement).toHaveBeenCalledWith('s1');
    expect(await screen.findByText(/Speedy Otter 27 will be offered the warm-up again/)).toBeInTheDocument();
    expect(screen.getByText(/warm-up not done yet/)).toBeInTheDocument();
    expect(screen.getByText(/Furthest place: ×6, ×9/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Offer the warm-up again' })).toBeNull();
  });

  it('says so when there was nothing to clear', async () => {
    const user = userEvent.setup();
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info({ placed: 'skipped' }));
    vi.mocked(skillMap.resetPlacement).mockResolvedValue(false);
    show();
    await user.click(await screen.findByRole('button', { name: 'Offer the warm-up again' }));
    await user.click(screen.getByRole('button', { name: 'Yes, offer it again' }));
    expect(await screen.findByText('Speedy Otter 27 had no warm-up to clear.')).toBeInTheDocument();
  });

  it("shows the database's message when it refuses (not their teacher)", async () => {
    const user = userEvent.setup();
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info({ placed: 'done', placement: 'tables-6-9' }));
    vi.mocked(skillMap.resetPlacement).mockRejectedValue(new FriendlyError('That player isn’t in one of your classes.'));
    show();
    await user.click(await screen.findByRole('button', { name: 'Offer the warm-up again' }));
    await user.click(screen.getByRole('button', { name: 'Yes, offer it again' }));
    expect(await screen.findByText('That player isn’t in one of your classes.')).toBeInTheDocument();
    expect(screen.getByText(/warm-up done/)).toBeInTheDocument(); // nothing changed on screen
  });

  it('shows the message when the student cannot be read, and no button', async () => {
    vi.mocked(skillMap.fetchStudentLadder).mockRejectedValue(new FriendlyError('That player isn’t in one of your classes.'));
    show();
    expect(await screen.findByText('That player isn’t in one of your classes.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says the warm-up is not offered when auto is off for their class', async () => {
    vi.mocked(skillMap.fetchStudentLadder).mockResolvedValue(info({ on: false, placed: 'skipped' }));
    show();
    expect(await screen.findByText(/Auto is off for their class/)).toBeInTheDocument();
  });
});
