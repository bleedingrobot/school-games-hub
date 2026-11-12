import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { saveBotGame } from '../../data/botGames';
import { SoundProvider } from '../../sound';
import { ChessPlay } from './ChessPlay';

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
        <MemoryRouter initialEntries={['/chess?bot=very-easy']}>
          <ChessPlay level="very-easy" />
        </MemoryRouter>
      </AuthContext.Provider>
    </SoundProvider>,
  );
}

const square = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}(,|$)`) });

describe('playing chess against a bot', () => {
  it('asks before resigning, then shows a friendly result and saves it', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    await user.click(square('d2'));
    await user.click(square('d4'));
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument(), { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: /Resign/ }));
    expect(screen.getByText(/count as a loss/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Resign/ }));
    await user.click(screen.getByRole('button', { name: 'Yes, resign' }));
    const result = screen.getByRole('dialog', { name: 'The bot won this time' });
    expect(within(result).getByText(/You resigned/)).toBeInTheDocument();
    await waitFor(() => expect(within(result).getByText('✓ Saved to your games')).toBeInTheDocument());
    expect(saveBotGame).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 'very-easy', studentColour: 'white', ending: 'resigned' }),
    );
    expect(vi.mocked(saveBotGame).mock.lastCall![0].moves[0]).toBe('d2d4');

    await user.click(within(result).getByRole('button', { name: 'Play again' }));
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
