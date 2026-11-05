import { useEffect } from 'react';

/** Says `text` each time it changes (rendered where the line is worked out, so no hook runs after an early return). */
export function Say({ text, say }: { text: string | null | undefined; say: (text: string | null | undefined) => void }) {
  useEffect(() => say(text), [text, say]);
  return null;
}
