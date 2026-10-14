import { pieceImage } from './Board';

/** "Nf3" becomes "♘f3", which is easier to read for children. */
export function figurine(san: string, colour: 'w' | 'b') {
  const symbols = colour === 'w' ? { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' } : { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' };
  return san.replace(/[KQRBN]/g, (letter) => symbols[letter as keyof typeof symbols]);
}

/** The little pictures of pieces a player has captured. */
export function Captured({ pieces, who }: { pieces: { type: string; colour: string }[]; who: string }) {
  if (pieces.length === 0) return null;
  return (
    <span className="captured" aria-label={`${who} captured ${pieces.length} piece${pieces.length === 1 ? '' : 's'}`}>
      {pieces.map((p, i) => (
        <img key={i} src={pieceImage(p.colour as 'w' | 'b', p.type)} alt="" />
      ))}
    </span>
  );
}
