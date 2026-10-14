import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Chess, Colour, PromotionPiece, Square } from '../../../shared/chess/rules';
import bB from './pieces/bB.svg';
import bK from './pieces/bK.svg';
import bN from './pieces/bN.svg';
import bP from './pieces/bP.svg';
import bQ from './pieces/bQ.svg';
import bR from './pieces/bR.svg';
import wB from './pieces/wB.svg';
import wK from './pieces/wK.svg';
import wN from './pieces/wN.svg';
import wP from './pieces/wP.svg';
import wQ from './pieces/wQ.svg';
import wR from './pieces/wR.svg';

const PIECE_IMAGES: Record<string, string> = { bB, bK, bN, bP, bQ, bR, wB, wK, wN, wP, wQ, wR };
export const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};
const FILES = 'abcdefgh';
const PROMOTION_CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n'];

export function pieceImage(colour: 'w' | 'b', type: string) {
  return PIECE_IMAGES[colour + type.toUpperCase()];
}

/** The 64 squares in the order they're drawn, top-left first, from this player's side. */
export function squaresFor(orientation: Colour): Square[] {
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? FILES : [...FILES].reverse().join('');
  return ranks.flatMap((rank) => [...files].map((file) => `${file}${rank}` as Square));
}

function isLight(square: Square) {
  return (FILES.indexOf(square[0]) + Number(square[1])) % 2 === 1;
}

export interface BoardProps {
  chess: Chess;
  orientation: Colour;
  /** False while the bot is thinking or the game is over. */
  canMove: boolean;
  lastMove: { from: string; to: string } | null;
  onMove: (from: Square, to: Square, promotion?: PromotionPiece) => void;
}

export function Board({ chess, orientation, canMove, lastMove, onMove }: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [focused, setFocused] = useState<Square>(orientation === 'white' ? 'e2' : 'e7');
  const squareRefs = useRef(new Map<Square, HTMLButtonElement>());
  const promotionRef = useRef<HTMLButtonElement>(null);

  const squares = squaresFor(orientation);
  const myColour = orientation === 'white' ? 'w' : 'b';
  const targets = selected && canMove ? chess.moves({ square: selected, verbose: true }) : [];
  const targetSquares = new Set(targets.map((m) => m.to));
  const checkedKing =
    chess.inCheck() &&
    squares.find((sq) => {
      const piece = chess.get(sq);
      return piece?.type === 'k' && piece.color === chess.turn();
    });

  // A new position (the bot moved, or a new game) clears any half-made move.
  const fen = chess.fen();
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [fen, canMove]);

  useEffect(() => {
    if (promotion) promotionRef.current?.focus();
  }, [promotion]);

  function choose(square: Square) {
    if (!canMove || promotion) return;
    const piece = chess.get(square);
    if (selected && targetSquares.has(square)) {
      const move = targets.find((m) => m.to === square)!;
      if (move.promotion) {
        setPromotion({ from: selected, to: square });
      } else {
        onMove(selected, square);
        setSelected(null);
      }
      return;
    }
    if (piece?.color === myColour && square !== selected) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  function moveFocus(event: KeyboardEvent, square: Square) {
    const index = squares.indexOf(square);
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
    if (event.key === 'Escape') {
      setSelected(null);
      return;
    }
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = index + step;
    const sameRow = Math.abs(step) === 8 || Math.floor(next / 8) === Math.floor(index / 8);
    if (next < 0 || next > 63 || !sameRow) return;
    setFocused(squares[next]);
    squareRefs.current.get(squares[next])?.focus();
  }

  function label(square: Square) {
    const piece = chess.get(square);
    const parts: string[] = [square];
    if (piece) parts.push(`${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}`);
    if (square === selected) parts.push('selected');
    if (targetSquares.has(square)) parts.push(piece ? 'you can capture this' : 'you can move here');
    if (square === checkedKing) parts.push('in check');
    return parts.join(', ');
  }

  return (
    <div className="board-wrap">
      <div className="board" role="group" aria-label={`Chess board. You are ${orientation}.`}>
        {squares.map((square, index) => {
          const piece = chess.get(square);
          const classes = ['board__square', isLight(square) ? 'is-light' : 'is-dark'];
          if (lastMove && (square === lastMove.from || square === lastMove.to)) classes.push('is-last');
          if (square === selected) classes.push('is-selected');
          if (targetSquares.has(square)) classes.push(piece ? 'is-capture' : 'is-target');
          if (square === checkedKing) classes.push('is-check');
          if (canMove && piece?.color === myColour) classes.push('is-mine');
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
              {piece && <img className="board__piece" src={pieceImage(piece.color, piece.type)} alt="" draggable={false} />}
              {index % 8 === 0 && <span className="board__rank">{square[1]}</span>}
              {index >= 56 && <span className="board__file">{square[0]}</span>}
            </button>
          );
        })}
      </div>

      {promotion && (
        <div className="promotion" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
          <div className="promotion__card">
            <h2 id="promotion-title">Your pawn made it! Pick a new piece:</h2>
            <div className="promotion__choices">
              {PROMOTION_CHOICES.map((type, i) => (
                <button
                  key={type}
                  type="button"
                  className="promotion__choice"
                  ref={i === 0 ? promotionRef : undefined}
                  onClick={() => {
                    onMove(promotion.from, promotion.to, type);
                    setPromotion(null);
                    setSelected(null);
                  }}
                >
                  <img src={pieceImage(myColour, type)} alt="" />
                  <span>{PIECE_NAMES[type][0].toUpperCase() + PIECE_NAMES[type].slice(1)}</span>
                </button>
              ))}
            </div>
            <button type="button" className="promotion__cancel" onClick={() => setPromotion(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
