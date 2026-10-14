import { useMemo, useState } from 'react';
import { chessColour, sideToMove } from '../../../shared/multiplayer';
import { Chess, replay, type PromotionPiece, type Square } from '../../../shared/chess/rules';
import { FriendGameScreen, type EndingText, type MoveRow } from '../../multiplayer/FriendGameScreen';
import type { FriendSession } from '../../multiplayer/useFriendGame';
import { Board } from './Board';
import { Captured, figurine } from './moveText';

const ENDINGS: EndingText = {
  checkmate: {
    won: 'Checkmate! {them}’s king is trapped. Brilliant!',
    lost: 'Checkmate. {them} trapped your king this time.',
  },
  stalemate: {
    drawn: 'Stalemate! It’s someone’s turn, but they have no legal moves and aren’t in check. That’s a draw.',
  },
  'threefold-repetition': { drawn: 'The same position happened three times, so it’s a draw.' },
  'fifty-moves': { drawn: '50 moves each without a capture or a pawn move, so it’s a draw.' },
  'not-enough-pieces': { drawn: 'There aren’t enough pieces left for anyone to checkmate, so it’s a draw.' },
};

/** A chess game against another student. The server referees; this just draws it. */
export function ChessFriendGame({ session }: { session: FriendSession }) {
  const { game, mySide, busy, act } = session;
  // My move shows straight away while the server checks it.
  const [pending, setPending] = useState<string | null>(null);
  const moves = useMemo(() => (pending ? [...game.moves, pending] : game.moves), [game.moves, pending]);

  const chess = useMemo(() => {
    for (const list of [moves, game.moves]) {
      const replayed = replay(list);
      if (replayed.ok) return replayed.chess;
    }
    return new Chess();
  }, [moves, game.moves]);

  const history = chess.history({ verbose: true });
  const rows: MoveRow[] = [];
  history.forEach((move, i) => {
    const row = Math.floor(i / 2);
    rows[row] ??= { number: row + 1 };
    rows[row][move.color === 'w' ? 'first' : 'second'] = figurine(move.san, move.color);
  });
  const last = history[history.length - 1];
  const captured = (by: 'w' | 'b') =>
    history.filter((m) => m.color === by && m.captured).map((m) => ({ type: m.captured!, colour: by === 'w' ? 'b' : 'w' }));
  const myCode = mySide === 'first' ? 'w' : 'b';
  const theirCode = myCode === 'w' ? 'b' : 'w';
  const myTurn = game.status === 'playing' && sideToMove(moves.length) === mySide;

  async function move(from: Square, to: Square, promotion?: PromotionPiece) {
    const uci = from + to + (promotion ?? '');
    setPending(uci);
    await act({ action: 'move', gameId: game.id, move: uci, ply: game.moves.length });
    setPending(null);
  }

  return (
    <FriendGameScreen
      session={session}
      board={
        <Board
          chess={chess}
          orientation={chessColour(mySide)}
          canMove={myTurn && !pending && !busy}
          lastMove={last ? { from: last.from, to: last.to } : null}
          onMove={(from, to, promotion) => void move(from, to, promotion)}
        />
      }
      rows={rows}
      alert={chess.inCheck() ? 'Check! Your king is under attack. Keep it safe!' : null}
      endings={ENDINGS}
      lastMoveSound={!last ? null : chess.inCheck() ? 'alert' : last.captured ? 'capture' : 'move'}
      captured={[
        <Captured key="them" pieces={captured(theirCode)} who={session.opponent?.display_name ?? 'Your opponent'} />,
        <Captured key="me" pieces={captured(myCode)} who="You" />,
      ]}
    />
  );
}
