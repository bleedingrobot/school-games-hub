/**
 * The hand that shows a child where to tap (the guided first go, or after wrong taps). Lifted from Weka and Penguin
 * Pairs. It is drawn inside the button it points at, and hidden from screen readers; `pointedLabel` gives that button
 * the spoken hint instead ("4, try this one"). The game's CSS styles `<prefix>-hand`.
 */
export function PointingHand({ prefix, className = '', icon = '👆' }: { prefix: string; className?: string; icon?: string }) {
  return <span className={`${prefix}-hand${className ? ` ${className}` : ''}`} aria-hidden="true">{icon}</span>;
}

/** A button's label, with the game's hint ("try this one") added while the hand points at it. */
export function pointedLabel(label: string | number, pointed: boolean, hint: string): string {
  return pointed ? `${label}, ${hint}` : `${label}`;
}
