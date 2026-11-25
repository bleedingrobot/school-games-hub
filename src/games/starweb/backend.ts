/**
 * What Star Web's screens ask of the server: the calls of the `starweb` function (shared/starweb/server.ts). The school's
 * server is reached through src/data/starweb.ts; the trial backend (./trial.ts) runs the same rules in the browser for the
 * preview.
 */
import type { Progress } from '../../../shared/starweb/map';
import type { FinishReply, Mode, PublicSky } from '../../../shared/starweb/server';
import type { SoloStar } from '../../../shared/starweb/sky';
import type { Medal } from '../../../shared/starweb/config';

export type { FinishReply, Mode, PublicSky };

export interface Loaded {
  enabled: boolean;
  progress: Progress;
  /** The sky left part-way, if any. */
  open: PublicSky | null;
  today: string;
  /** Skies that can still earn points today. */
  pointsLeft: number;
}

export interface SaveReply {
  stars: SoloStar[];
  medal?: Medal;
  already?: boolean;
}

export interface StarWebBackend {
  load(): Promise<Loaded>;
  /** The open sky again (Carry on), or a new one with `fresh`. A Free sky takes the pupil's two numbers. */
  open(mode: Mode, o?: { fresh?: boolean; x?: number; y?: number }): Promise<{ sky: PublicSky; progress?: Progress }>;
  save(seed: string, tries: string[], hints: number): Promise<SaveReply>;
  finish(seed: string, tries: string[], hints: number): Promise<FinishReply | SaveReply>;
  guideSeen(): Promise<void>;
}

export class StarWebError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}
export type Send = (body: Record<string, unknown>) => Promise<Reply>;

export function fromServer(send: Send): StarWebBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new StarWebError(typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.', typeof r.body.code === 'string' ? r.body.code : undefined);
  }
  return {
    load: async () => (await ask({ type: 'load' })) as unknown as Loaded,
    open: async (mode, o = {}) => (await ask({ type: 'open', mode, ...o })) as unknown as { sky: PublicSky; progress?: Progress },
    save: async (seed, tries, hints) => (await ask({ type: 'save', seed, tries, hints })) as unknown as SaveReply,
    finish: async (seed, tries, hints) => (await ask({ type: 'finish', seed, tries, hints })) as unknown as FinishReply | SaveReply,
    guideSeen: async () => {
      await ask({ type: 'guide-seen' });
    },
  };
}
