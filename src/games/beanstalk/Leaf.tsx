/** A floating leaf to tap: its number, and that many dots in a ten-frame to count while the dots still help. */
import type { Dots } from '../../../shared/beanstalk/progress';
import { leafArt } from './art';
import { WORDS } from './words';

export type LeafLook = 'resting' | 'picked' | 'wobble' | 'flying';

interface Props {
  value: number;
  dots: Dots;
  look: LeafLook;
  /** Where it bobs in its float, so the leaves don't move together. */
  slot: number;
  /** The guided first go's hand points at this leaf. */
  pointed?: boolean;
  onTap: () => void;
}

export function Leaf({ value, dots, look, slot, pointed = false, onTap }: Props) {
  return (
    <button
      type="button"
      className={`bs-leaf bs-leaf--${look} bs-leaf--slot${slot}${pointed ? ' bs-leaf--pointed' : ''}`}
      style={{ backgroundImage: `url("${leafArt('green')}")` }}
      aria-pressed={look === 'picked'}
      aria-label={pointed ? `${value}, ${WORDS.guideHere}` : String(value)}
      disabled={look === 'flying'}
      onClick={onTap}
    >
      <span className="bs-leaf__number" aria-hidden="true">{value}</span>
      {dots !== 'none' && (
        <span className={`bs-frame bs-frame--${dots}`} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < value ? 'bs-dot bs-dot--on' : 'bs-dot'} />
          ))}
        </span>
      )}
      {pointed && <span className="bs-hand" aria-hidden="true">👆</span>}
    </button>
  );
}
