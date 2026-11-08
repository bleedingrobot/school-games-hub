import { useCallback, useEffect, useRef, useState } from 'react';

const SKIP_AFTER_MS = 3000;
const LONGEST_MS = 20000;
const DEFAULT_HOLD_MS = 900;

/** One line of a demo: what is said, how long to wait after it, and which thing the game's hand points at (the game decides what the name means). */
export interface DemoStep {
  line: string;
  holdMs?: number;
  target?: string;
}

export interface KindDemoOptions {
  /** The kind of go this demo is for, or null when there is nothing to show. */
  kind: string | null;
  /** From `useSeenKinds`. */
  seen: { has(kind: string): boolean };
  /** From `useSeenKinds`: called once when the demo ends or is skipped. */
  mark: (kinds: string[]) => unknown;
  steps: readonly DemoStep[];
  /** The game's voice: says the line and calls `onEnd` when it is finished (or at once when the voice is off). */
  say: (text: string, onEnd?: () => void) => void;
}

/**
 * A demo the first time a kind of go comes up: says each step in turn, waits its hold time, then marks the kind seen.
 * Does nothing when the kind is already seen. The child can skip after 3 seconds; if a voice never ends, it gives up after 20.
 * The demo is not an answer: the game must not add any tap to the round while `playing`. Late timers and voice callbacks
 * from an earlier run do nothing.
 */
export function useKindDemo({ kind, seen, mark, steps, say }: KindDemoOptions) {
  const [state, setState] = useState<{ step: number; canSkip: boolean } | null>(null);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const finished = useRef<string | null>(null);
  const live = useRef({ kind, mark, steps, say });
  live.current = { kind, mark, steps, say };

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const end = useCallback(
    (me: number) => {
      if (run.current !== me) return;
      run.current++;
      clear();
      setState(null);
      const k = live.current.kind;
      if (k && finished.current !== k) {
        finished.current = k;
        live.current.mark([k]);
      }
    },
    [clear],
  );

  const begin = useCallback(() => {
    clear();
    const me = ++run.current;
    const alive = () => run.current === me;
    const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
    const list = live.current.steps;
    if (!list.length) return;
    setState({ step: 0, canSkip: false });
    const go = (i: number) => {
      if (!alive()) return;
      if (i >= list.length) return end(me);
      setState((s) => s && { ...s, step: i });
      let moved = false;
      const next = () => {
        if (!alive() || moved) return;
        moved = true;
        later(list[i].holdMs ?? DEFAULT_HOLD_MS, () => go(i + 1));
      };
      live.current.say(list[i].line, next);
    };
    go(0);
    later(SKIP_AFTER_MS, () => alive() && setState((s) => s && { ...s, canSkip: true }));
    later(LONGEST_MS, () => end(me));
  }, [clear, end]);

  const seenIt = kind ? seen.has(kind) : true;
  useEffect(() => {
    if (!kind || seenIt || finished.current === kind) return;
    begin();
    return () => {
      run.current++;
      clear();
    };
  }, [kind, seenIt, begin, clear]);

  return {
    playing: state !== null,
    step: state?.step ?? 0,
    target: state ? live.current.steps[state.step]?.target : undefined,
    canSkip: state?.canSkip ?? false,
    skip: () => end(run.current),
    replay: begin,
  };
}
