import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as data from '../data/focus';
import { AUTO_FOCUS, type MathsFocus } from '../../shared/maths/focus';
import MathsFocusCard from './MathsFocusCard';

vi.mock('../data/focus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/focus')>()),
  fetchMyFocus: vi.fn(),
  saveMyFocus: vi.fn(),
  clearMyFocus: vi.fn(),
}));

const mine: MathsFocus = { source: 'student', skills: ['facts-10'], onlyThese: true, endsAt: null, canChoose: true, own: { skills: ['facts-10'], onlyThese: true } };

beforeEach(() => {
  vi.mocked(data.fetchMyFocus).mockReset();
  vi.mocked(data.saveMyFocus).mockReset();
  vi.mocked(data.clearMyFocus).mockReset();
});

describe('My maths focus on the home page', () => {
  it('saves their own pick', async () => {
    vi.mocked(data.fetchMyFocus).mockResolvedValue(AUTO_FOCUS);
    vi.mocked(data.saveMyFocus).mockResolvedValue(mine);
    const user = userEvent.setup();
    render(<MathsFocusCard />);
    await user.click(await screen.findByRole('button', { name: 'Pick my own focus' }));
    const save = screen.getByRole('button', { name: 'Save my focus' });
    expect(save).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Back to auto' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Number facts to 10/ }));
    await user.click(screen.getByRole('checkbox', { name: /Only these/ }));
    await user.click(save);
    expect(data.saveMyFocus).toHaveBeenCalledWith(['facts-10'], true);
    expect(await screen.findByText('You picked Number facts to 10')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/Saved/);
    expect(screen.getByRole('button', { name: 'Change my focus' })).toBeInTheDocument();
  });
});
