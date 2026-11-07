import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The timing of a child's very first go: after `ms` without a move the hand starts pointing (lifted from Weka's
 * `GUIDE_MS`). `guided` is false for every other go, and then `pointing` is always false and `start` does nothing.
 * Call `start()` whenever a step is read out, and `stop()` when the child moves on. It holds one timer of its own.
 */
export function useGuidedFirstGo(guided: boolean, ms: number): { pointing: boolean; start: () => void; stop: () => void } {
  const [pointing, setPointing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  const stop = useCallback(() => {
    clear();
    setPointing(false);
  }, [clear]);
  const start = useCallback(() => {
    if (!guided) return;
    clear();
    timer.current = window.setTimeout(() => setPointing(true), ms);
  }, [guided, ms, clear]);
  useEffect(() => clear, [clear]);
  return { pointing: guided && pointing, start, stop };
}
