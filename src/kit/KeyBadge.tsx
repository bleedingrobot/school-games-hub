/** The small key label in a button's corner ("1", "Enter"). Hidden on touch-only screens (styles.css `.kit-key`). */
export function KeyBadge({ k }: { k: string }) {
  return <span className="kit-key" aria-hidden="true">{k}</span>;
}
