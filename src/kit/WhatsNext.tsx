import { useEffect, useRef, type ReactNode } from 'react';

/**
 * "What's next" after a round (R8): one panel that says what happened, then the one button that moves on. Lifted from
 * Weka's finish screen. The heading takes focus and the line is read aloud once when it appears. The game passes its own
 * words and CSS prefix; `prefix="wk"` gives `wk-panel`, `wk-chip` and `wk-play-button`. `children` sit between the note
 * and the button (a prize picture, for example).
 */
export function WhatsNext({ prefix, title, spoken = title, note, buttonLabel, say, onNext, children }: {
  prefix: string;
  /** The heading. */
  title: string;
  /** What is read aloud, if more than the heading (for example the heading and a "next time" line). */
  spoken?: string;
  /** A small line under the heading, such as what changes next time. */
  note?: string | null;
  buttonLabel: string;
  say: (text: string) => void;
  onNext: () => void;
  children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    say(spoken);
  }, [say, spoken]);
  return (
    <div className={`${prefix}-panel`}>
      <h2 tabIndex={-1} ref={heading}>{title}</h2>
      {note && <p className={`${prefix}-chip`}>{note}</p>}
      {children}
      <button type="button" className={`button button--play ${prefix}-play-button`} onClick={onNext}>
        {buttonLabel}
      </button>
    </div>
  );
}
