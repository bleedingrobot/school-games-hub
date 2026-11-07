/**
 * A floating leaf to tap: its number, and a ten-frame of dots to count while the dots still help. On the 100 and 1000
 * beanstalks each dot is a ten or a hundred, said under the frame, so 70 shows 7 dots (James, 4 Nov 2026).
 */
import type { CSSProperties } from 'react';
import type { Dots, Metal } from '../../../shared/beanstalk/progress';
import { leafArt } from './art';
import { WORDS } from './words';

/** `tried`: already paired wrongly with the picked leaf, so it can't be tapped with it again (maths review R5). */
export type LeafLook = 'resting' | 'picked' | 'wobble' | 'flying' | 'tried';

interface Props {
  value: number;
  /** What one dot is worth: 1, 10 or 100. */
  step: number;
  /** Squares in the frame: 10, or 20 (two ten-frames) on the bonds to 20 beanstalk. */
  cells?: number;
  dots: Dots;
  /** The leaves are the beanstalk's colour so far: green, then bronze after 10 days, then silver after 20. */
  metal: Metal;
  look: LeafLook;
  /** Where it bobs in its float, so the leaves don't move together. */
  slot: number;
  /** The guided first go's hand points at this leaf. */
  pointed?: boolean;
  /** "Let's look together" is about this leaf: it pulses, and stays picked for "Now you try". */
  pulse?: boolean;
  onTap: () => void;
}

export function Leaf({ value, step, cells = 10, dots, metal, look, slot, pointed = false, pulse = false, onTap }: Props) {
  return (
    <button
      type="button"
      className={`bs-leaf bs-leaf--${look} bs-leaf--slot${slot}${pointed ? ' bs-leaf--pointed' : ''}${pulse ? ' bs-leaf--pulse' : ''}`}
      style={{ backgroundImage: `url("${leafArt(metal)}")` }}
      aria-pressed={look === 'picked'}
      aria-label={pointed ? `${value}, ${WORDS.guideHere}` : String(value)}
      disabled={look === 'flying' || look === 'tried'}
      onClick={onTap}
    >
      <span className={`bs-leaf__number bs-leaf__number--digits${String(value).length}`} aria-hidden="true">{value}</span>
      {dots !== 'none' && (
        <span className={`bs-frame bs-frame--${dots}${cells > 10 ? ' bs-frame--twenty' : ''}`} aria-hidden="true">
          {Array.from({ length: cells }, (_, i) => (
            <span key={i} className={i < value / step ? 'bs-dot bs-dot--on' : 'bs-dot'} />
          ))}
        </span>
      )}
      {dots !== 'none' && step > 1 && <span className={`bs-each bs-each--${dots}`} aria-hidden="true">{WORDS.dotsEach(step)}</span>}
      {pointed && <span className="bs-hand" aria-hidden="true">👆</span>}
    </button>
  );
}

/**
 * Two leaves' dots in one ten-frame (maths review R5): the first leaf's dots, then the second's sliding in after them.
 * Over the sum, the extra dots hang out of the frame, glowing; under it, the empty squares glow. Each dot is a one, a
 * ten or a hundred, as on the leaves. `more` dots of the second leaf are shown (all of them unless it is counting in).
 */
export function JoinedFrame({ a, b, step, cells = 10, more = b / step }: { a: number; b: number; step: number; cells?: number; more?: number }) {
  const first = a / step;
  const total = first + more;
  const done = more === b / step;
  const dot = (i: number) =>
    i < first ? 'bs-dot bs-dot--on' : i < total ? 'bs-dot bs-dot--join' : done ? 'bs-dot bs-dot--missing' : 'bs-dot';
  return (
    <span className="bs-joined" aria-hidden="true">
      <span className={`bs-frame bs-frame--joined${cells > 10 ? ' bs-frame--twenty' : ''}`}>
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} className={dot(i)} style={{ '--i': Math.max(0, i - first) } as CSSProperties} />
        ))}
      </span>
      {total > cells && (
        <span className="bs-extra">
          {Array.from({ length: total - cells }, (_, i) => (
            <span key={i} className="bs-dot bs-dot--join bs-dot--extra" style={{ '--i': cells - first + i } as CSSProperties} />
          ))}
        </span>
      )}
      {step > 1 && <span className="bs-each">{WORDS.dotsEach(step)}</span>}
    </span>
  );
}
