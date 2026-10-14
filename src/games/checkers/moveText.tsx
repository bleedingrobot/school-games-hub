import type { Colour } from '../../../shared/checkers/rules';

/** "15x24" becomes "15 × 24", which is easier to read. */
export function pretty(notation: string) {
  return notation.replace(/x/g, ' × ').replace('-', ' – ');
}

/** Small checkers showing how many pieces a player has captured. */
export function Captured({ count, colour, who }: { count: number; colour: Colour; who: string }) {
  if (count === 0) return null;
  return (
    <span className="captured" aria-label={`${who} captured ${count} piece${count === 1 ? '' : 's'}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`checker checker--${colour} checker--small`} />
      ))}
    </span>
  );
}
