import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
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

const square = (n: number) => screen.getByRole('button', { name: new RegExp(`^Square ${n}(,|$)`) });

describe('playing checkers against a bot', () => {
  it('starts a game, lets the student move, and the bot replies', async () => {
    const user = userEvent.setup();
    renderGame();
    expect(screen.getByText(/Only thinks about the move it’s making/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Start game/ }));

    expect(screen.getByRole('group', { name: /Checkers board. You are red/ })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Your turn');

    await user.click(square(11));
    expect(square(11)).toHaveAccessibleName('Square 11, red piece (yours), selected');
    expect(square(15)).toHaveAccessibleName('Square 15, you can move here');
    expect(square(16)).toHaveAccessibleName('Square 16, you can move here');
    expect(square(14)).toHaveAccessibleName('Square 14');

    await user.click(square(15));
    expect(square(15)).toHaveAccessibleName('Square 15, red piece (yours)');
    expect(screen.getByText(/bot is thinking/)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/^Your turn/), { timeout: 3000 });
    const moves = within(screen.getByRole('region', { name: 'Moves' })).getAllByRole('listitem');
    expect(moves).toHaveLength(1);
    expect(moves[0].textContent).toMatch(/^1\.11 – 15\d/);
  });
});
