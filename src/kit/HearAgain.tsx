/**
 * The "Hear it again" button (LEARNING-DESIGN rule 2: always visible, in every game with a voice). Lifted from Weka.
 * The game passes its own word, what to read (`onHear`), and its CSS prefix, so `prefix="wk"` gives `wk-button`.
 */
export function HearAgain({ prefix, label, onHear, icon = '👂' }: {
  prefix: string;
  /** The button's words, for example "Hear it again". */
  label: string;
  onHear: () => void;
  icon?: string;
}) {
  return (
    <button type="button" className={`${prefix}-button`} onClick={onHear}>
      <span aria-hidden="true">{icon}</span> {label}
    </button>
  );
}
