/**
 * What Diamond Drop's screens ask of the server (docs/DIAMOND-PLAN.md, section 5). The school's `diamond` function
 * (src/data/diamond.ts) and the preview's trial backend (./trialBackend.ts) both answer through the same shared rules
 * (shared/diamond/server.ts), so `fromServer` turns either one's replies into what the screens use.
 */
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import type { BoostId, Slot } from '../../../shared/diamond/config';
import type { LevelResult } from '../../../shared/diamond/engine';
import type { Player } from '../../../shared/diamond/progress';

export interface Loaded {
  player: Player;
  /** The server's clock, so "today" and the special of the week match it (milliseconds). */
  now: number;
}

export interface Started {
  seed: number;
  level: number;
  boosts: BoostId[];
  /** The guided first go (level 1, never played before). */
  starter: boolean;
  /** This level's Hold on! questions, in slot order, without their answers. */
  questions: PublicQuestion[];
  /** The player after paying for boosts. */
  player: Player;
}

export interface Marked {
  correct: boolean;
  /** The right answer, so a wrong one can be shown kindly. */
  answer: number;
}

export interface Ended {
  /** What the server's replay of the level came to (never the browser's own total). */
  result: LevelResult;
  /** Coins kept: all of them for a new level passed, a share otherwise. */
  coins: number;
  points: number;
  newLevel: boolean;
  /** Workshop upgrades just earned. */
  earned: string[];
  player: Player;
}

/** One pupil in the Hall of Diamond Finders (own school only; no maths, never a ranking). */
export interface HallRow {
  name: string;
  /** New Zealand date ('YYYY-MM-DD') the Heart Diamond was caught. */
  found: string;
  /** The claw they wear now, drawn beside their name. */
  worn: Partial<Record<Slot, string>>;
  me: boolean;
}

/** `code` is the server's reason, e.g. 'game-off' or 'ended'. */
export type Reply<T> = { ok: true; value: T } | { ok: false; message: string; code?: string };

export interface DiamondBackend {
  load(): Promise<Reply<Loaded>>;
  levelStart(level: number, boosts: BoostId[]): Promise<Reply<Started>>;
  answer(seed: number, slot: number, value: number, ms: number): Promise<Reply<Marked>>;
  /** `drops`: the tick of each Drop press that counted; `finish`: the tick Finish was pressed, if it was. */
  levelEnd(seed: number, drops: number[], finish: number | null): Promise<Reply<Ended>>;
  buy(id: string): Promise<Reply<Player>>;
  wear(slot: Slot, id: string | null): Promise<Reply<Player>>;
  /** Most recent finders first. */
  hall(): Promise<Reply<HallRow[]>>;
}

/** A server's reply: its status and JSON body (shared/diamond/server.ts). */
export type Send = (body: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>;

/** The six game requests sent through `send`; the Hall is read separately. */
export function fromServer(send: Send, hall: DiamondBackend['hall']): DiamondBackend {
  async function ask<T>(body: Record<string, unknown>, pick: (b: Record<string, unknown>) => T): Promise<Reply<T>> {
    try {
      const r = await send(body);
      if (r.status === 200) return { ok: true, value: pick(r.body) };
      const message = typeof r.body.error === 'string' ? r.body.error : 'Something went wrong. Try again in a moment.';
      return { ok: false, message, ...(typeof r.body.code === 'string' ? { code: r.body.code } : {}) };
    } catch (e) {
      return { ok: false, message: e instanceof Error && e.message ? e.message : 'The mine couldn’t be reached. Check the internet and try again.' };
    }
  }
  return {
    load: () => ask({ action: 'load' }, (b) => b as unknown as Loaded),
    levelStart: (level, boosts) => ask({ action: 'levelStart', level, boosts }, (b) => b as unknown as Started),
    answer: (seed, slot, value, ms) => ask({ action: 'answer', seed, slot, value, ms }, (b) => b as unknown as Marked),
    levelEnd: (seed, drops, finish) => ask({ action: 'levelEnd', seed, drops, finish }, (b) => b as unknown as Ended),
    buy: (id) => ask({ action: 'buy', id }, (b) => b.player as Player),
    wear: (slot, id) => ask({ action: 'wear', slot, id }, (b) => b.player as Player),
    hall,
  };
}
