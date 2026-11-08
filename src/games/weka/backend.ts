/**
 * What the game asks of the server: the three calls of the `weka` function (shared/weka/server.ts). The real school
 * server is reached through src/data/weka.ts; the trial backend below runs the very same rules in this browser for the
 * preview. Copied from Hop.
 */
import { emptyData, memoryServices, type MemoryData } from '../../../shared/weka/memoryServices';
import type { Tap } from '../../../shared/weka/play';
import type { FinishResult } from '../../../shared/weka/progress';
import type { Level, Round } from '../../../shared/weka/round';
import { handleWeka, type HelpSetting, type WekaReply } from '../../../shared/weka/server';

export interface WekaState {
  daysDone: number;
  lastStoneDay: string | null;
  /** Today's NZ date by the server's clock. */
  today: string;
  /** The level the next challenge is at. */
  level: Level;
  /** The class's help setting. */
  help: HelpSetting;
  /** The kinds of go this child has seen (so each demo plays once). */
  seen: string[];
}

export interface WekaFinish extends FinishResult {
  /** The level for next time, and the one this challenge was at: different when the child moved up. */
  level: Level;
  levelBefore: Level;
}

export interface WekaBackend {
  load(): Promise<WekaState>;
  /** Today's challenge, made and kept by the server. */
  start(): Promise<Round>;
  finish(seed: number, taps: readonly Tap[]): Promise<WekaFinish>;
  /** Remembers that the child has seen these kinds of go. */
  markSeen(kinds: string[]): Promise<unknown>;
}

/** A refusal or failure, with words a child (or their teacher) can be shown. */
export class WekaError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export type Send = (body: Record<string, unknown>) => Promise<WekaReply>;

export function fromServer(send: Send): WekaBackend {
  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const r = await send(body);
    if (r.status === 200) return r.body;
    throw new WekaError(
      typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Please try again soon.',
      typeof r.body.code === 'string' ? r.body.code : undefined,
    );
  }
  return {
    load: async () => (await ask({ action: 'load' })) as unknown as WekaState,
    start: async () => (await ask({ action: 'start' })).round as Round,
    finish: async (seed, taps) => (await ask({ action: 'finish', seed, taps })) as unknown as WekaFinish,
    markSeen: (kinds) => ask({ action: 'seen', kinds }),
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
    return handleWeka(services(), PUPIL, body);
  });

  const change = (f: (s: TrialSave) => void) => {
    save = read();
    f(save);
    write();
  };
  const pupil = (s: TrialSave) => s.data.players[PUPIL] ?? { daysDone: 0, lastStoneDay: null, reached: 1 as Level, version: 1 };
  const tools = {
    nextDay: () => change((s) => void (s.dayShift += 1)),
    /** Jumps to just after this many finished days, as if each was on its own day. */
    jumpTo: (daysDone: number) =>
      change((s) => {
        const p = pupil(s);
        s.data.players[PUPIL] = { ...p, daysDone, lastStoneDay: daysDone ? null : p.lastStoneDay, version: p.version + 1 };
      }),
    /** Plays at this level from now on, as if the child's records had just moved them there. */
    setLevel: (level: Level) =>
      change((s) => {
        const p = pupil(s);
        s.data.players[PUPIL] = { ...p, reached: level, version: p.version + 1 };
        s.data.facts[PUPIL] = [];
      }),
    help: () => read().help,
    setHelp: (help: HelpSetting) => change((s) => void (s.help = help)),
    restart: () => change((s) => Object.assign(s, fresh())),
  };
  return { backend, tools };
}
