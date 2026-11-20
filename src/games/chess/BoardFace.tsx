import type { CSSProperties } from 'react';
import type { BoardLook } from './looks';
import './boards.css';

/**
 * The look of a board from the 🎒 Chess Locker: the painted light and dark squares (as CSS variables, so each square
 * shows its own part of one big painting) and the class that sets its frame and moving effects (boards.css). Classic
 * wood has no paintings: it keeps chess.css's flat colours.
 */
export function boardClass(look: BoardLook) {
  return `cb cb--${look.id}${look.light ? ' cb--painted' : ''}`;
}

export function boardStyle(look: BoardLook): CSSProperties | undefined {
  if (!look.light || !look.dark) return undefined;
  return { '--sq-light': `url(${look.light})`, '--sq-dark': `url(${look.dark})` } as CSSProperties;
}

/** Where a square sits in the board's painting: its column and row, 0 to 7. */
export function squareStyle(index: number): CSSProperties {
  return { '--c': index % 8, '--r': Math.floor(index / 8) } as CSSProperties;
}

/** The moving layer over the squares: a gleam, sun glints, rising embers or twinkling stars. */
export function BoardFx({ look }: { look: BoardLook }) {
  if (look.fx === 'none') return null;
  return (
    <span className={`cb__fx cb__fx--${look.fx}`} aria-hidden="true">
      {STARS.map((s, i) => (
        <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.delay}s` }} />
      ))}
    </span>
  );
}

// Fixed spots, so the board twinkles the same way each time.
const STARS = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37 + 9) % 96,
  y: (i * 61 + 23) % 94,
  delay: ((i * 7) % 13) * 0.31,
}));

/** A small board for the Locker and the treasure chest: the squares, the frame and the moving effect. */
export function BoardPreview({ look, className = '' }: { look: BoardLook; className?: string }) {
  return (
    <span className={`cb-mini ${boardClass(look)} ${className}`} style={boardStyle(look)} aria-hidden="true">
      {Array.from({ length: 64 }, (_, i) => (
        <span key={i} className={`cb-mini__sq ${(i + Math.floor(i / 8)) % 2 ? 'is-dark' : 'is-light'}`} style={squareStyle(i)} />
      ))}
      <BoardFx look={look} />
    </span>
  );
}
