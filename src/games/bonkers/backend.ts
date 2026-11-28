/**
 * What Smash Quest's screens ask of the server: the calls of the `bonkers` function (shared/bonkers/server.ts). The real
 * school server is reached through ./data.ts; the trial backend (./trial.ts) runs the very same rules in this browser for
 * the preview, with a pretend pupil kept in localStorage. Built like Toon Flap.
 */
import type { AdventureView, AnswerReply, ClassBoss, FinishReply, LoadReply, Reply } from '../../../shared/bonkers/server';
import type { Progress } from '../../../shared/bonkers/engine';
import type { HeroClass, Look, ShopKind } from '../../../shared/bonkers/content';

export type { AdventureView, AnswerReply, ClassBoss, FinishReply, LoadReply };

export interface StartReply {
  current: AdventureView;
  progress?: Progress;
  waiting?: number | null;
}

export interface BonkersBackend {
  load(): Promise<LoadReply>;
  hero(cls: HeroClass, look: Look): Promise<Progress>;
  start(quest: string): Promise<StartReply>;
  /** Marks the next answer once; asking again for the same slot gives the first mark. */
  answer(seed: string, slot: number, value: number, ms: number, special: boolean): Promise<AnswerReply>;
  finish(seed: string): Promise<FinishReply>;
  /** The sticker shop: buy a hat or pet (and wear it), or wear one already bought (null takes it off). */
  buy(item: string): Promise<Progress>;
  wear(kind: ShopKind, item: string | null): Promise<Progress>;
  /** True for the preview's trial in the browser: nothing is saved, so no achievements or trophies to ask about. */
  offline?: boolean;
}

/** A refusal or failure, with words a child (or their teacher) can be shown. */
export class BonkersError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export type Send = (body: Record<string, unknown>) => Promise<Reply>;

export function fromServer(send: Send): BonkersBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new BonkersError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    load: async () => (await ask({ action: 'load' })) as unknown as LoadReply,
    hero: async (cls, look) => ((await ask({ action: 'hero', cls, look })) as { progress: Progress }).progress,
    start: async (quest) => (await ask({ action: 'start', quest })) as unknown as StartReply,
    answer: async (seed, slot, value, ms, special) => (await ask({ action: 'answer', seed, slot, value, ms, special })) as unknown as AnswerReply,
    finish: async (seed) => (await ask({ action: 'finish', seed })) as unknown as FinishReply,
    buy: async (item) => ((await ask({ action: 'buy', item })) as { progress: Progress }).progress,
    wear: async (kind, item) => ((await ask({ action: 'wear', kind, item })) as { progress: Progress }).progress,
  };
}
