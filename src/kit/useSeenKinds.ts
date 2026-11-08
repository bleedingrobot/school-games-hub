import { useCallback, useRef, useState } from 'react';

/**
 * Remembers which kinds of go a child has seen. `initial` comes from the server; `save` tells the server about new ones.
 * `mark` updates the local set at once (a demo never plays twice in one sitting), then saves. If saving fails the unsent kinds
 * are kept and go with the next `mark`. A failure never blocks play and shows nothing. No storage in the browser.
 */
export function useSeenKinds(initial: readonly string[], save: (kinds: string[]) => Promise<unknown>) {
  const [seenKinds, setSeen] = useState<readonly string[]>(initial);
  const seenRef = useRef(new Set(initial));
  const unsent = useRef(new Set<string>());
  const saveRef = useRef(save);
  saveRef.current = save;

  const has = useCallback((kind: string) => seenKinds.includes(kind), [seenKinds]);

  const mark = useCallback((kinds: readonly string[]) => {
    const fresh = kinds.filter((k) => !seenRef.current.has(k));
    for (const k of fresh) {
      seenRef.current.add(k);
      unsent.current.add(k);
    }
    if (fresh.length) setSeen([...seenRef.current]);
    if (!unsent.current.size) return Promise.resolve();
    const sending = [...unsent.current];
    return Promise.resolve()
      .then(() => saveRef.current(sending))
      .then(
        () => {
          for (const k of sending) unsent.current.delete(k);
        },
        () => {},
      );
  }, []);

  return { has, mark, seenKinds };
}
