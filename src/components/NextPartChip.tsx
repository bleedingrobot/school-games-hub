import './nextPartChip.css';

/**
 * The "next part" chip of the daily Foundational skills games (James, 4 Nov 2026): is today's part (a leaf, a lily pad, a
 * shell, a pebble) still ready to change, or should the pupil come back tomorrow? Shown on the home page card (from
 * my_next_parts(), migration 20261105000300) and on each game's own home screen. A game gets it with `nextPart` in its
 * GameDefinition (src/games/types.ts) and a `<NextPartChip>` on its home screen.
 */
export function nextPartWords(noun: string, done: boolean): string {
  return done ? `Next ${noun} tomorrow` : `Today’s ${noun} is ready`;
}

export function NextPartChip({ noun, done, onHear }: { noun: string; done: boolean; /** Read it aloud when tapped (in the games, Bella). */ onHear?: (text: string) => void }) {
  const text = nextPartWords(noun, done);
  const className = done ? 'next-part next-part--tomorrow' : 'next-part next-part--ready';
  const inner = (
    <>
      <span className="next-part__emoji" aria-hidden="true">
        {done ? '🌙' : '✨'}
      </span>
      {text}
    </>
  );
  return onHear ? (
    <button type="button" className={`${className} next-part--button`} onClick={() => onHear(text)} aria-label={`${text}. Tap to hear it.`}>
      {inner}
    </button>
  ) : (
    <span className={className}>{inner}</span>
  );
}
