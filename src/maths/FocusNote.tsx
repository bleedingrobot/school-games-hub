import { focusNote, type MathsFocus } from '../../shared/maths/focus';

/** "Your teacher picked ×6 until Friday": why the questions are what they are. Nothing when there is no focus. */
export function FocusNote({ focus, now }: { focus: MathsFocus | null | undefined; now?: Date }) {
  const text = focusNote(focus, now);
  if (!text) return null;
  return (
    <p className="focus-note" role="status">
      <span aria-hidden="true">🎯</span> {text}
    </p>
  );
}
