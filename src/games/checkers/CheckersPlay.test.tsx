import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { positionFromRows } from '../../../shared/checkers/rules';
import { AuthContext, type AuthState } from '../../auth/AuthContext';
import { saveAbandonedGame, saveBotGame } from '../../data/botGames';
import { SoundProvider } from '../../sound';
import { Board } from './Board';
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

  it('works with the keyboard', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    // The keyboard starts on square 11. Select it, go up one square diagonally, and move.
    square(11).focus();
    await user.keyboard('{Enter}{ArrowUp}{Enter}');
    expect(square(16)).toHaveAccessibleName('Square 16, red piece (yours)');
  });

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

  it('records a game the student leaves part-way through, but not one they never started', async () => {
    const user = userEvent.setup();
    vi.mocked(saveAbandonedGame).mockClear();
    const first = renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    first.unmount();
    expect(saveAbandonedGame).not.toHaveBeenCalled();

    renderGame();
    await user.click(screen.getByRole('button', { name: /Start game/ }));
    await user.click(square(9));
    await user.click(square(13));
    await user.click(screen.getByRole('button', { name: 'New game' }));
    await user.click(screen.getByRole('button', { name: 'Yes, start again' }));
    expect(saveAbandonedGame).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'checkers', ending: 'abandoned', moves: ['9-13'] }),
    );
  });
});

describe('the checkers board', () => {
  function renderBoard(rows: string[], orientation: 'red' | 'white' = 'red') {
    const onMove = vi.fn();
    const onHint = vi.fn();
    const utils = render(
      <Board
        position={positionFromRows(rows)}
        orientation={orientation}
        canMove
        lastMove={null}
        onMove={onMove}
        onHint={onHint}
      />,
    );
    return { onMove, onHint, ...utils };
  }

  it('makes a compulsory capture obvious, and explains why other pieces can’t move', async () => {
    const user = userEvent.setup();
    const { onMove, onHint } = renderBoard(['r...', '....', '....', '.r..', '.w..', '....', '....', '...w']);
    expect(square(14)).toHaveAccessibleName('Square 14, red piece (yours), can jump');
    expect(square(14)).toHaveClass('is-must-jump');
    expect(square(1)).not.toHaveClass('is-must-jump');

    await user.click(square(1));
    expect(onHint).toHaveBeenLastCalledWith(expect.stringMatching(/You have to jump/));
    expect(onMove).not.toHaveBeenCalled();

    await user.click(square(14));
    expect(square(23)).toHaveAccessibleName('Square 23, you can jump here');
    await user.click(square(23));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ notation: '14x23', captures: [18] }));
  });

  it('plays a multi-jump one step at a time when there is a choice of route', async () => {
    const user = userEvent.setup();
    const { onMove, onHint } = renderBoard(['r...', '.w..', '....', '.ww.', '....', '...w', '....', '....']);
    await user.click(square(1));
    await user.click(square(10));
    expect(onMove).not.toHaveBeenCalled();
    expect(onHint).toHaveBeenLastCalledWith('Keep jumping! Tap the next square.');
    expect(square(10)).toHaveAccessibleName('Square 10, your piece, jumping');
    expect(square(6)).toHaveAccessibleName('Square 6, white piece, jumped');
    expect(square(17)).toHaveAccessibleName('Square 17, you can jump here');
    expect(square(19)).toHaveAccessibleName('Square 19, you can jump here');
    // From 19 there's only one way on, so the rest of the jump happens in one tap.
    await user.click(square(19));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ notation: '1x10x19x28' }));
  });

  it('makes a multi-jump in one tap when there is only one route', async () => {
    const user = userEvent.setup();
    // Red king on 22 jumps 26 then 27: 22x31x24.
    const { onMove } = renderBoard(['....', '....', '....', '....', '....', '.R..', '.ww.', '....']);
    await user.click(square(22));
    await user.click(square(31));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ notation: '22x31x24' }));
  });

  it('shows kings, and is drawn from each player’s own side', () => {
    const { container, unmount } = renderBoard(['R...', '....', '....', '....', '....', '....', '....', '...W']);
    expect(square(1)).toHaveAccessibleName('Square 1, red king (yours)');
    expect(square(32)).toHaveAccessibleName('Square 32, white king');
    // Red's pieces start at the top of the standard board, so Red sees it turned round.
    expect(container.querySelector('button.board__square')).toHaveAccessibleName(/^Square 32/);
    unmount();
    const white = renderBoard(['R...', '....', '....', '....', '....', '....', '....', '...W'], 'white');
    expect(white.container.querySelector('button.board__square')).toHaveAccessibleName(/^Square 1,/);
  });

  it('does nothing when it is not the student’s turn', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(
      <Board
        position={positionFromRows(['....', '....', '....', '.r..', '.w..', '....', '....', '....'])}
        orientation="red"
        canMove={false}
        lastMove={[9, 14]}
        onMove={onMove}
        onHint={() => {}}
      />,
    );
    expect(square(14)).toHaveClass('is-last');
    await user.click(square(14));
    await user.click(square(23));
    expect(onMove).not.toHaveBeenCalled();
  });
});
