/**
 * What Glyph Gates' screens ask of the server: the calls of the `glyph` function (shared/glyph/server.ts). The school's
 * server is reached through src/data/glyph.ts; the trial backend (./trial.ts) runs the same rules in the browser for the preview.
 */
import type { Progress, TempleResult, WallPlay } from '../../../shared/glyph/play';
import type { PublicWall } from '../../../shared/glyph/walls';

export interface Loaded {
  enabled: boolean;
  progress: Progress;
  today: string;
}

export interface StartReply {
  seed: string;
  temple: number;
  walls: PublicWall[];
  /** The help rung to start at, 0 to 3. */
  help: number;
}

export type FinishReply = { already: true } | { already?: false; result: TempleResult; progress: Progress; points: number };

export interface GlyphBackend {
  load(): Promise<Loaded>;
  start(temple: number): Promise<StartReply>;
  finish(seed: string, plays: WallPlay[]): Promise<FinishReply>;
  guideSeen(): Promise<void>;
}

export class GlyphError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}
export type Send = (body: Record<string, unknown>) => Promise<Reply>;

export function fromServer(send: Send): GlyphBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new GlyphError(typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.', typeof r.body.code === 'string' ? r.body.code : undefined);
  }
  return {
    load: async () => (await ask({ type: 'load' })) as unknown as Loaded,
    start: async (temple) => (await ask({ type: 'start', temple })) as unknown as StartReply,
    finish: async (seed, plays) => (await ask({ type: 'finish', seed, plays })) as unknown as FinishReply,
    guideSeen: async () => {
      await ask({ type: 'guide-seen' });
    },
  };
}
