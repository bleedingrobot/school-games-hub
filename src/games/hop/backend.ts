/**
 * What the game asks of the server. Stage 3 adds the real `hop` function (docs/HOP-PLAN.md section 4); until then the
 * trial backend below runs the shared rules (shared/hop/) in this browser for the preview, with the pretend pupil's maths
 * records kept here too, so the step really moves from 10s to 5s to 2s as they get them right.
 */
import { afterAnswer, type FactStats, newStats } from '../../../shared/maths/leitner';
import type { SkipStep } from '../../../shared/maths/skillPacks/earlyFacts';
import { replay, type Tap } from '../../../shared/hop/play';
import { finishChallenge, nzDate, pondAfter, type FinishResult } from '../../../shared/hop/progress';
import { isStep, makeRound, MAX_SEED, stepFor, type Round } from '../../../shared/hop/round';

export interface HopState {
  daysDone: number;
  lastPadDay: string | null;
  /** Today's NZ date by the server's clock. */
  today: string;
  /** The step the next challenge counts in. */
  step: SkipStep;
}

export interface HopFinish extends FinishResult {
  /** The step for next time, and the one this challenge was in: different when the child moved up. */
  step: SkipStep;
  stepBefore: SkipStep;
}

export interface HopBackend {
  load(): Promise<HopState>;
  /** Today's challenge, made and kept by the server. */
  start(): Promise<Round>;
  finish(seed: number, taps: readonly Tap[]): Promise<HopFinish>;
}

/** A refusal or failure, with words a child (or their teacher) can be shown. */
export class HopError extends Error {}

interface TrialSave {
  daysDone: number;
  lastPadDay: string | null;
  reached: SkipStep;
  stats: FactStats[];
  open: Round | null;
  /** How many days ahead of the real date the pretend clock is. */
  dayShift: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const fresh = (): TrialSave => ({ daysDone: 0, lastPadDay: null, reached: 10, stats: [], open: null, dayShift: 0 });

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. Never talks to the school's server. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const read = (): TrialSave => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as TrialSave | null;
      if (saved && Number.isInteger(saved.daysDone) && Array.isArray(saved.stats) && isStep(saved.reached)) return saved;
    } catch {
      // Storage blocked or spoilt: start afresh.
    }
    return fresh();
  };
  let save = read();
  const write = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(save));
    } catch {
      // Storage blocked: it lasts until the page is closed.
    }
  };
  const now = () => Date.now() + save.dayShift * DAY_MS;
  const today = () => nzDate(new Date(now()));

  const backend: HopBackend = {
    load: async () => {
      save = read();
      return { daysDone: save.daysDone, lastPadDay: save.lastPadDay, today: today(), step: stepFor(save.stats, save.reached) };
    },
    start: async () => {
      save = read();
      const seed = Math.floor(Math.random() * MAX_SEED);
      save.open = makeRound(seed, save.stats, { reached: save.reached, gold: pondAfter(save.daysDone).gold });
      write();
      return save.open;
    },
    finish: async (seed, taps) => {
      save = read();
      const round = save.open;
      if (!round || round.seed !== seed) throw new HopError('That challenge has finished. Press Play to start again.');
      const result = replay(round, taps);
      if (!result.done) throw new HopError('That challenge isn’t finished yet.');
      const at = now();
      const byKey = new Map(save.stats.map((s) => [s.key, s]));
      for (const a of result.answers) byKey.set(a.key, afterAnswer(byKey.get(a.key) ?? newStats(a.key), a.correct, a.ms, at));
      save.stats = [...byKey.values()];
      const stepBefore = round.step;
      save.reached = stepFor(save.stats, save.reached);
      const day = finishChallenge(save.daysDone, save.lastPadDay, today());
      save.daysDone = day.daysDone;
      save.lastPadDay = day.lastPadDay;
      save.open = null;
      write();
      return { ...day, step: save.reached, stepBefore };
    },
  };

  const change = (f: (s: TrialSave) => void) => {
    save = read();
    f(save);
    write();
  };
  const tools = {
    nextDay: () => change((s) => void (s.dayShift += 1)),
    /** Jumps to just after this many finished days, as if each was on its own day. */
    jumpTo: (daysDone: number) => change((s) => Object.assign(s, { daysDone, lastPadDay: null })),
    /** Counts in this step from now on (as if the child's records had moved them there). */
    setStep: (step: SkipStep) => change((s) => Object.assign(s, { reached: step, stats: [] })),
    restart: () => change((s) => Object.assign(s, fresh())),
  };
  return { backend, tools };
}
