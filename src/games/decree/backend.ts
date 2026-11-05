/**
 * How Royal Decree's screens talk to a server: the school's `decree` function (src/data/decree.ts) or the browser-only
 * trial (trialBackend.ts). Both answer the same requests (shared/decree/server.ts).
 */
import type { Album, PublicReign } from '../../../shared/decree/server';

export interface DecreeBackend {
  /** The preview: saved in this browser only, no points. */
  trial: boolean;
  /** Sends one request. Throws a DecreeError with words to show if the server says no or can't be reached. */
  send(body: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** A refusal from the server, with its words and its code (e.g. 'game-off', 'gone'). */
export class DecreeError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

export interface LoadReply {
  reign: PublicReign | null;
  album: Album;
  pointReignsLeft: number;
}

export interface AnswerReply {
  right: boolean;
  answer: number;
}

export interface ReignReply {
  reign: PublicReign;
  already?: boolean;
}

/** The reply's body, or a DecreeError with the server's words. */
export function readReply(status: number, body: Record<string, unknown>): Record<string, unknown> {
  if (status === 200) return body;
  const error = typeof body.error === 'string' ? body.error : 'Something went wrong. Try again in a moment.';
  throw new DecreeError(error, typeof body.code === 'string' ? body.code : undefined, status);
}
