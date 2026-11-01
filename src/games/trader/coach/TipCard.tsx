/** A first-time tip from Bolt (docs/TRADER-HINTS-PLAN.md, section 4): in line, never covering a button. Escape closes it. */
import { useEffect } from 'react';
import { COACH_NAME } from '../text';
import { BoltFace } from './CoachBar';
import type { TipStop } from './tips';

export function TipCard({ stop, n, of, inline = false, onNext, onClose }: {
  stop: TipStop;
  /** Which stop this is (from 0) and how many there are. */
  n: number;
  of: number;
  /** Sits in line above an encounter's panel instead of staying pinned at the top (so it never covers the panel). */
  inline?: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  const last = n >= of - 1;
  return (
    <aside className={`st-coach st-tip ${inline ? 'st-tip--inline' : ''}`} aria-label={`Tip from ${COACH_NAME}`}>
      <BoltFace />
      <p className="st-coach__say" role="status" aria-live="polite">
        <strong>{COACH_NAME}:</strong> {stop.say}
      </p>
      <div className="st-tip__btns">
        {of > 1 && <span className="st-soft st-tip__count">{n + 1} of {of}</span>}
        <button type="button" className="st-btn st-btn--small st-btn--primary" onClick={last ? onClose : onNext}>{last ? 'Got it' : 'Next'}</button>
        <button type="button" className="st-btn st-btn--small st-tip__x" onClick={onClose} aria-label={`Close ${COACH_NAME}'s tip`}>✕</button>
      </div>
    </aside>
  );
}
