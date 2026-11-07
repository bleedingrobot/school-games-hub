/**
 * What the game asks of the server: the three calls of the `hop` function (shared/hop/server.ts). The real school server
 * is reached through src/data/hop.ts; the trial backend below runs the very same rules in this browser for the preview.
 * `fromServer` turns either one's replies into what the screens use.
 */
import type { SkipStep } from '../../../shared/maths/skillPacks/earlyFacts';
import { emptyData, memoryServices, type MemoryData } from '../../../shared/hop/memoryServices';
import type { Tap } from '../../../shared/hop/play';
import type { FinishResult } from '../../../shared/hop/progress';
import { stepKeys, type Round } from '../../../shared/hop/round';
import { newStats } from '../../../shared/maths/leitner';
import { handleHop, type HopReply } from '../../../shared/hop/server';

export interface HopState {
  daysDone: number;
  lastPadDay: string | null;
  /** Today's NZ date by the server's clock. */
  today: string;
  /** The step the next challenge counts in. */
  step: SkipStep;
  /** The top step (twos) is secure, so the finish screen can point on to Penguin Pairs. */
  topSecure: boolean;
  /** False when the teacher has turned the hops' step labels off for the class. */
  labels: boolean;
}

export interface HopFinish extends FinishResult {
  /** The step for next time, and the one this challenge was in: different when the child moved up. */
  step: SkipStep;
  stepBefore: SkipStep;
  /** The top step is secure after this challenge. */
  topSecure: boolean;
}

export interface HopBackend {
  load(): Promise<HopState>;
  /** Today's challenge, made and kept by the server. */
  start(): Promise<Round>;
  finish(seed: number, taps: readonly Tap[]): Promise<HopFinish>;
}

/** A refusal or failure, with words a child (or their teacher) can be shown. */
export class HopError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export type Send = (body: Record<string, unknown>) => Promise<HopReply>;

export function fromServer(send: Send): HopBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new HopError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    load: async () => (await ask({ action: 'load' })) as unknown as HopState,
    start: async () => (await ask({ action: 'start' })).round as Round,
    finish: async (seed, taps) => (await ask({ action: 'finish', seed, taps })) as unknown as HopFinish,
  };
}

interface TrialSave {
  data: MemoryData;
  /** How many days ahead of the real date the pretend clock is. */
  dayShift: number;
  /** The pretend class's step-label setting. */
  labels: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The preview's one pretend pupil. */
const PUPIL = 'preview-pupil';

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. Never talks to the school's server. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const fresh = (): TrialSave => ({ data: emptyData(), dayShift: 0, labels: true });
  const read = (): TrialSave => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as TrialSave | null;
      if (saved?.data?.players && Array.isArray(saved.data.rounds) && saved.data.facts && Number.isInteger(saved.dayShift)) {
        return { ...saved, labels: saved.labels !== false };
      }
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
  const services = () =>
    memoryServices({
      data: save.data,
      settings: () => ({ enabled: true, labels: save.labels }),
      now: () => Date.now() + save.dayShift * DAY_MS,
      changed: write,
    });

  const backend = fromServer(async (body) => {
    save = read();
    return handleHop(services(), PUPIL, body);
  });

  const change = (f: (s: TrialSave) => void) => {
    save = read();
    f(save);
    write();
  };
  const pupil = (s: TrialSave) => s.data.players[PUPIL] ?? { daysDone: 0, lastPadDay: null, reached: 10 as SkipStep, version: 1 };
  const tools = {
    /** Counts in this step and makes every fact of it secure (box 3), as if the child had mastered it. */
    makeSecure: (step: SkipStep) =>
      change((s) => {
        const p = pupil(s);
        s.data.players[PUPIL] = { ...p, reached: step, version: p.version + 1 };
        const have = s.data.facts[PUPIL] ?? [];
        const keys = new Set(stepKeys(step));
        s.data.facts[PUPIL] = [...have.filter((f) => !keys.has(f.key)), ...[...keys].map((key) => ({ ...newStats(key), attempts: 6, correct: 6, box: 3 }))];
      }),
    nextDay: () => change((s) => void (s.dayShift += 1)),
    /** Jumps to just after this many finished days, as if each was on its own day. */
    jumpTo: (daysDone: number) =>
      change((s) => {
        const p = pupil(s);
        s.data.players[PUPIL] = { ...p, daysDone, lastPadDay: null, version: p.version + 1 };
      }),
    /** Counts in this step from now on, as if the child's records had just moved them there. */
    setStep: (step: SkipStep) =>
      change((s) => {
        const p = pupil(s);
        s.data.players[PUPIL] = { ...p, reached: step, version: p.version + 1 };
        s.data.facts[PUPIL] = [];
      }),
    labelsOn: () => read().labels,
    setLabels: (on: boolean) => change((s) => void (s.labels = on)),
    restart: () => change((s) => Object.assign(s, fresh())),
  };
  return { backend, tools };
}
