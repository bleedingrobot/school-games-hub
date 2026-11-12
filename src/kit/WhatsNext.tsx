import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Said by the friend on a golden-prize day (profile card P9): the server has just given the child that friend's painting to
 * wear as their profile picture (garden_rewards in 20261112001900_garden_trophies.sql). Each early-years game lists it in its
 * `allVoiceLines()`, so it has a Bella clip in the game's own voice folder.
 */
export const WEAR_ME_LINE = 'You can wear me on your profile now!';

/**
 * "What's next" after a round (R8): one panel that says what happened, then the one button that moves on. Lifted from
 * Weka's finish screen. The heading takes focus and the line is read aloud once when it appears. The game passes its own
 * words and CSS prefix; `prefix="wk"` gives `wk-panel`, `wk-chip` and `wk-play-button`. `children` sit between the note
 * and the button (a prize picture, for example). `wearMe` (a golden-prize day) adds WEAR_ME_LINE as a chip, said after the rest.
 */
export function WhatsNext({ prefix, title, spoken = title, note, buttonLabel, say, onNext, wearMe = false, children }: {
  prefix: string;
  /** The heading. */
  title: string;
  /** What is read aloud, if more than the heading (for example the heading and a "next time" line). */
  spoken?: string;
  /** A small line under the heading, such as what changes next time. */
  note?: string | null;
  buttonLabel: string;
  /** Called with an `onEnd` only on a `wearMe` day, to say WEAR_ME_LINE once the rest has been said. */
  say: (text: string, onEnd?: () => void) => void;
  onNext: () => void;
  /** A golden-prize day: the friend's picture can now be worn on the profile. */
  wearMe?: boolean;
  children?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    if (wearMe) say(spoken, () => say(WEAR_ME_LINE));
    else say(spoken);
  }, [say, spoken, wearMe]);
  return (
    <div className={`${prefix}-panel`}>
      <h2 tabIndex={-1} ref={heading}>{title}</h2>
      {note && <p className={`${prefix}-chip`}>{note}</p>}
      {children}
      {wearMe && <p className={`${prefix}-chip ${prefix}-wear-me`}>{WEAR_ME_LINE}</p>}
      <button type="button" className={`button button--play ${prefix}-play-button`} onClick={onNext}>
        {buttonLabel}
      </button>
    </div>
  );
}
