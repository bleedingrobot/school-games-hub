import { pieceClass, pieceImage } from './Board';

/**
 * A piece set from the 🎒 Chess Locker, for the Locker and the treasure chest: the white and black knights (the most
 * recognisable piece), or for the plinth the white king and queen between the two knights.
 */
export function SetPreview({ set, big = false, className = '' }: { set: string; big?: boolean; className?: string }) {
  const pieces: ['w' | 'b', string][] = big
    ? [
        ['w', 'n'],
        ['w', 'q'],
        ['w', 'k'],
        ['b', 'n'],
      ]
    : [
        ['w', 'n'],
        ['b', 'n'],
      ];
  return (
    <span className={`cs ${big ? 'cs--big' : ''} ${className}`} aria-hidden="true">
      {pieces.map(([colour, type], i) => (
        <img
          key={i}
          className={`cs__piece cs__piece--${colour}${type}${pieceClass(colour, type, set)}`}
          src={pieceImage(colour, type, set)}
          alt=""
          style={{ animationDelay: `${i * 0.25}s` }}
        />
      ))}
    </span>
  );
}
