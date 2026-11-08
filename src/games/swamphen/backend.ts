/**
 * What the game asks of the server: the three calls of the `swamphen` function (shared/swamphen/server.ts). The real school
 * server is reached through src/data/swamphen.ts; the trial backend below runs the very same rules in this browser for the
 * preview. Copied from Weka.
 */
import { emptyData, memoryServices, type MemoryData } from '../../../shared/swamphen/memoryServices';
import type { Tap } from '../../../shared/swamphen/play';
import type { FinishResult } from '../../../shared/swamphen/progress';
import { type HelpLevel, type HelpSetting, type Round, type Step } from '../../../shared/swamphen/round';
import { TOP_LEVEL } from '../../../shared/swamphen/config';
import { handleSwamphen, unplayed, type SwamphenReply } from '../../../shared/swamphen/server';

export interface SwamphenState {
  daysDone: number;
  lastDay: string | null;
  /** Today's NZ date by the server's clock. */
  today: string;
  /** The step and help level the next challenge is at. */
  step: Step;
  level: HelpLevel;
  /** The class's help setting. */
  help: HelpSetting;
  /** The kinds of go this child has already seen (no demo for them). */
  seen: string[];
}

export interface SwamphenFinish extends FinishResult {
  /** Goes right at the first tap. */
  firstRight: number;
  /** The step and help level for next time, and the ones before: different when they moved. */
  step: Step;
  level: HelpLevel;
  stepBefore: Step;
  levelBefore: HelpLevel;
}

export interface SwamphenBackend {
  load(): Promise<SwamphenState>;
  /** Today's challenge, made and kept by the server. */
  start(): Promise<Round>;
  finish(seed: number, taps: readonly Tap[]): Promise<SwamphenFinish>;
  /** Remembers that the child has seen these kinds of go (a demo, or a go finished). */
  markSeen(kinds: readonly string[]): Promise<void>;
}

/** A refusal or failure, with words a child (or their teacher) can be shown. */
export class SwamphenError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export type Send = (body: Record<string, unknown>) => Promise<SwamphenReply>;

export function fromServer(send: Send): SwamphenBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new SwamphenError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    load: async () => {
      const state = (await ask({ action: 'load' })) as unknown as SwamphenState;
      return { ...state, seen: Array.isArray(state.seen) ? state.seen : [] };
    },
    start: async () => (await ask({ action: 'start' })).round as Round,
    finish: async (seed, taps) => (await ask({ action: 'finish', seed, taps })) as unknown as SwamphenFinish,
    markSeen: async (kinds) => void (await ask({ action: 'seen', kinds })),
  };
}

interface TrialSave {
  data: MemoryData;
  /** How many days ahead of the real date the pretend clock is. */
  dayShift: number;
  /** The pretend class's help setting. */
  help: HelpSetting;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The preview's one pretend pupil. */
const PUPIL = 'preview-pupil';

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. Never talks to the school's server. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const fresh = (): TrialSave => ({ data: emptyData(), dayShift: 0, help: 'fade' });
  const read = (): TrialSave => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as TrialSave | null;
      if (saved?.data?.players && Array.isArray(saved.data.rounds) && saved.data.facts && Number.isInteger(saved.dayShift)) {
        return { ...saved, help: saved.help ?? 'fade' };
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
      settings: () => ({ enabled: true, help: save.help }),
      now: () => Date.now() + save.dayShift * DAY_MS,
      changed: write,
    });

  const backend = fromServer(async (body) => {
    save = read();
    return handleSwamphen(services(), PUPIL, body);
  });

  const change = (f: (s: TrialSave) => void) => {
    save = read();
    f(save);
    write();
  };
  const pupil = (s: TrialSave) => s.data.players[PUPIL] ?? { ...unplayed(), version: 1 };
  const tools = {
    nextDay: () => change((s) => void (s.dayShift += 1)),
    /** Jumps to just after this many finished days, as if each was on its own day. */
    jumpTo: (daysDone: number) =>
      change((s) => {
        const p = pupil(s);
        s.data.players[PUPIL] = { ...p, daysDone, lastDay: daysDone ? null : p.lastDay, version: p.version + 1 };
      }),
    /** Plays at this step and help level from now on, as if the child's challenges had moved them there. */
    setPlace: (step: Step, level: HelpLevel = TOP_LEVEL as HelpLevel) =>
      change((s) => {
        const p = pupil(s);
        s.data.players[PUPIL] = { ...p, step, level, goodInRow: 0, goodAtStep: 0, version: p.version + 1 };
      }),
    place: () => {
      const p = pupil(read());
      return { step: p.step, level: p.level };
    },
    help: () => read().help,
    setHelp: (help: HelpSetting) => change((s) => void (s.help = help)),
    restart: () => change((s) => Object.assign(s, fresh())),
  };
  return { backend, tools };
}
