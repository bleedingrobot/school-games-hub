import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  legalMoves,
  mustCapture,
  pieceAt,
  rowCol,
  squareAt,
  type CheckersMove,
  type Colour,
  type Position,
} from '../../../shared/checkers/rules';

/**
 * The 64 squares in the order they're drawn, top-left first, from this player's side.
 * Each is a dark square's number, or null for a light square.
 */
export function cellsFor(orientation: Colour): (number | null)[] {
  const cells: (number | null)[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // Red's pieces start at the top of the standard board, so Red sees it turned round.
      cells.push(orientation === 'white' ? squareAt(row, col) : squareAt(7 - row, 7 - col));
    }
  }
  return cells;
}

/** Where a square is drawn on the screen (0 = top row, 0 = left column) for this player. */
function screenRowCol(square: number, orientation: Colour) {
  const { row, col } = rowCol(square);
  return orientation === 'white' ? { row, col } : { row: 7 - row, col: 7 - col };
}

function startsWith(path: number[], start: number[]) {
  return start.every((square, i) => path[i] === square);
}

export interface BoardProps {
  position: Position;
  /** The student's colour. Their pieces are at the bottom. */
  orientation: Colour;
  /** False while the bot is thinking or the game is over. */
  canMove: boolean;
  /** The squares the last move went through, to highlight. */
  lastMove: number[] | null;
  onMove: (move: CheckersMove) => void;
  /** A friendly tip when the student tries something that isn't allowed (or "" to clear it). */
  onHint: (hint: string) => void;
}

export function Board({ position, orientation, canMove, lastMove, onMove, onHint }: BoardProps) {
  // The squares the selected piece has been moved through so far: [start] after picking a
  // piece, then each landing square of a multi-jump, one tap at a time.
  const [path, setPath] = useState<number[]>([]);
  const [focused, setFocused] = useState<number>(orientation === 'red' ? 11 : 22);
  const squareRefs = useRef(new Map<number, HTMLButtonElement>());

  const cells = cellsFor(orientation);
  const allMoves = canMove ? legalMoves(position) : [];
  const jumpRequired = canMove && mustCapture(position);
  const movable = new Set(allMoves.map((m) => m.path[0]));
  const options = path.length > 0 ? allMoves.filter((m) => startsWith(m.path, path)) : [];
  const targets = new Set(options.map((m) => m.path[path.length]));
  const midJump = path.length > 1;
  // Pieces jumped so far in a multi-jump that's still being tapped out.
  const taken = new Set(options[0]?.captures.slice(0, path.length - 1) ?? []);

  // A new position (the bot moved, or a new game) clears any half-made move.
  useEffect(() => {
    setPath([]);
  }, [position, canMove]);

  function pick(move: CheckersMove) {
    setPath([]);
    onHint('');
    onMove(move);
  }

  function choose(square: number) {
    if (!canMove) return;
    if (path.length > 0 && targets.has(square)) {
      const next = [...path, square];
      const routes = options.filter((m) => startsWith(m.path, next));
      // Only one way to carry on from here: make the whole move in one go.
      if (routes.length === 1) pick(routes[0]);
      else {
        setPath(next);
        onHint('Keep jumping! Tap the next square.');
      }
      return;
    }
    const piece = pieceAt(position, square);
    if (piece?.colour === orientation && square !== path[0]) {
      if (movable.has(square)) {
        setPath([square]);
        onHint('');
      } else {
        setPath([]);
        onHint(
          jumpRequired
            ? 'You have to jump when you can! Pick one of the glowing pieces.'
            : 'That piece is blocked. Try a different one.',
        );
      }
      return;
    }
    if (piece && piece.colour !== orientation && path.length > 0) {
      onHint('To capture, tap the empty square on the other side of the piece you’re jumping.');
      return;
    }
    // Tapping anywhere else (or the selected piece again) cancels.
    setPath([]);
    onHint('');
  }

  function moveFocus(event: KeyboardEvent, square: number) {
    if (event.key === 'Escape') {
      setPath([]);
      onHint('');
      return;
    }
    const { row, col } = screenRowCol(square, orientation);
    const tries: Record<string, [number, number][]> = {
      ArrowLeft: [[row, col - 2]],
      ArrowRight: [[row, col + 2]],
      ArrowUp: [
        [row - 1, col - 1],
        [row - 1, col + 1],
      ],
      ArrowDown: [
        [row + 1, col + 1],
        [row + 1, col - 1],
      ],
    };
    const options = tries[event.key];
    if (!options) return;
    event.preventDefault();
    for (const [r, c] of options) {
      if (r < 0 || r > 7 || c < 0 || c > 7) continue;
      const next = cells[r * 8 + c];
      if (next === null) continue;
      setFocused(next);
      squareRefs.current.get(next)?.focus();
      return;
    }
  }

  function label(square: number) {
    const piece = pieceAt(position, square);
    const parts = [`Square ${square}`];
    const shown = midJump && square === path[0] ? null : piece;
    if (shown) parts.push(`${shown.colour} ${shown.king ? 'king' : 'piece'}${shown.colour === orientation ? ' (yours)' : ''}`);
    if (midJump && square === path[path.length - 1]) parts.push(`your ${pieceAt(position, path[0])!.king ? 'king' : 'piece'}, jumping`);
    if (taken.has(square)) parts.push('jumped');
    if (square === path[0] && !midJump) parts.push('selected');
    if (jumpRequired && path.length === 0 && movable.has(square)) parts.push('can jump');
    if (targets.has(square)) parts.push(jumpRequired ? 'you can jump here' : 'you can move here');
    return parts.join(', ');
  }

  return (
    <div className="board-wrap">
      <div
        className="board board--checkers"
        role="group"
        aria-label={`Checkers board. You are ${orientation}.`}
      >
        {cells.map((square, index) => {
          if (square === null) return <div key={`light-${index}`} className="board__square is-light" aria-hidden="true" />;
          let piece = pieceAt(position, square);
          // Mid-jump, the piece is drawn where it has got to so far.
          if (midJump && square === path[0]) piece = null;
          if (midJump && square === path[path.length - 1]) piece = pieceAt(position, path[0]);
          const classes = ['board__square', 'is-dark'];
          if (lastMove?.includes(square)) classes.push('is-last');
          if (square === path[path.length - 1]) classes.push('is-selected');
          if (targets.has(square)) classes.push(jumpRequired ? 'is-jump-target' : 'is-target');
          if (jumpRequired && path.length === 0 && movable.has(square)) classes.push('is-must-jump');
          if (canMove && piece?.colour === orientation) classes.push('is-mine');
          return (
            <button
              key={square}
              type="button"
              className={classes.join(' ')}
              ref={(el) => {
                if (el) squareRefs.current.set(square, el);
                else squareRefs.current.delete(square);
              }}
              tabIndex={square === focused ? 0 : -1}
              aria-label={label(square)}
              aria-disabled={!canMove}
              onClick={() => {
                setFocused(square);
                choose(square);
              }}
              onKeyDown={(event) => moveFocus(event, square)}
            >
              {piece && (
                <span
                  className={`checker checker--${piece.colour}${piece.king ? ' is-king' : ''}${taken.has(square) ? ' is-taken' : ''}`}
                  aria-hidden="true"
                >
                  {piece.king && <span className="checker__crown">♛</span>}
                </span>
              )}
              <span className="board__number" aria-hidden="true">
                {square}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
