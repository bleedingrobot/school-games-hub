/**
 * A floating leaf to tap: its number, and a ten-frame of dots to count while the dots still help. On the 100 and 1000
 * beanstalks each dot is a ten or a hundred, said under the frame, so 70 shows 7 dots (James, 4 Nov 2026).
 */
import type { Dots, Metal } from '../../../shared/beanstalk/progress';
import { leafArt } from './art';
import { WORDS } from './words';

export type LeafLook = 'resting' | 'picked' | 'wobble' | 'flying';

interface Props {
  value: number;
  /** What one dot is worth: 1, 10 or 100. */
  step: number;
  dots: Dots;
  /** The leaves are the beanstalk's colour so far: green, then bronze after 10 days, then silver after 20. */
  metal: Metal;
  look: LeafLook;
  /** Where it bobs in its float, so the leaves don't move together. */
  slot: number;
  /** The guided first go's hand points at this leaf. */
  pointed?: boolean;
  onTap: () => void;
}

export function Leaf({ value, step, dots, metal, look, slot, pointed = false, onTap }: Props) {
  return (
    <button
      type="button"
      className={`bs-leaf bs-leaf--${look} bs-leaf--slot${slot}${pointed ? ' bs-leaf--pointed' : ''}`}
      style={{ backgroundImage: `url("${leafArt(metal)}")` }}
      aria-pressed={look === 'picked'}
      aria-label={pointed ? `${value}, ${WORDS.guideHere}` : String(value)}
      disabled={look === 'flying'}
      onClick={onTap}
    >
      <span className={`bs-leaf__number bs-leaf__number--digits${String(value).length}`} aria-hidden="true">{value}</span>
      {dots !== 'none' && (
        <span className={`bs-frame bs-frame--${dots}`} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < value / step ? 'bs-dot bs-dot--on' : 'bs-dot'} />
          ))}
        </span>
      )}
      {dots !== 'none' && step > 1 && <span className={`bs-each bs-each--${dots}`} aria-hidden="true">{WORDS.dotsEach(step)}</span>}
      {pointed && <span className="bs-hand" aria-hidden="true">👆</span>}
    </button>
  );
}
