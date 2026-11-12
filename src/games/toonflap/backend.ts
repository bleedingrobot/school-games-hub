/**
 * What Toon Flap's screens ask of the server: the calls of the `toonflap` function (shared/toonflap/server.ts). The real
 * school server is reached through src/data/toonflap.ts; the trial backend below runs the very same rules in this browser
 * for the preview (./trial.ts, kept apart so the home page doesn't download the rules), with a pretend pupil kept in localStorage.
 * Built like Robin's Berry Basket.
 */
import type { FinishReply, GapSign, Picks, Reply, StartReply } from '../../../shared/toonflap/server';
import type { Progress } from '../../../shared/toonflap/collection';

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
