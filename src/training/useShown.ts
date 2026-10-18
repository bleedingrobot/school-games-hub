import { useEffect, useRef, useState } from 'react';

/**
 * Tells you when a screen is fully on screen, and the time (performance.now) when that happened.
 * Answer timing runs from this moment to the moment the answer goes in.
 */
export function useShown() {
  const [ready, setReady] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      shownAt.current = performance.now();
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return { ready, shownAt };
}
