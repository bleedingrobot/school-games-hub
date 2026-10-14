import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Chess } from '../../../shared/chess/rules';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { saveAbandonedGame, saveBotGame } from '../../data/botGames';
import { SoundProvider } from '../../sound';
import { Board } from './Board';
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

  it('works with the keyboard', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    // The keyboard starts on e2. Select it, go up two squares, and move.
    square('e2').focus();
    await user.keyboard('{Enter}{ArrowUp}{ArrowUp}{Enter}');
    expect(square('e4')).toHaveAccessibleName('e4, white pawn');
  });

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

  it('records a game the student leaves part-way through, but not one they never started', async () => {
    const user = userEvent.setup();
    vi.mocked(saveAbandonedGame).mockClear();
    const first = renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    first.unmount();
    expect(saveAbandonedGame).not.toHaveBeenCalled();

    renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    await user.click(square('g1'));
    await user.click(square('f3'));
    await user.click(screen.getByRole('button', { name: 'New game' }));
    await user.click(screen.getByRole('button', { name: 'Yes, start again' }));
    expect(saveAbandonedGame).toHaveBeenCalledWith(
      expect.objectContaining({ ending: 'abandoned', moves: expect.arrayContaining(['g1f3']) }),
    );
  });
});

describe('the board', () => {
  it('lets a pawn that reaches the end become the piece the student picks', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(
      <Board chess={new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1')} orientation="white" canMove lastMove={null} onMove={onMove} />,
    );
    await user.click(square('e7'));
    await user.click(square('e8'));
    const picker = screen.getByRole('dialog', { name: /Pick a new piece/ });
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Queen',
      'Rook',
      'Bishop',
      'Knight',
      'Cancel',
    ]);
    await user.click(within(picker).getByRole('button', { name: 'Knight' }));
    expect(onMove).toHaveBeenCalledWith('e7', 'e8', 'n');
  });

  it('shows check and the last move, and is drawn from black’s side for black', () => {
    // Black to move and in check from the bishop on b5.
    const chess = new Chess('r3k3/8/8/1B6/8/8/8/4K3 b q - 0 1');
    const { container } = render(
      <Board chess={chess} orientation="black" canMove lastMove={{ from: 'a4', to: 'b5' }} onMove={() => {}} />,
    );
    expect(square('e8')).toHaveAccessibleName('e8, black king, in check');
    expect(square('b5')).toHaveClass('is-last');
    // From black's side, the first square drawn (top-left) is h1.
    expect(container.querySelector('.board__square')).toHaveAccessibleName('h1');
  });

  it('does nothing when it is not the student’s turn', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board chess={new Chess()} orientation="white" canMove={false} lastMove={null} onMove={onMove} />);
    await user.click(square('e2'));
    await user.click(square('e4'));
    expect(onMove).not.toHaveBeenCalled();
  });
});
