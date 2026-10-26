/**
 * How Kingdom Keeper's screens talk to a server: the school's `kingdom` function (src/data/kingdom.ts) or the
 * browser-only trial (trialBackend.ts). Both answer the same requests (shared/kingdom/server.ts).
 */
import type { Adviser } from '../../../shared/kingdom/engine';
import type { KingdomRecord, PublicReign } from '../../../shared/kingdom/reign';

export interface KingdomBackend {
  /** The preview: saved in this browser only, no points. */
  trial: boolean;
  /** Sends one request. Throws an Error with words to show if the server says no or can't be reached. */
  send(body: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** A refusal from the server, with its words and its code (e.g. 'game-off', 'gone'). */
export class KingdomError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

export interface LoadReply {
  reign: PublicReign | null;
  record: KingdomRecord;
  pointReignsLeft: number;
}

export interface AnswerReply {
  right: boolean;
  answer: number;
  adviser: Adviser;
}

export interface ReignReply {
  reign: PublicReign;
  already?: boolean;
}

/** The reply's body, or a KingdomError with the server's words. */
export function readReply(status: number, body: Record<string, unknown>): Record<string, unknown> {
  if (status === 200) return body;
  const error = typeof body.error === 'string' ? body.error : 'Something went wrong. Try again in a moment.';
  throw new KingdomError(error, typeof body.code === 'string' ? body.code : undefined, status);
}
