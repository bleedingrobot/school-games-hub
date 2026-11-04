/**
 * What the game asks of the server: the four calls of the `beanstalk` function (shared/beanstalk/server.ts). The real
 * school server is reached through src/data/beanstalk.ts; the trial backend below runs the very same rules in this
 * browser for the preview. `fromServer` turns either one's replies into what the screens use.
 */
import type { FinishResult } from '../../../shared/beanstalk/progress';
import { emptyData, memoryServices, type MemoryData } from '../../../shared/beanstalk/memoryServices';
import type { Tap } from '../../../shared/beanstalk/round';
import { handleBeanstalk, type BeanstalkReply, type Child } from '../../../shared/beanstalk/server';

export { isChild, type Child } from '../../../shared/beanstalk/server';

export interface BeanstalkState {
  /** Null until they have chosen. */
  child: Child | null;
  daysDone: number;
  lastLeafDay: string | null;
  /** Today's NZ date by the server's clock. */
  today: string;
  /** False when the teacher has turned the leaves' dots off for the class. */
  dots: boolean;
}

export interface BeanstalkBackend {
  load(): Promise<BeanstalkState>;
  choose(child: Child): Promise<void>;
  /** Today's challenge: the seed the leaves come from. */
  start(): Promise<{ seed: number }>;
  finish(seed: number, taps: readonly Tap[]): Promise<FinishResult>;
}

/** A refusal or failure, with words a child (or their teacher) can be shown. */
export class BeanstalkError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export type Send = (body: Record<string, unknown>) => Promise<BeanstalkReply>;

export function fromServer(send: Send): BeanstalkBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new BeanstalkError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    load: async () => (await ask({ action: 'load' })) as unknown as BeanstalkState,
    choose: async (child) => void (await ask({ action: 'choose', child })),
    start: async () => (await ask({ action: 'start' })) as unknown as { seed: number },
    finish: async (seed, taps) => (await ask({ action: 'finish', seed, taps })) as unknown as FinishResult,
  };
}

interface TrialSave {
  data: MemoryData;
  /** How many days ahead of the real date the pretend clock is. */
  dayShift: number;
  /** The pretend class's dots setting. */
  dots: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The preview's one pretend pupil. */
const PUPIL = 'preview-pupil';

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. Never talks to the school's server. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const fresh = (): TrialSave => ({ data: emptyData(), dayShift: 0, dots: true });
  const read = (): TrialSave => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as TrialSave | null;
      if (saved?.data?.players && Array.isArray(saved.data.rounds) && Number.isInteger(saved.dayShift)) return { ...saved, dots: saved.dots !== false };
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
      settings: () => ({ enabled: true, dots: save.dots }),
      now: () => Date.now() + save.dayShift * DAY_MS,
      changed: write,
    });

  const backend = fromServer(async (body) => handleBeanstalk(services(), PUPIL, body));

  const change = (f: (s: TrialSave) => void) => {
    save = read();
    f(save);
    write();
  };
  const tools = {
    nextDay: () => change((s) => void (s.dayShift += 1)),
    /** Jumps to just after this many finished days, as if each was on its own day. */
    jumpTo: (daysDone: number) =>
      change((s) => {
        const p = s.data.players[PUPIL];
        if (p) s.data.players[PUPIL] = { ...p, daysDone, lastLeafDay: null, version: p.version + 1 };
      }),
    dotsOn: () => read().dots,
    setDots: (on: boolean) => change((s) => void (s.dots = on)),
    restart: () => change((s) => Object.assign(s, fresh())),
  };

  return { backend, tools };
}
