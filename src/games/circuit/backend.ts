/**
 * What the Circuit Racer screens need from a server: the `circuit` function (docs/CIRCUIT-PLAN.md, section 8). The live
 * one posts to the school's server (`liveCircuit` in liveBackend.ts); the preview runs the very same handler in the page on
 * a pretend database (`pretendCircuit` in pretend.ts), so it never calls the live site.
 */
import type { CircuitSave, Medal, RacerId } from '../../../shared/circuit/game';
import type { RunMaths } from '../../../shared/circuit/maths';

export interface StartReply {
  seed: string;
  stamp: string;
  /** Finishes left today, this one included; null on an Unlimited day. */
  left: number | null;
  /** The go's questions (ports and gates), or null with maths off (or if they couldn't be made). */
  maths?: RunMaths | null;
}

/** A recharge port's answer, marked by the server. */
export interface AnswerReply {
  right: boolean;
  answer: number;
}

export interface FinishReply {
  result: 'best' | 'saved' | 'duplicate';
  steps: number;
  medal: Medal;
  clean: boolean;
  charged: boolean;
  battery: number;
  /** Finished in hard mode (missing from an old reply: no). */
  hard?: boolean;
  left: number | null;
}

/** A refusal the screens show: 'done-today' (all 5 used), 'off' (the teacher's switch), 'locked', or anything else. */
export class CircuitError extends Error {
  constructor(message: string, readonly code: string | null = null) {
    super(message);
  }
}

export interface CircuitBackend {
  load(): Promise<CircuitSave>;
  /** `maths`: the pupil's own choice, used only when the teacher lets pupils choose. */
  start(road: string, maths?: boolean): Promise<StartReply>;
  answer(a: { road: string; seed: string; stamp: string; slot: number; answer: number; ms: number }): Promise<AnswerReply>;
  finish(run: { road: string; seed: string; stamp: string; inputs: string; crashes: number; hard: boolean }): Promise<FinishReply>;
  /** Saves the pupil's racer (Stage 5); refused ('locked') until its world is open. */
  racer(racer: RacerId): Promise<{ racer: RacerId }>;
}

type Post = (body: object) => Promise<{ status: number; body: Record<string, unknown> }>;

/** A backend from something that posts to the function and gives back its status and reply. */
export function fromPost(post: Post): CircuitBackend {
  const ask = async <T,>(body: object): Promise<T> => {
    const r = await post(body);
    if (r.status !== 200) throw new CircuitError(typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Try again.', typeof r.body.code === 'string' ? r.body.code : null);
    return r.body as T;
  };
  return {
    load: () => ask({ action: 'load' }),
    start: (road, maths) => ask({ action: 'start', road, ...(maths === undefined ? {} : { maths }) }),
    answer: (a) => ask({ action: 'answer', ...a }),
    finish: (run) => ask({ action: 'finish', ...run }),
    racer: (racer) => ask({ action: 'racer', racer }),
  };
}
