/**
 * What the game asks of the server: the four calls of the `beanstalk` function (shared/beanstalk/server.ts). The real
 * school server is reached through src/data/beanstalk.ts; the trial backend below runs the very same rules in this
 * browser for the preview. `fromServer` turns either one's replies into what the screens use.
 */
import { DAYS_PER_EGG, stageForEggs, stageTarget, type HelpLevel } from '../../../shared/beanstalk/progress';
import { emptyData, memoryServices, type MemoryData } from '../../../shared/beanstalk/memoryServices';
import { makeRound, type Round, type Stage, type Tap } from '../../../shared/beanstalk/round';
import { handleBeanstalk, type BeanstalkReply, type Child, type FinishReply } from '../../../shared/beanstalk/server';

export { isChild, type Child } from '../../../shared/beanstalk/server';

export interface BeanstalkState {
  /** Null until they have chosen. */
  child: Child | null;
  daysDone: number;
  lastLeafDay: string | null;
  /** This child's dots: 0 full, 1 small, 2 none. It follows how their challenges go, not the calendar. */
  help: HelpLevel;
  /** The dots for the missing-leaf goes (S35): the pair goes have `help`. */
  helpMissing: HelpLevel;
  /** The sum this child is on (0 bonds to 10, 1 to 20, 2 to 100, 3 to 1000): it follows how their days go, not the calendar (S21). */
  stage: Stage;
  /** Finished days since the stage last changed: 0 on a stage above the first shows the bridge line. */
  stageDays: number;
  /** Today's NZ date by the server's clock. */
  today: string;
  /** False when the teacher has turned the leaves' dots off for the class. */
  dots: boolean;
  /** The kinds of go this child has seen (so each demo plays once). */
  seen: string[];
}

export interface BeanstalkBackend {
  load(): Promise<BeanstalkState>;
  choose(child: Child): Promise<void>;
  /** Today's challenge: its seed and the round the server made (the child's stage, with a few older pairs last). */
  start(): Promise<{ seed: number; round: Round }>;
  finish(seed: number, taps: readonly Tap[]): Promise<FinishReply>;
  /** Remembers that the child has seen these kinds of go. */
  markSeen(kinds: string[]): Promise<unknown>;
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
    load: async () => {
      const s = (await ask({ action: 'load' })) as unknown as BeanstalkState;
      s.seen ??= [];
      // A server function from before the two kinds (S35): both kinds have the pair kind's dots.
      s.helpMissing ??= s.help;
      // A server function from before stages: the sum is the calendar's, as the migration back-fills it.
      if (s.stage === undefined) return { ...s, stage: stageForEggs(Math.floor(s.daysDone / DAYS_PER_EGG)), stageDays: s.daysDone % DAYS_PER_EGG };
      return s;
    },
    choose: async (child) => void (await ask({ action: 'choose', child })),
    start: async () => {
      const r = (await ask({ action: 'start' })) as unknown as { seed: number; round?: Round };
      if (r.round) return { seed: r.seed, round: r.round };
      // A server function from before rounds were kept: the child is on their load's stage, the one sum.
      const { stage, daysDone } = (await ask({ action: 'load' })) as unknown as Partial<BeanstalkState> & { daysDone: number };
      return { seed: r.seed, round: makeRound(r.seed, stageTarget({ stage: stage ?? stageForEggs(Math.floor(daysDone / DAYS_PER_EGG)) })) };
    },
    finish: async (seed, taps) => (await ask({ action: 'finish', seed, taps })) as unknown as FinishReply,
    markSeen: (kinds) => ask({ action: 'seen', kinds }),
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
    /** Jumps to just after this many finished days, as if each was on its own day. The stage and the dots go where the calendar had them (as the migration does for existing pupils); `setHelp` changes them. */
    jumpTo: (daysDone: number) =>
      change((s) => {
        const p = s.data.players[PUPIL];
        if (p)
          s.data.players[PUPIL] = {
            ...p, daysDone, lastLeafDay: null, help: Math.min(2, Math.floor((daysDone % 30) / 10)) as HelpLevel, goodInRow: 0,
            helpMissing: Math.min(2, Math.floor((daysDone % 30) / 10)) as HelpLevel, goodInRowMissing: 0,
            stage: stageForEggs(Math.floor(daysDone / DAYS_PER_EGG)), goodDays: 0, hardDays: 0, stageDays: daysDone % DAYS_PER_EGG, version: p.version + 1,
          };
      }),
    /** The pretend pupil's own stage (0 bonds to 10, 1 to 20, 2 to 100, 3 to 1000), as if they had just arrived on it. */
    setStage: (stage: Stage) =>
      change((s) => {
        const p = s.data.players[PUPIL];
        if (p) s.data.players[PUPIL] = { ...p, stage, goodDays: 0, hardDays: 0, stageDays: 0, version: p.version + 1 };
      }),
    /** The pretend pupil's own dots: 0 full, 1 small, 2 none. */
    setHelp: (help: HelpLevel) =>
      change((s) => {
        const p = s.data.players[PUPIL];
        if (p) s.data.players[PUPIL] = { ...p, help, goodInRow: 0, helpMissing: help, goodInRowMissing: 0, version: p.version + 1 };
      }),
    dotsOn: () => read().dots,
    setDots: (on: boolean) => change((s) => void (s.dots = on)),
    restart: () => change((s) => Object.assign(s, fresh())),
  };

  return { backend, tools };
}
