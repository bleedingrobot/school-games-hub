import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
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
  it('starts a game, lets the student move, and the bot replies', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));

    expect(screen.getByRole('group', { name: /Chess board. You are white/ })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Your turn');

    await user.click(square('e2'));
    expect(square('e2')).toHaveAccessibleName('e2, white pawn, selected');
    expect(square('e4')).toHaveAccessibleName('e4, you can move here');
    expect(square('e3')).toHaveAccessibleName('e3, you can move here');
    expect(square('e5')).toHaveAccessibleName('e5');

    await user.click(square('e4'));
    expect(square('e4')).toHaveAccessibleName('e4, white pawn');
    expect(screen.getByText(/bot is thinking/)).toBeInTheDocument();

    // The bot waits a moment, then moves.
    await waitFor(() => expect(screen.getByText('Your turn')).toBeInTheDocument(), { timeout: 3000 });
    const moves = within(screen.getByRole('region', { name: 'Moves' })).getAllByRole('listitem');
    expect(moves).toHaveLength(1);
    expect(moves[0].textContent).toMatch(/^1\.e4\S+/);
  });

});
