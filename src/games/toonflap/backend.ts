/**
 * What Toon Flap's screens ask of the server: the calls of the `toonflap` function (shared/toonflap/server.ts). The real
 * school server is reached through src/data/toonflap.ts; the trial backend below runs the very same rules in this browser
 * for the preview, with a pretend pupil kept in localStorage. Built like Robin's Berry Basket.
 */
import { emptyData, memoryServices, type MemoryData } from '../../../shared/toonflap/memoryServices';
import { handleToonFlap, type FinishReply, type GapSign, type Picks, type Reply, type StartReply } from '../../../shared/toonflap/server';
import type { Progress } from '../../../shared/toonflap/collection';
import { LEVELS } from '../../../shared/toonflap/levels';

export type { FinishReply, GapSign, Picks, StartReply };

export interface Loaded {
  enabled: boolean;
  progress: Progress;
  /** The teacher's maths switch: off means checks are plain rests and gaps show arrows. */
  maths: boolean;
  readTime: boolean;
  picks: Picks;
  /** The server's NZ day (YYYY-MM-DD): one new level opens a day. */
  today: string;
}

export interface CheckMark {
  correct: boolean;
  answer: number;
}

export interface ToonFlapBackend {
  load(): Promise<Loaded>;
  savePicks(picks: Picks): Promise<void>;
  start(level: string, gentle: boolean): Promise<StartReply>;
  /** Marks a check's answer once; asking again for the same slot gives the first mark. */
  answer(seed: string, slot: number, value: number, ms: number): Promise<CheckMark>;
  /** `flaps` is encodeFlaps() of the step numbers. */
  finish(seed: string, flaps: string, potionUsed: boolean): Promise<FinishReply>;
}

/** A refusal or failure, with words a child (or their teacher) can be shown. */
export class ToonFlapError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export type Send = (body: Record<string, unknown>) => Promise<Reply>;

export function fromServer(send: Send): ToonFlapBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new ToonFlapError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    load: async () => (await ask({ action: 'load' })) as unknown as Loaded,
    savePicks: async (picks) => {
      await ask({ action: 'picks', flyer: picks.flyer, trail: picks.trail });
    },
    start: async (level, gentle) => (await ask({ action: 'start', level, gentle })) as unknown as StartReply,
    answer: async (seed, slot, value, ms) => {
      const r = await ask({ action: 'answer', seed, slot, value, ms });
      return { correct: r.correct === true, answer: Number(r.answer) };
    },
    finish: async (seed, flaps, potion) => {
      try {
        return (await ask({ action: 'finish', seed, flaps, potion })) as unknown as FinishReply;
      } catch (e) {
        // A run the server couldn't check: the results screen says so kindly.
        if (e instanceof ToonFlapError && (e.code === 'not-done' || e.code === 'too-fast')) {
          return { valid: false } as FinishReply;
        }
        throw e;
      }
    },
  };
}

interface TrialSave {
  data: MemoryData;
  maths: boolean;
}

/** The preview's one pretend pupil. */
const PUPIL = 'preview-pupil';

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. Never talks to the school's server. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const fresh = (): TrialSave => ({ data: emptyData(), maths: true });
  const read = (): TrialSave => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as TrialSave | null;
      if (saved?.data?.players && Array.isArray(saved.data.runs)) return saved;
    } catch {
      // A private window, or an old save: start fresh.
    }
    return fresh();
  };
  let save = read();
  const write = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(save));
    } catch {
      // Not kept: it lasts until the page closes.
    }
  };
  // The preview has no wait for real time: a run can be checked as soon as it finishes (the pretend clock runs ahead).
  let ahead = 0;
  const services = () =>
    memoryServices({ data: save.data, settings: () => ({ enabled: true, maths: save.maths, readTime: true }), now: () => Date.now() + ahead, changed: write });

  const backend = fromServer(async (body) => {
    save = read();
    if (body.action === 'finish') ahead += 10 * 60 * 1000;
    return handleToonFlap(services(), PUPIL, body);
  });

  const progress = (): Progress => save.data.players[PUPIL]?.progress ?? { levels: {}, checksRight: 0, streak: 0, cleanFlights: 0, rightGaps: 0, potions: 0, potionsEarned: 0 };
  const setProgress = (p: Progress) => {
    const had = save.data.players[PUPIL] ?? { progress: p, picks: { flyer: 'fantail', trail: null }, version: 0 };
    save.data.players[PUPIL] = { ...had, progress: p, version: had.version + 1 };
    write();
  };

  /** Preview-only buttons. */
  const tools = {
    openAll: () => {
      const p = progress();
      const levels = { ...p.levels };
      for (const l of LEVELS) levels[l.id] = { finishes: Math.max(levels[l.id]?.finishes ?? 0, 1), best: levels[l.id]?.best ?? null, bestPlain: levels[l.id]?.bestPlain ?? null, medal: levels[l.id]?.medal ?? 'bronze' };
      setProgress({ ...p, levels, opened: LEVELS.length });
    },
    /** Jumps the pretend clock a day on, so the next level can open (only one opens a day). */
    nextDay: () => {
      ahead += 24 * 60 * 60 * 1000;
    },
    unlockAll: () => {
      const p = progress();
      const levels = { ...p.levels };
      for (const l of LEVELS) levels[l.id] = { finishes: 3, best: levels[l.id]?.best ?? null, bestPlain: levels[l.id]?.bestPlain ?? null, medal: 'gold' };
      setProgress({ ...p, levels, opened: LEVELS.length, checksRight: Math.max(p.checksRight, 20), cleanFlights: Math.max(p.cleanFlights, 3), potions: 3 });
    },
    setMaths: (on: boolean) => {
      save.maths = on;
      write();
    },
    maths: () => save.maths,
    restart: () => {
      save = { ...fresh(), maths: save.maths };
      write();
    },
  };
  return { backend, tools };
}
