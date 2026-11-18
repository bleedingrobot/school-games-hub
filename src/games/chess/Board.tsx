import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
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
import { BoardFx, boardClass, boardStyle, squareStyle } from './BoardFace';
import { boardById, useLooks } from './looks';

const PIECE_IMAGES: Record<string, string> = {
  bB,
  bK,
  bN,
  bP,
  bQ,
  bR,
  wB,
  wK,
  wN,
  wP,
  wQ,
  wR,
};
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

/** a1 is dark and h1 is light ("light on the right"). */
function isLight(square: Square) {
  return (FILES.indexOf(square[0]) + Number(square[1])) % 2 === 0;
}

/** True when the device asks for less movement: then pieces just appear, with no bursts or banners. */
function calm() {
  return (
    typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** One burst of fireworks or a capture's shards: fixed directions, so each looks lively but the same each time. */
function sparks(count: number, reach: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.3;
    const far = reach * (0.65 + ((i * 37) % 10) / 28);
    return {
      dx: Math.cos(angle) * far,
      dy: Math.sin(angle) * far,
      spin: (i * 67) % 360,
    };
  });
}
// Distances are in hundredths of the board's width.
const SHARDS = sparks(14, 15);
const FIREWORK = sparks(18, 20);
const FIREWORK_SPOTS = [
  { x: 22, y: 28, hue: 45, delay: 0 },
  { x: 74, y: 22, hue: 330, delay: 0.35 },
  { x: 50, y: 55, hue: 190, delay: 0.7 },
  { x: 18, y: 70, hue: 120, delay: 1.05 },
  { x: 80, y: 68, hue: 275, delay: 1.4 },
];

type Fx =
  | { id: number; kind: 'capture'; at: number; piece: string }
  | { id: number; kind: 'promote'; at: number }
  | { id: number; kind: 'banner'; text: string; mate: boolean }
  | { id: number; kind: 'fireworks' };

/** Where a square sits on the board as drawn, as left/top percentages. */
function spot(index: number): CSSProperties {
  return {
    left: `${(index % 8) * 12.5}%`,
    top: `${Math.floor(index / 8) * 12.5}%`,
  };
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
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [focused, setFocused] = useState<Square>(orientation === 'white' ? 'e2' : 'e7');
  const squareRefs = useRef(new Map<Square, HTMLButtonElement>());
  const promotionRef = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const shownPly = useRef<number | null>(null);
  const fxId = useRef(0);
  const [fx, setFx] = useState<Fx[]>([]);
  // The pupil's own board from the Chess Locker (classic wood until the looks load).
  const look = boardById(useLooks().data?.board);

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

  // A move was just made (by anyone): slide the piece across, then burst, bang or celebrate.
  useLayoutEffect(() => {
    const history = chess.history({ verbose: true });
    const before = shownPly.current;
    shownPly.current = history.length;
    if (history.length < (before ?? 0)) setFx([]);
    if (before === null || history.length !== before + 1 || calm()) return;
    const move = history[history.length - 1];
    const slide = (from: Square, to: Square) => {
      const a = squareRefs.current.get(from)?.getBoundingClientRect();
      const toSquare = squareRefs.current.get(to);
      const b = toSquare?.getBoundingClientRect();
      const piece = toSquare?.querySelector<HTMLElement>('.board__piece');
      if (!a || !b || !piece?.animate) return;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      const lift = 'drop-shadow(0 18px 10px rgba(0, 0, 0, 0.45))';
      piece.style.zIndex = '6';
      piece
        .animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px) scale(1.12)`,
              filter: lift,
            },
            {
              transform: `translate(${dx * 0.15}px, ${dy * 0.15 - b.height * 0.12}px) scale(1.18)`,
              filter: lift,
              offset: 0.8,
            },
            { transform: 'translate(0, 0) scale(1)' },
          ],
          { duration: 360, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
        )
        .finished.catch(() => {})
        .finally(() => {
          piece.style.zIndex = '';
        });
    };
    slide(move.from as Square, move.to as Square);
    if (move.flags.includes('k') || move.flags.includes('q')) {
      const rank = move.to[1];
      const [rookFrom, rookTo] = move.flags.includes('k') ? ['h', 'f'] : ['a', 'd'];
      slide(`${rookFrom}${rank}` as Square, `${rookTo}${rank}` as Square);
    }

    const add: Fx[] = [];
    const next = () => ++fxId.current;
    if (move.captured) {
      // En passant takes the pawn beside, not on, the square it lands on.
      const taken = (move.flags.includes('e') ? move.to[0] + move.from[1] : move.to) as Square;
      const colour = move.color === 'w' ? 'b' : 'w';
      add.push({
        id: next(),
        kind: 'capture',
        at: squares.indexOf(taken),
        piece: pieceImage(colour, move.captured),
      });
      boardRef.current?.animate?.(
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(-6px, 3px) rotate(-0.6deg)' },
          { transform: 'translate(6px, -3px) rotate(0.6deg)' },
          { transform: 'translate(-3px, -2px)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 320, delay: 260 },
      );
    }
    if (move.promotion)
      add.push({
        id: next(),
        kind: 'promote',
        at: squares.indexOf(move.to as Square),
      });
    if (chess.isCheckmate()) {
      add.push({ id: next(), kind: 'banner', text: 'Checkmate!', mate: true }, { id: next(), kind: 'fireworks' });
    } else if (chess.inCheck()) {
      add.push({ id: next(), kind: 'banner', text: 'Check!', mate: false });
    }
    if (!add.length) return;
    // A new banner takes the place of one still showing, so quick moves never pile them up.
    const newBanner = add.some((f) => f.kind === 'banner');
    setFx((now) => [...now.filter((f) => !(newBanner && f.kind === 'banner')), ...add]);
    const ids = new Set(add.map((f) => f.id));
    setTimeout(() => setFx((now) => now.filter((f) => !ids.has(f.id))), 3400);
    // Only a new position starts these.
  }, [fen]);

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
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -8,
      ArrowDown: 8,
    };
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

  const mated = chess.isCheckmate() ? checkedKing : null;

  return (
    <div className="board-wrap">
      <div
        // A new board sweeps in square by square.
        key={look.id}
        ref={boardRef}
        className={`board ${boardClass(look)}`}
        style={boardStyle(look)}
        role="group"
        aria-label={`Chess board. You are ${orientation}.`}
      >
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
              style={squareStyle(index)}
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
                <img
                  className={`board__piece${square === mated ? ' is-toppled' : ''}`}
                  src={pieceImage(piece.color, piece.type)}
                  alt=""
                  draggable={false}
                />
              )}
              {index % 8 === 0 && <span className="board__rank">{square[1]}</span>}
              {index >= 56 && <span className="board__file">{square[0]}</span>}
            </button>
          );
        })}
        <BoardFx look={look} />
      </div>

      <div className="board-fx" aria-hidden="true">
        {fx.map((f) => {
          if (f.kind === 'capture') {
            return (
              <div key={f.id} className="board-fx__spot" style={spot(f.at)}>
                <img className="board-fx__ghost" src={f.piece} alt="" />
                <span className="board-fx__flash" />
                {SHARDS.map((s, i) => (
                  <span
                    key={i}
                    className="board-fx__shard"
                    style={
                      {
                        '--dx': s.dx.toFixed(1),
                        '--dy': s.dy.toFixed(1),
                        '--spin': `${s.spin}deg`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            );
          }
          if (f.kind === 'promote') {
            return (
              <div key={f.id} className="board-fx__spot" style={spot(f.at)}>
                <span className="board-fx__pillar" />
                <span className="board-fx__flash board-fx__flash--gold" />
              </div>
            );
          }
          if (f.kind === 'banner') {
            return (
              <div key={f.id} className={`board-fx__banner${f.mate ? ' is-mate' : ''}`}>
                <span>{f.text}</span>
              </div>
            );
          }
          return (
            <div key={f.id} className="board-fx__fireworks">
              {FIREWORK_SPOTS.map((b, i) => (
                <div
                  key={i}
                  className="board-fx__burst"
                  style={
                    {
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      '--hue': b.hue,
                      '--delay': `${b.delay}s`,
                    } as CSSProperties
                  }
                >
                  {FIREWORK.map((s, j) => (
                    <span
                      key={j}
                      style={
                        {
                          '--dx': s.dx.toFixed(1),
                          '--dy': s.dy.toFixed(1),
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
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
