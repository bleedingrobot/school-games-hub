/**
 * 101 with classmates: the parts of refereeing a live game that aren't the rules themselves.
 *
 * The server function (supabase/functions/card-game) keeps the whole game (`Game`, with the
 * stack and everyone's cards) in a table no student can read. After every change it writes
 * one small row per player, `SeatRow`, holding only that player's view (`viewFor`) and the
 * events they may see (`eventsFor`). Pages only ever read their own seat row.
 *
 * Timers (the server checks its own clock; any player's page may ask once time is up):
 *   - the peek: 15 seconds, then it ends for everyone who hasn't pressed "I've remembered";
 *   - a turn: 60 seconds, then it's skipped (3 skips in a row and you're out);
 *   - between rounds: when everyone has pressed Next, or after 30 seconds.
 */
import type { Card101Stats } from './save';
import { statsFor } from './save';
import { MAX_PLAYERS, MIN_PLAYERS, TARGETS, type Action, type Game, type GameEvent, type Settings, type Target } from './engine';
import { eventsFor, viewFor, type SeatView } from './view';

export const PEEK_MS = 15_000;
export const TURN_MS = 60_000;
export const NEXT_ROUND_MS = 30_000;
/** A little extra on every clock, for slow Wi-Fi. Pages show the clock without it. */
export const GRACE_MS = 1_500;
/** Games of fewer full rounds than this earn nothing. */
export const MIN_ROUNDS_TO_COUNT = 2;

export type CardStatus = 'waiting' | 'playing' | 'finished' | 'cancelled' | 'expired';

/** What every player in a game may know, apart from cards. The same in every seat row. */
export interface PublicInfo {
  code: string | null;
  inLobby: boolean;
  /** The player who started it (seat 0 while waiting). */
  host: string | null;
  /** Students by seat. Waiting: in the order they joined. From the start: fixed. Null: deleted. */
  players: (string | null)[];
  /** How many players the host asked for (2–4). It starts by itself when that many have joined. */
  wanted: number;
  settings: Settings;
  status: CardStatus;
  version: number;
  expiresAt: string;
  /** When the clock runs out for the current step (peek, turn, or the pause between rounds). */
  deadline: string | null;
  /** Between rounds: who has pressed Next. */
  ready: boolean[] | null;
  ending: 'finished' | 'abandoned' | null;
  /** At the end, by seat: 1st, 2nd…; 0 for players who were out. */
  places: number[] | null;
  /** At the end, by seat: whether the game earns that player points. */
  counts: boolean[] | null;
  rematchGame: string | null;
}

/** One player's row: the public info, their own view of the cards, and what they saw happen. */
export interface SeatRow extends SeatWrite {
  /** The last few events (the database keeps the last 40), for the log after a reload. */
  log: GameEvent[];
}

/** What the server writes for each seat (the database adds the log). */
export interface SeatWrite {
  game: string;
  player: string;
  seat: number;
  version: number;
  status: CardStatus;
  info: PublicInfo;
  /** Null while waiting. */
  view: SeatView | null;
  /** What the last change did, as this player may see it. */
  events: GameEvent[];
}

export function parseSettings(input: unknown): Settings | null {
  if (typeof input !== 'object' || input === null) return null;
  const s = input as Record<string, unknown>;
  if (Object.keys(s).length !== 1 || !TARGETS.includes(s.target as Target)) return null;
  return { target: s.target as Target };
}

export const isWanted = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= MIN_PLAYERS && (n as number) <= MAX_PLAYERS;

/** The seat rows for a game: one per student, each with only what they may know. */
export function seatRows(id: string, info: PublicInfo, game: Game | null, events: GameEvent[]): SeatWrite[] {
  return info.players.flatMap((player, seat) =>
    player
      ? [{
          game: id,
          player,
          seat,
          version: info.version,
          status: info.status,
          info,
          view: game ? viewFor(game, seat) : null,
          events: game ? eventsFor(events, seat, game) : [],
        }]
      : [],
  );
}

/** When the clock should next run out, after a change that produced `events`. */
export function deadlineAfter(game: Game, events: GameEvent[], now: number, previous: number | null): number | null {
  if (game.phase === 'over') return null;
  const restarts = events.some((e) => e.kind === 'deal' || e.kind === 'play-starts' || e.kind === 'turn' || e.kind === 'round-end');
  if (!restarts && previous !== null) return previous;
  if (game.phase === 'peek') return now + PEEK_MS;
  if (game.phase === 'play') return now + TURN_MS;
  return now + NEXT_ROUND_MS;
}

/** What the referee does when the clock runs out. */
export function timesUpAction(game: Game): Action | null {
  if (game.phase === 'peek') return { type: 'end-peek' };
  if (game.phase === 'play') return { type: 'skip' };
  if (game.phase === 'round-over') return { type: 'next-round' };
  return null;
}

/** Between rounds: everyone still in has pressed Next. */
export const allReady = (game: Game, ready: readonly boolean[]) => game.out.every((out, seat) => out || ready[seat]);

export interface Outcome {
  places: number[];
  won: boolean[];
  counts: boolean[];
  stats: Card101Stats[];
}

/** Places, wins and points at the end of a game. Players who are out place 0 and earn nothing. */
export function outcomeOf(game: Game): Outcome {
  const live = game.out.map((out) => !out);
  const places = game.totals.map((total, seat) =>
    live[seat] ? 1 + game.totals.filter((t, other) => live[other] && t < total).length : 0,
  );
  const enough = game.results.length >= MIN_ROUNDS_TO_COUNT;
  return {
    places,
    won: game.totals.map((_, seat) => live[seat] && (game.winners ?? []).includes(seat)),
    counts: live.map((stillIn) => stillIn && enough),
    stats: game.totals.map((_, seat) => statsFor(game, seat)),
  };
}
