import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as gate from '../data/trainingGate';
import { TrainingFirstSwitch } from './TeacherTrainingFirst';

vi.mock('../data/trainingGate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/trainingGate')>()),
  fetchTrainingFirst: vi.fn(),
  saveTrainingFirst: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(gate.fetchTrainingFirst).mockReset().mockResolvedValue(false);
  vi.mocked(gate.saveTrainingFirst).mockReset().mockResolvedValue();
});

describe('the Training before games switch on the Teacher page', () => {
  it('is off to start with, says what it does, and switches on and off', async () => {
    const user = userEvent.setup();
    render(<TrainingFirstSwitch />);
    expect(await screen.findByText(/Off for this class/)).toBeInTheDocument();
    expect(screen.getByText(/stay open for 6 hours/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch Training before games on' }));
    expect(gate.saveTrainingFirst).toHaveBeenCalledWith(true, null);
    expect(await screen.findByRole('status')).toHaveTextContent('Training before games: On.');
    await user.click(screen.getByRole('button', { name: 'Switch Training before games off' }));
    expect(gate.saveTrainingFirst).toHaveBeenLastCalledWith(false, null);
  });

  it('keeps the old setting and says so when saving fails', async () => {
    vi.mocked(gate.saveTrainingFirst).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    render(<TrainingFirstSwitch />);
    await user.click(await screen.findByRole('button', { name: 'Switch Training before games on' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Switch Training before games on' })).toBeInTheDocument();
  });

  it('says when the setting can’t be loaded', async () => {
    vi.mocked(gate.fetchTrainingFirst).mockRejectedValue(new Error('offline'));
    render(<TrainingFirstSwitch />);
    expect(await screen.findByRole('status')).toHaveTextContent('We couldn’t load this setting.');
  });
});
