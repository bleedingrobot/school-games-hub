import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as mine from '../data/mine';
import { MineTeacherPanel } from './TeacherMine';

vi.mock('../data/mine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/mine')>()),
  fetchMineMaths: vi.fn(),
  saveMineMaths: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(mine.fetchMineMaths).mockResolvedValue('choose');
  vi.mocked(mine.saveMineMaths).mockReset().mockResolvedValue();
});

describe('the Mine Runner maths switch on the Teacher page', () => {
  it('shows the current setting, with all three choices', async () => {
    render(<MineTeacherPanel />);
    expect(await screen.findByRole('radio', { name: /Students choose/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Off/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /On for everyone/ })).not.toBeChecked();
  });

  it('saves a change and says so', async () => {
    const user = userEvent.setup();
    render(<MineTeacherPanel />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    expect(mine.saveMineMaths).toHaveBeenCalledWith('on', null);
    expect(await screen.findByRole('status')).toHaveTextContent('Mine Runner maths: On for everyone.');
    expect(screen.getByRole('radio', { name: /On for everyone/ })).toBeChecked();
  });

  it('keeps the old setting and says why when saving fails', async () => {
    vi.mocked(mine.saveMineMaths).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<MineTeacherPanel />);
    await user.click(await screen.findByRole('radio', { name: /On for everyone/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('radio', { name: /Students choose/ })).toBeChecked();
  });

  it('says so when the setting cannot be loaded', async () => {
    vi.mocked(mine.fetchMineMaths).mockRejectedValue(new Error('down'));
    render(<MineTeacherPanel />);
    expect(await screen.findByRole('status')).toHaveTextContent('couldn’t load');
  });
});
