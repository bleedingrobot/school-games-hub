/**
 * How Sky Isles' screens talk to a server: the school's `isles` function (src/data/isles.ts) or the browser-only trial
 * (trialBackend.ts). Both answer the same requests (shared/isles/server.ts), so the screens can't tell them apart.
 */
import type { Island, TurnReport } from '../../../shared/isles/engine';
import type { RaceResult, Racer, RaceSoFar } from '../../../shared/isles/race';
import type { GiftId } from '../../../shared/isles/config';
import type { IslandLook, NewsItem, ShownQuestion } from '../../../shared/isles/server';

export type { NewsItem };

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
  /** A classmate's name, for a race against their island. */
  opponentName?: string;
  starter: boolean;
  you: Racer;
  them: Racer;
  questions: ShownQuestion[];
  answered: Record<string, { value: number; right: boolean }>;
  /** An open race so far, up to the next stop (from the server). */
  soFar?: RaceSoFar;
  result?: RaceResult;
  prize?: { coins: number; crystals: number };
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
  openRace?: PublicRace | null;
  report?: TurnReport;
  already?: boolean;
  /** Post from classmates opened on this load. */
  post?: PostShown[];
}

/** A gift, or a classmate's race against this island, as opened from the post. */
export type PostShown = { fromName: string; coins: number } & ({ kind: 'gift'; gift: GiftId } | { kind: 'raced'; homeWin: boolean });

/** A classmate's island on the class sky: never its coins or maths. */
export interface ClassmateCard {
  id: string;
  name: string;
  keeper: string | null;
  spots: number;
  decorations: number;
  lighthouse: number;
  /** Why it can't be raced now (null: it can). */
  raceWhy: string | null;
  /** Why a gift can't be left now (null: it can). */
  giftWhy: string | null;
}

/** What `sky` sends back. */
export interface ClassSkyView {
  classmates: ClassmateCard[];
  news: NewsItem[];
  giftsSentToday: number;
}

/** What `visit` sends back: the card, and the island to look at. */
export type Visit = ClassmateCard & { look: IslandLook };

/** The reply's body, or an IslesError with the server's words. */
export function readReply(status: number, body: Record<string, unknown>): Record<string, unknown> {
  if (status === 200) return body;
  const error = typeof body.error === 'string' ? body.error : 'Something went wrong. Try again in a moment.';
  throw new IslesError(error, typeof body.code === 'string' ? body.code : undefined, status);
}
