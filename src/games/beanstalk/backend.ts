/**
 * What the game asks of the server. Stage 2 has only the trial backend below, which runs the shared rules in this
 * browser; the real one (supabase/functions/beanstalk, Stage 3) answers the same four calls.
 */
import { finishChallenge, nzDate, type FinishResult } from '../../../shared/beanstalk/progress';
import { makeRound, MAX_SEED, replay, type Tap } from '../../../shared/beanstalk/round';

/** Who the child plays as: they choose on their first go (James, 4 Nov 2026). */
export type Child = 'jack' | 'jill';
export const isChild = (c: unknown): c is Child => c === 'jack' || c === 'jill';

export interface BeanstalkState {
  /** Null until they have chosen. */
  child: Child | null;
  daysDone: number;
  lastLeafDay: string | null;
  /** Today's NZ date by the server's clock. */
  today: string;
}

export interface BeanstalkBackend {
  load(): Promise<BeanstalkState>;
  choose(child: Child): Promise<void>;
  /** Today's challenge: the seed the leaves come from. */
  start(): Promise<{ seed: number }>;
  finish(seed: number, taps: readonly Tap[]): Promise<FinishResult>;
}

interface Saved {
  child: Child | null;
  daysDone: number;
  lastLeafDay: string | null;
  /** Preview only: how many days ahead of the real date the pretend clock is. */
  dayShift: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. Never talks to the school's server. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const read = (): Saved => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Saved | null;
      if (saved && Number.isInteger(saved.daysDone)) return { ...saved, child: isChild(saved.child) ? saved.child : null };
    } catch {
      // Storage blocked or spoilt: start afresh.
    }
    return { child: null, daysDone: 0, lastLeafDay: null, dayShift: 0 };
  };
  const write = (s: Saved) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      // Storage blocked: it lasts until the page is closed.
    }
  };
  const today = (s: Saved) => nzDate(new Date(Date.now() + s.dayShift * DAY_MS));
  const seeds = new Set<number>();

  const backend: BeanstalkBackend = {
    async load() {
      const s = read();
      return { child: s.child, daysDone: s.daysDone, lastLeafDay: s.lastLeafDay, today: today(s) };
    },
    async choose(child) {
      write({ ...read(), child });
    },
    async start() {
      const seed = Math.floor(Math.random() * MAX_SEED);
      seeds.add(seed);
      return { seed };
    },
    async finish(seed, taps) {
      if (!seeds.delete(seed)) throw new Error('Not a round this backend started');
      if (!replay(makeRound(seed), taps).done) throw new Error('The round is not finished');
      const s = read();
      const result = finishChallenge(s.daysDone, s.lastLeafDay, today(s));
      write({ ...s, daysDone: result.daysDone, lastLeafDay: result.lastLeafDay });
      return result;
    },
  };

  const tools = {
    nextDay: () => {
      const s = read();
      write({ ...s, dayShift: s.dayShift + 1 });
    },
    /** Jumps to just after this many finished days, as if each was on its own day. */
    jumpTo: (daysDone: number) => {
      const s = read();
      write({ ...s, daysDone, lastLeafDay: null });
    },
    restart: () => write({ child: null, daysDone: 0, lastLeafDay: null, dayShift: 0 }),
  };

  return { backend, tools };
}
