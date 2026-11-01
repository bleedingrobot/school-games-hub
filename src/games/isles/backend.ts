/**
 * How Sky Isles' screens talk to a server: the school's `isles` function (src/data/isles.ts) or the browser-only trial
 * (trialBackend.ts). Both answer the same requests (shared/isles/server.ts), so the screens can't tell them apart.
 */
import type { Island, Prices, TurnReport } from '../../../shared/isles/engine';
import type { RaceResult, Racer } from '../../../shared/isles/race';
import type { ShownQuestion } from '../../../shared/isles/server';

export interface IslesBackend {
  /** The preview: saved in this browser only, no points. */
  trial: boolean;
  /** Sends one request. Throws an IslesError with words to show if the server says no or can't be reached. */
  send(body: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** A refusal from the server, with its words and its code (e.g. 'game-off', 'stale'). */
export class IslesError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

/** This turn's question, and its mark once answered. */
export type TurnQuestion = ShownQuestion & { answered: { value: number; right: boolean } | null };

export interface PublicRace {
  id: number;
  opponent: string;
  starter: boolean;
  you: Racer;
  them: Racer;
  questions: ShownQuestion[];
  answered: Record<string, { value: number; right: boolean }>;
  result?: RaceResult;
  prize?: { coins: number; goods: number };
}

/** What `load` and `turn` send back. */
export interface IslandView {
  island: Island;
  day: number;
  season: number;
  question: TurnQuestion | null;
  guide: { done: boolean; show: boolean };
  keeper: string | null;
  races: boolean;
  prices: Prices;
  openRace?: PublicRace | null;
  report?: TurnReport;
  already?: boolean;
}

/** The reply's body, or an IslesError with the server's words. */
export function readReply(status: number, body: Record<string, unknown>): Record<string, unknown> {
  if (status === 200) return body;
  const error = typeof body.error === 'string' ? body.error : 'Something went wrong. Try again in a moment.';
  throw new IslesError(error, typeof body.code === 'string' ? body.code : undefined, status);
}
