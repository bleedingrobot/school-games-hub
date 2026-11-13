/**
 * What Order Up! asks of the server: the four calls of the `orderup` function (shared/orderup/server.ts). The real school
 * server is reached through src/data/orderup.ts; the trial backend below runs the very same rules in this browser (tests and
 * the preview).
 */
import { memoryServices } from '../../../shared/orderup/memoryServices';
import type { BagEvent } from '../../../shared/orderup/play';
import type { LevelState } from '../../../shared/orderup/progress';
import { handleOrderUp, type HelpSetting, type KeptSet, type Reply } from '../../../shared/orderup/server';

export interface OrderUpState {
  /** The highest level passed (0: none yet). */
  passed: number;
  /** The highest level the pupil may open. */
  open: number;
  /** How many levels are built so far. */
  live: number;
  levels: Record<string, LevelState>;
  helpSetting: HelpSetting;
  /** The worked examples seen ("level-1"). */
  seen: string[];
}

export interface BagReply {
  bag: { good: boolean; clean: boolean; wrongPicks: number; wrongAnswers: number };
  /** Bags done in the set, and how many of them were good. */
  done: number;
  good: number;
  /** Only after the set's last bag. */
  passedSet?: boolean;
  newLevel?: boolean;
  passed?: number;
  open?: number;
}

export interface OrderUpBackend {
  load(): Promise<OrderUpState>;
  start(level: number): Promise<KeptSet>;
  bag(seed: number, slot: number, events: BagEvent[]): Promise<BagReply>;
  markSeen(kinds: string[]): Promise<unknown>;
}

/** A refusal or failure, with words a pupil (or their teacher) can be shown. */
export class OrderUpError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export type Send = (body: Record<string, unknown>) => Promise<Reply>;

export function fromServer(send: Send): OrderUpBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new OrderUpError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    load: async () => (await ask({ action: 'load' })) as unknown as OrderUpState,
    start: async (level) => (await ask({ action: 'start', level })).set as KeptSet,
    bag: async (seed, slot, events) => (await ask({ action: 'bag', seed, slot, events })) as unknown as BagReply,
    markSeen: (kinds) => ask({ action: 'seen', kinds }),
  };
}

/** The whole activity in this browser's memory (gone when the page closes). Never talks to the school's server. */
export function trialBackend(options: { help?: HelpSetting; random?: () => number } = {}): OrderUpBackend {
  const services = memoryServices(undefined, { settings: { enabled: true, help: options.help ?? 'fade' }, random: options.random });
  return fromServer((body) => handleOrderUp(services, 'preview-pupil', body));
}
