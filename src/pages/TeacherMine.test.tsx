import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as mine from '../data/mine';
import { MineTeacherPanel } from './TeacherMine';

vi.mock('../data/mine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/mine')>()),
  fetchMineMaths: vi.fn(),
  saveMineMaths: vi.fn(),
  fetchMineEnabled: vi.fn(),
  saveMineEnabled: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(mine.fetchMineMaths).mockResolvedValue('choose');
  vi.mocked(mine.saveMineMaths).mockReset().mockResolvedValue();
  vi.mocked(mine.fetchMineEnabled).mockResolvedValue(false);
  vi.mocked(mine.saveMineEnabled).mockReset().mockResolvedValue();
});

describe('the Mine Runner game switch on the Teacher page', () => {
  it('shows the game is off to start with, and switches it on and off', async () => {
    const user = userEvent.setup();
    render(<MineTeacherPanel />);
    await user.click(await screen.findByRole('button', { name: 'Switch Mine Runner on' }));
    expect(mine.saveMineEnabled).toHaveBeenCalledWith(true, null);
    expect(await screen.findByRole('status')).toHaveTextContent('Mine Runner: On.');
    await user.click(await screen.findByRole('button', { name: 'Switch Mine Runner off' }));
    expect(mine.saveMineEnabled).toHaveBeenLastCalledWith(false, null);
  });

  it('says why when the switch cannot be saved, and keeps the old setting', async () => {
    vi.mocked(mine.saveMineEnabled).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<MineTeacherPanel />);
    await user.click(await screen.findByRole('button', { name: 'Switch Mine Runner on' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Switch Mine Runner on' })).toBeInTheDocument();
  });
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
