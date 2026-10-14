import { useMemo, useState } from 'react';
import { checkersColour, sideToMove } from '../../../shared/multiplayer';
import { mustCapture, replay, startPosition, type CheckersMove, type Colour } from '../../../shared/checkers/rules';
import { FriendGameScreen, type EndingText, type MoveRow } from '../../multiplayer/FriendGameScreen';
import type { FriendSession } from '../../multiplayer/useFriendGame';
import { Board } from './Board';
import { Captured, pretty } from './moveText';

const ENDINGS: EndingText = {
  'no-pieces': {
    won: 'You captured every one of {them}’s pieces. Brilliant!',
    lost: '{them} captured all of your pieces this time.',
  },
  'no-moves': {
    won: '{them}’s pieces are all blocked, so they can’t move. You win!',
    lost: 'All of your pieces are blocked, so you can’t move. {them} wins this time.',
  },
  'forty-moves': { drawn: '40 moves each with no capture and no new king, so it’s a draw.' },
};

/** A checkers game against another student. The server referees; this just draws it. */
export function CheckersFriendGame({ session }: { session: FriendSession }) {
  const { game, mySide, busy, act } = session;
  const [hint, setHint] = useState('');
  // My move shows straight away while the server checks it.
  const [pending, setPending] = useState<string | null>(null);
  const moves = useMemo(() => (pending ? [...game.moves, pending] : game.moves), [game.moves, pending]);

  const { position, played } = useMemo(() => {
    for (const list of [moves, game.moves]) {
      const replayed = replay(list);
      if (replayed.ok) return replayed;
    }
    return { position: startPosition(), played: [] as CheckersMove[] };
  }, [moves, game.moves]);

  const rows: MoveRow[] = [];
  played.forEach((move, i) => {
    const row = Math.floor(i / 2);
    rows[row] ??= { number: row + 1 };
    rows[row][i % 2 === 0 ? 'first' : 'second'] = pretty(move.notation) + (move.crowns ? ' ♛' : '');
  });
  const myColour = checkersColour(mySide);
  const theirColour: Colour = myColour === 'red' ? 'white' : 'red';
  const capturedBy = (colour: Colour) =>
    played.filter((_, i) => (i % 2 === 0 ? 'red' : 'white') === colour).reduce((n, m) => n + m.captures.length, 0);
  const myTurn = game.status === 'playing' && sideToMove(moves.length) === mySide;
  const canMove = myTurn && !pending && !busy;
  const jumpRequired = canMove && mustCapture(position);
  const last = played[played.length - 1];

  async function move(notation: string) {
    setPending(notation);
    await act({ action: 'move', gameId: game.id, move: notation, ply: game.moves.length });
    setPending(null);
  }

  return (
    <FriendGameScreen
      session={session}
      board={
        <Board
          position={position}
          orientation={myColour}
          canMove={canMove}
          lastMove={last?.path ?? null}
          onMove={(m) => void move(m.notation)}
          onHint={setHint}
        />
      }
      rows={rows}
      alert={jumpRequired ? 'Your turn: you must jump!' : null}
      note={
        hint ? (
          <p className="chess-note" role="alert">
            {hint}
          </p>
        ) : jumpRequired ? (
          <p className="chess-note">When you can jump, you have to. The pieces that can jump are glowing.</p>
        ) : null
      }
      endings={ENDINGS}
      lastMoveSound={!last ? null : last.crowns ? 'alert' : last.captures.length > 0 ? 'capture' : 'move'}
      captured={[
        <Captured
          key="them"
          count={capturedBy(theirColour)}
          colour={myColour}
          who={session.opponent?.display_name ?? 'Your opponent'}
        />,
        <Captured key="me" count={capturedBy(myColour)} colour={theirColour} who="You" />,
      ]}
    />
  );
}
