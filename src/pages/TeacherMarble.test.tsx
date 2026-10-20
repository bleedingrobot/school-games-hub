import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as marble from '../data/marble';
import { MarbleTeacherPanel } from './TeacherMarble';

vi.mock('../data/marble', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/marble')>()),
  fetchMarbleSwitches: vi.fn(),
  saveMarbleMaths: vi.fn(),
  saveMarbleRescue: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(marble.fetchMarbleSwitches).mockResolvedValue({ maths: 'choose', rescue: true });
  vi.mocked(marble.saveMarbleMaths).mockReset().mockResolvedValue();
  vi.mocked(marble.saveMarbleRescue).mockReset().mockResolvedValue();
});

describe('the Marble Rush maths switches on the Teacher page', () => {
  it('shows the current setting, with all three choices', async () => {
    render(<MarbleTeacherPanel />);
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Off/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /On for everyone/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Switch rescue questions off' })).toBeInTheDocument();
  });

  it('saves a change and says so', async () => {
    const user = userEvent.setup();
    render(<MarbleTeacherPanel />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    expect(marble.saveMarbleMaths).toHaveBeenCalledWith('on', null);
    expect(await screen.findByRole('status')).toHaveTextContent('Marble Rush maths: On for everyone.');
  });

  it('switches rescue questions off and back on', async () => {
    const user = userEvent.setup();
    render(<MarbleTeacherPanel />);
    await user.click(await screen.findByRole('button', { name: 'Switch rescue questions off' }));
    expect(marble.saveMarbleRescue).toHaveBeenCalledWith(false, null);
    await user.click(await screen.findByRole('button', { name: 'Switch rescue questions on' }));
    expect(marble.saveMarbleRescue).toHaveBeenLastCalledWith(true, null);
  });

  it('has no rescue button while maths is off', async () => {
    vi.mocked(marble.fetchMarbleSwitches).mockResolvedValue({ maths: 'off', rescue: true });
    render(<MarbleTeacherPanel />);
    await screen.findByRole('radio', { name: /^Off/ });
    expect(screen.queryByRole('button', { name: /rescue/ })).toBeNull();
  });

  it('keeps the old setting and says why when saving fails', async () => {
    vi.mocked(marble.saveMarbleMaths).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<MarbleTeacherPanel />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('radio', { name: /Students choose/ })).toBeChecked();
  });
});
