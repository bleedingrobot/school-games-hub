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

const teacher: MathsFocus = { source: 'teacher-class', skills: ['tables-6-9'], onlyThese: false, endsAt: '2099-01-01T11:00:00Z', canChoose: true, own: null };
const mine: MathsFocus = { source: 'student', skills: ['facts-10'], onlyThese: true, endsAt: null, canChoose: true, own: { skills: ['facts-10'], onlyThese: true } };

beforeEach(() => {
  vi.mocked(data.fetchMyFocus).mockReset();
  vi.mocked(data.saveMyFocus).mockReset();
  vi.mocked(data.clearMyFocus).mockReset();
});

describe('My maths focus on the home page', () => {
  it('says the games pick for them on auto, and lets them pick', async () => {
    vi.mocked(data.fetchMyFocus).mockResolvedValue(AUTO_FOCUS);
    render(<MathsFocusCard />);
    expect(await screen.findByText(/Auto: the games pick the next maths for you/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick my own focus' })).toBeInTheDocument();
  });

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

  it('starts the form from what they picked before, and can go back to auto', async () => {
    vi.mocked(data.fetchMyFocus).mockResolvedValue(mine);
    vi.mocked(data.clearMyFocus).mockResolvedValue(AUTO_FOCUS);
    const user = userEvent.setup();
    render(<MathsFocusCard />);
    await user.click(await screen.findByRole('button', { name: 'Change my focus' }));
    expect(screen.getByRole('checkbox', { name: /Number facts to 10/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Only these/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Back to auto' }));
    expect(data.clearMyFocus).toHaveBeenCalled();
    expect(await screen.findByText(/Auto: the games pick/)).toBeInTheDocument();
  });

  it('can be cancelled', async () => {
    vi.mocked(data.fetchMyFocus).mockResolvedValue(AUTO_FOCUS);
    const user = userEvent.setup();
    render(<MathsFocusCard />);
    await user.click(await screen.findByRole('button', { name: 'Pick my own focus' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save my focus' })).not.toBeInTheDocument();
  });

  it('shows a teacher\'s focus, says it can not be changed, and what they go back to', async () => {
    vi.mocked(data.fetchMyFocus).mockResolvedValue({ ...teacher, own: { skills: ['facts-10'], onlyThese: false } });
    render(<MathsFocusCard />);
    expect(await screen.findByText(/Your teacher picked ×6, ×9 until/)).toBeInTheDocument();
    expect(screen.getByText(/You can’t change it until it ends/)).toBeInTheDocument();
    expect(screen.getByText(/After that you go back to your own pick: Number facts to 10/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /focus/ })).not.toBeInTheDocument();
  });

  it('says so when the teacher has turned choosing off', async () => {
    vi.mocked(data.fetchMyFocus).mockResolvedValue({ ...AUTO_FOCUS, canChoose: false });
    render(<MathsFocusCard />);
    expect(await screen.findByText(/Your teacher has set the games to pick for you/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick my own focus' })).not.toBeInTheDocument();
  });

  it('shows the database\'s words when saving is refused', async () => {
    vi.mocked(data.fetchMyFocus).mockResolvedValue(AUTO_FOCUS);
    const { FriendlyError } = await import('../data/profile');
    vi.mocked(data.saveMyFocus).mockRejectedValue(new FriendlyError('Your teacher has turned off choosing your own maths focus.'));
    const user = userEvent.setup();
    render(<MathsFocusCard />);
    await user.click(await screen.findByRole('button', { name: 'Pick my own focus' }));
    await user.click(screen.getByRole('checkbox', { name: /Number facts to 10/ }));
    await user.click(screen.getByRole('button', { name: 'Save my focus' }));
    expect(await screen.findByText('Your teacher has turned off choosing your own maths focus.')).toBeInTheDocument();
  });

  it('shows nothing until it knows', () => {
    vi.mocked(data.fetchMyFocus).mockReturnValue(new Promise(() => {}));
    const { container } = render(<MathsFocusCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
