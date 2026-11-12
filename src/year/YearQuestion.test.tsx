import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { FriendlyError } from '../data/profile';
import { YearGate } from './YearQuestion';

const data = vi.hoisted(() => ({ fetchMyYear: vi.fn(), saveMyYear: vi.fn(), speak: vi.fn() }));
vi.mock('../data/years', async (original) => ({
  ...(await original<typeof import('../data/years')>()),
  fetchMyYear: data.fetchMyYear,
  saveMyYear: data.saveMyYear,
}));
vi.mock('../speech', async (original) => ({ ...(await original<typeof import('../speech')>()), speak: data.speak }));

function show(role: 'student' | 'teacher' = 'student') {
  const auth: AuthState = {
    status: 'signed-in',
    profile: { id: 'p1', display_name: 'Brave Kiwi 7', avatar: {}, role },
    message: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <YearGate>
        <p>The home page</p>
      </YearGate>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sgh-read-aloud', 'true');
  for (const fn of Object.values(data)) fn.mockReset();
  data.fetchMyYear.mockResolvedValue({ student: true, year: null });
  data.saveMyYear.mockResolvedValue(undefined);
});

describe('the year question', () => {
  it('asks a new pupil, reads it aloud, checks the pick, then saves it', async () => {
    const user = userEvent.setup();
    show();
    expect(await screen.findByRole('heading', { name: 'What year are you in at school?' })).toBeInTheDocument();
    await waitFor(() => expect(data.speak).toHaveBeenCalledWith('What year are you in at school?', 'voice/year/', undefined));
    await user.click(screen.getByRole('button', { name: 'Year 4' }));
    expect(screen.getByRole('heading', { name: 'Year 4. Is that right?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /No, go back/ }));
    await user.click(screen.getByRole('button', { name: 'Year 3' }));
    await user.click(screen.getByRole('button', { name: /Yes!/ }));
    expect(data.saveMyYear).toHaveBeenCalledWith(3);
    await user.click(await screen.findByRole('button', { name: /Let’s play/ }));
    expect(screen.getByText('The home page')).toBeInTheDocument();
  });

  it('lets a pupil who isn’t sure play, and asks again another day', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: /I’m not sure/ }));
    expect(screen.getByRole('heading', { name: 'That’s okay! Your teacher will add it for you.' })).toBeInTheDocument();
    expect(data.saveMyYear).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Let’s play/ }));
    expect(screen.getByText('The home page')).toBeInTheDocument();
  });

  it('shows the page as normal for a pupil with a year, a teacher, or when the check fails', async () => {
    data.fetchMyYear.mockResolvedValue({ student: true, year: 5 });
    show();
    expect(await screen.findByText('The home page')).toBeInTheDocument();
    await Promise.resolve();
    expect(screen.queryByRole('heading', { name: /What year/ })).not.toBeInTheDocument();
  });

  it('never asks a teacher', () => {
    show('teacher');
    expect(screen.getByText('The home page')).toBeInTheDocument();
    expect(data.fetchMyYear).not.toHaveBeenCalled();
  });

  it('stays on the check with a message when saving fails', async () => {
    data.saveMyYear.mockRejectedValue(new FriendlyError('We couldn’t save that. Please try again.'));
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Year 6' }));
    await user.click(screen.getByRole('button', { name: /Yes!/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t save that. Please try again.');
    expect(screen.getByRole('heading', { name: 'Year 6. Is that right?' })).toBeInTheDocument();
  });
});
