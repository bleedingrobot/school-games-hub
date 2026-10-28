import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as space from '../data/spaceGames';
import * as teacher from '../data/teacher';
import { space as wormholes } from '../games/space';
import { MathsSwitchSetting } from '../teacher/Games';

// Wormholes & Black Holes' maths switch, as it sits in its row of the Games table.
const MathsSwitchPanel = () => <MathsSwitchSetting game={wormholes} classId="c12" />;

vi.mock('../data/spaceGames', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/spaceGames')>()),
  fetchMathsSwitch: vi.fn(),
  fetchReactionsEnabled: vi.fn(),
}));
vi.mock('../data/teacher', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/teacher')>()),
  setSpaceMaths: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(space.fetchMathsSwitch).mockResolvedValue('choose');
  vi.mocked(teacher.setSpaceMaths).mockReset();
  vi.mocked(teacher.setSpaceMaths).mockResolvedValue();
});

describe('the Mission Control maths switch on the Games table', () => {
  it('shows the current setting, with all three choices', async () => {
    render(<MathsSwitchPanel />);
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Off/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /On for everyone/ })).not.toBeChecked();
  });

  it('saves a change and says so', async () => {
    const user = userEvent.setup();
    render(<MathsSwitchPanel />);
    await user.click(await screen.findByRole('radio', { name: /^Off/ }));
    expect(teacher.setSpaceMaths).toHaveBeenCalledWith('off', 'c12');
    expect(await screen.findByRole('status')).toHaveTextContent('Saved ✓');
    expect(screen.getByRole('radio', { name: /^Off/ })).toBeChecked();
  });

  it('keeps the old setting and says why when saving fails', async () => {
    vi.mocked(teacher.setSpaceMaths).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<MathsSwitchPanel />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('radio', { name: /Students choose/ })).toBeChecked();
  });
});
