import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as marble from '../data/marble';
import { marbleRush } from '../games/marble';
import { MathsSwitchSetting } from '../teacher/Games';
import { MarbleTeacherSettings } from './TeacherMarble';

// Marble Rush on the teacher's Games table: the maths switch in its row, and the rescue questions in its Settings.
vi.mock('../data/marble', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/marble')>()),
  fetchMarbleSwitches: vi.fn(),
  saveMarbleMaths: vi.fn(),
  saveMarbleRescue: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(marble.fetchMarbleSwitches).mockReset().mockResolvedValue({ maths: 'choose', rescue: true });
  vi.mocked(marble.saveMarbleMaths).mockReset().mockResolvedValue();
  vi.mocked(marble.saveMarbleRescue).mockReset().mockResolvedValue();
});

describe('the Marble Rush maths switch on the Games table', () => {
  it('shows the current setting, with all three choices', async () => {
    render(<MathsSwitchSetting game={marbleRush} classId="c12" />);
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    expect(marble.fetchMarbleSwitches).toHaveBeenCalledWith('c12');
    expect(screen.getByRole('radio', { name: /^Off/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /On for everyone/ })).not.toBeChecked();
  });

  it('saves a change for the class and says so', async () => {
    const user = userEvent.setup();
    render(<MathsSwitchSetting game={marbleRush} classId="c12" />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    expect(marble.saveMarbleMaths).toHaveBeenCalledWith('on', 'c12');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('keeps the old setting and says why when saving fails', async () => {
    vi.mocked(marble.saveMarbleMaths).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<MathsSwitchSetting game={marbleRush} classId="c12" />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /Students choose/ })).toBeChecked());
    expect(screen.getByRole('status')).toHaveTextContent('Something went wrong');
  });
});

describe('Marble Rush’s Settings: the rescue questions', () => {
  it('switches rescue questions off and back on for the class, as a switch that is never red', async () => {
    const user = userEvent.setup();
    const { container } = render(<MarbleTeacherSettings classId="c12" />);
    const rescue = await screen.findByRole('switch', { name: 'Rescue questions' });
    await waitFor(() => expect(rescue).toHaveAttribute('aria-checked', 'true'));
    expect(container.querySelector('.button--danger')).toBeNull();
    await user.click(rescue);
    expect(marble.saveMarbleRescue).toHaveBeenCalledWith(false, 'c12');
    expect(rescue).toHaveAttribute('aria-checked', 'false');
    await user.click(rescue);
    expect(marble.saveMarbleRescue).toHaveBeenLastCalledWith(true, 'c12');
  });

  it('has no rescue switch while maths is off, and says why', async () => {
    vi.mocked(marble.fetchMarbleSwitches).mockResolvedValue({ maths: 'off', rescue: true });
    render(<MarbleTeacherSettings classId="c12" />);
    expect(await screen.findByText(/Rescue questions are off while Marble Rush maths is off/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('says it couldn’t load, rather than blaming maths being off, when the settings can’t be read', async () => {
    vi.mocked(marble.fetchMarbleSwitches).mockRejectedValue(new Error('We couldn’t load this setting.'));
    render(<MarbleTeacherSettings classId="c12" />);
    expect(await screen.findByRole('status')).toHaveTextContent('couldn’t load');
    expect(screen.queryByText(/maths is off/)).toBeNull();
  });
});
