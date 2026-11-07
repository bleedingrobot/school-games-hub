import { useEffect, type ReactNode } from 'react';

/**
 * A first-time tip from a helper character: in line, never covering a button, and Escape closes it. Lifted from Star
 * Trader's `TipCard`. The game passes the helper's name and face, the words, and its CSS prefix: `prefix="st"` gives the
 * classes `st-coach st-tip`, `st-btn st-btn--small st-btn--primary`, `st-tip__btns`, `st-tip__count`, `st-soft` and
 * `st-tip__x`, the ones TipCard uses now. No words live here.
 */
export function FirstTimeTip({ prefix, who, face, say, n, of, inline = false, nextLabel, lastLabel, closeLabel, onNext, onClose }: {
  prefix: string;
  /** The helper's name, shown before the words. */
  who: string;
  /** The helper's picture. */
  face?: ReactNode;
  say: string;
  /** Which stop this is (from 0) and how many there are. */
  n: number;
  of: number;
  /** Sits in line above a panel instead of staying pinned at the top. */
  inline?: boolean;
  nextLabel: string;
  /** The button on the last stop, which closes the tip ("Got it"). */
  lastLabel: string;
  /** The label for the small close button, for a screen reader. */
  closeLabel: string;
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
    <aside className={`${prefix}-coach ${prefix}-tip ${inline ? `${prefix}-tip--inline` : ''}`} aria-label={`Tip from ${who}`}>
      {face}
      <p className={`${prefix}-coach__say`} role="status" aria-live="polite">
        <strong>{who}:</strong> {say}
      </p>
      <div className={`${prefix}-tip__btns`}>
        {of > 1 && <span className={`${prefix}-soft ${prefix}-tip__count`}>{n + 1} of {of}</span>}
        <button type="button" className={`${prefix}-btn ${prefix}-btn--small ${prefix}-btn--primary`} onClick={last ? onClose : onNext}>{last ? lastLabel : nextLabel}</button>
        <button type="button" className={`${prefix}-btn ${prefix}-btn--small ${prefix}-tip__x`} onClick={onClose} aria-label={closeLabel}>✕</button>
      </div>
    </aside>
  );
}
