import { useEffect, useState } from 'react';

/**
 * Loads a setting: null until it arrives, and again whenever `deps` change (a new class). Waits while `enabled` is false (the
 * class isn't known yet). `failed` is set if it couldn't be read.
 */
export function useSetting<T>(load: () => Promise<T>, deps: readonly unknown[], enabled = true): { value: T | null; failed: boolean } {
  const [state, setState] = useState<{ value: T | null; failed: boolean }>({
    value: null,
    failed: false,
  });
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setState({ value: null, failed: false });
    load().then(
      (value) => current && setState({ value, failed: false }),
      () => current && setState({ value: null, failed: true }),
    );
    return () => {
      current = false;
    };
    // `load` is made fresh on each render; `deps` say when it means something new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
  return state;
}
