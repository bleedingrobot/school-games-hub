/**
 * What Diamond Drop's screens ask of the server (docs/DIAMOND-PLAN.md, section 5). The preview and the tests use the
 * trial backend (./trialBackend.ts), which runs the shared rules in the browser; Stage 3's `diamond` server function
 * answers the same six requests with the same shapes, so the screens don't change when it arrives.
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

export type Reply<T> = { ok: true; value: T } | { ok: false; message: string };

export interface DiamondBackend {
  load(): Promise<Reply<Loaded>>;
  levelStart(level: number, boosts: BoostId[]): Promise<Reply<Started>>;
  answer(seed: number, slot: number, value: number, ms: number): Promise<Reply<Marked>>;
  /** `drops`: the tick of each Drop press that counted; `finish`: the tick Finish was pressed, if it was. */
  levelEnd(seed: number, drops: number[], finish: number | null): Promise<Reply<Ended>>;
  buy(id: string): Promise<Reply<Player>>;
  wear(slot: Slot, id: string | null): Promise<Reply<Player>>;
}
