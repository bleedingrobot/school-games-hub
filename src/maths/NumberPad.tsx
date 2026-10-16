import type { PointerEvent } from 'react';

// Tapping or clicking a key keeps focus where it was, so typing on a keyboard still works after.
const keepFocus = (event: PointerEvent) => event.preventDefault();

/**
 * A big on-screen number pad, for iPads, Chromebook touch screens and phones. The question
 * box also takes typed digits, Backspace and Enter, so the pad is optional with a keyboard.
 */
export function NumberPad({
  onDigit,
  onBack,
  onEnter,
  canEnter,
  disabled,
}: {
  onDigit: (digit: string) => void;
  onBack: () => void;
  onEnter: () => void;
  canEnter: boolean;
  disabled?: boolean;
}) {
  const digit = (d: string) => (
    <button key={d} type="button" className="numpad__key" disabled={disabled} onPointerDown={keepFocus} onClick={() => onDigit(d)}>
      {d}
    </button>
  );
  return (
    <div className="numpad" role="group" aria-label="Number pad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit)}
      <button type="button" className="numpad__key numpad__key--back" disabled={disabled} aria-label="Delete" onPointerDown={keepFocus} onClick={onBack}>
        ⌫
      </button>
      {digit('0')}
      <button
        type="button"
        className="numpad__key numpad__key--enter"
        disabled={disabled || !canEnter}
        aria-label="Check my answer"
        onPointerDown={keepFocus}
        onClick={onEnter}
      >
        ✓
      </button>
    </div>
  );
}
