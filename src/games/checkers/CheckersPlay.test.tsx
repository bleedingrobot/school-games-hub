import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { saveBotGame } from '../../data/botGames';
import { SoundProvider } from '../../sound';
import { CheckersPlay } from './CheckersPlay';

vi.mock('../../data/botGames', () => ({
  saveBotGame: vi.fn(async () => {}),
  saveAbandonedGame: vi.fn(),
  refreshSaveToken: vi.fn(async () => {}),
}));

const auth: AuthState = {
  status: 'signed-in',
  profile: { id: 'u1', display_name: 'Speedy Otter 27', avatar: {}, role: 'student' },
  message: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
};

function renderGame() {
  return render(
    <SoundProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/checkers?bot=very-easy']}>
          <CheckersPlay level="very-easy" />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

describe('playing checkers against a bot', () => {
  it('asks before resigning, shows a friendly result, saves it, and offers a rematch', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('radio', { name: 'White' }));
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    expect(screen.getByRole('group', { name: /You are white/ })).toBeInTheDocument();
    // The bot (Red) goes first.
    await waitFor(() => expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/^Your turn/), { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: /Resign/ }));
    expect(screen.getByText(/count as a loss/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, resign' }));
    const result = screen.getByRole('dialog', { name: 'The bot won this time' });
    expect(within(result).getByText(/You resigned/)).toBeInTheDocument();
    await waitFor(() => expect(within(result).getByText('✓ Saved to your games')).toBeInTheDocument());
    expect(saveBotGame).toHaveBeenLastCalledWith(
      expect.objectContaining({ game: 'checkers', level: 'very-easy', studentColour: 'white', ending: 'resigned' }),
    );
    expect(vi.mocked(saveBotGame).mock.lastCall![0].moves).toHaveLength(1);

    await user.click(within(result).getByRole('button', { name: 'Rematch' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /You are white/ })).toBeInTheDocument();
  });
});
