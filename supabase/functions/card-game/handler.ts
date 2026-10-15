/**
 * The card-game server function: the referee for 101 with classmates.
 *
 * The browser only ever asks: "take from the stack", "swap with my top-left card", "join the
 * game with this code". This works out who's asking from their sign-in token (never from the
 * request), shuffles with secure randomness, runs the shared rules engine (shared/card101),
 * and saves the new game "only if the version is still N", so a double tap can't play twice.
 *
 * Hidden cards: the whole game lives in card_games, which no student can read. Every reply
 * and every live update is one player's seat row, made by `viewFor` and `eventsFor`
 * (shared/card101/view.ts): only what that player may know.
 *
 * Bot games don't come here: they're played in the browser and saved by save-bot-game.
 */
import { makeCode, normaliseCode } from '../../../shared/multiplayer';
import { isSlot } from '../../../shared/card101/cards';
import { newGame, play, RuleError, type Action, type Actor, type Game, type GameEvent, type Settings } from '../../../shared/card101/engine';
import {
  allReady,
  deadlineAfter,
  GRACE_MS,
  isWanted,
  outcomeOf,
  parseSettings,
  seatRows,
  timesUpAction,
  type CardStatus,
  type PublicInfo,
  type SeatRow,
  type SeatWrite,
} from '../../../shared/card101/live';
import type { Card101Stats } from '../../../shared/card101/save';
import type { Dice } from '../../../shared/card101/random';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** One row of the card_games table: the whole game. Never sent to a browser. */
export interface CardGameRow {
  id: string;
  code: string | null;
  in_lobby: boolean;
  host: string | null;
  seat1: string | null;
  seat2: string | null;
  seat3: string | null;
  seat4: string | null;
  wanted: number;
  settings: Settings;
  status: CardStatus;
  game: Game | null;
  ready: boolean[] | null;
  version: number;
  expires_at: string;
  started_at: string | null;
  deadline: string | null;
  last_action_at: string | null;
  finished_at: string | null;
  ending: 'finished' | 'abandoned' | null;
  places: number[] | null;
  won: boolean[] | null;
  out_of_game: boolean[] | null;
  counts: boolean[] | null;
  stats: Card101Stats[] | null;
  rematch_game: string | null;
}

export interface PlayerStatus {
  /** Has a profile and a school account. */
  school: boolean;
  hidden: boolean;
  multiplayerEnabled: boolean;
  createdLastHour: number;
  /** Which of the other players asked about are hidden, or don't exist any more. */
  gone: string[];
}

export type WriteResult = CardGameRow | 'changed' | 'code-taken' | 'already-waiting' | 'failed';

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Milliseconds since 1970, by the server's clock. */
  now(): number;
  /** Secure random numbers from 0 up to (not including) 1, for game codes. */
  random(): number;
  /** Secure dice, for shuffling. */
  dice: Dice;
  /** A new game id. */
  newId(): string;
  userIdFor(token: string): Promise<string | null>;
  playerStatus(player: string, others?: string[]): Promise<PlayerStatus | null>;
  loadGame(id: string): Promise<CardGameRow | null>;
  findWaitingByCode(code: string): Promise<CardGameRow | null>;
  /** True if any game (chess, checkers, space or 101) is waiting with this code. */
  codeTaken(code: string): Promise<boolean>;
  findWaitingHostedBy(player: string): Promise<CardGameRow | null>;
  /**
   * Saves the game and its seat rows together. `expected` null: a new game. Otherwise only
   * if the game is still at that version ('changed' if not).
   */
  write(expected: number | null, row: CardGameRow, seats: SeatWrite[]): Promise<WriteResult>;
}

export const WAITING_GAME_MS = 10 * 60 * 1000;
export const MAX_CREATES_PER_HOUR = 20;
export const MAX_REQUESTS_PER_MINUTE = 60;
export const MAX_CODE_TRIES_PER_MINUTE = 10;

type Problem =
  | 'sign-in'
  | 'bad-request'
  | 'paused'
  | 'hidden'
  | 'not-found'
  | 'not-yours'
  | 'not-started'
  | 'not-host'
  | 'need-players'
  | 'illegal'
  | 'over'
  | 'out'
  | 'changed'
  | 'too-many'
  | 'too-many-codes'
  | 'not-yet'
  | 'full'
  | 'expired'
  | 'rematch-gone'
  | 'failed';

/** What students see. Friendly, and nothing technical. */
const MESSAGES: Record<Problem, [status: number, text: string]> = {
  'sign-in': [401, 'Please sign in again.'],
  'bad-request': [400, 'Something went wrong. Please try again.'],
  paused: [403, 'Your teacher has paused games against friends for now.'],
  hidden: [403, 'Playing friends isn’t available for you right now. Ask your teacher.'],
  'not-found': [404, 'We couldn’t find a game with that code. Check it and try again.'],
  'not-yours': [403, 'That isn’t your game.'],
  'not-started': [409, 'The game hasn’t started yet.'],
  'not-host': [403, 'Only the person who started the game can do that.'],
  'need-players': [409, 'You need at least 2 players to start. Share the code!'],
  illegal: [400, 'You can’t do that right now.'],
  over: [409, 'This game has already finished.'],
  out: [409, 'You’re out of this game.'],
  changed: [409, 'The game changed just then. Have another look.'],
  'too-many': [429, 'Slow down a little! Try again in a minute.'],
  'too-many-codes': [429, 'That’s a lot of codes. Wait a minute, then try again.'],
  'not-yet': [409, 'There’s still time on the clock.'],
  full: [409, 'That game is full, or it has already started.'],
  expired: [410, 'That game stopped waiting. Ask your friend to make a new one.'],
  'rematch-gone': [409, 'That rematch has already started or stopped waiting.'],
  failed: [500, 'Something went wrong. Please try again.'],
};

class Refused {
  constructor(
    readonly problem: Problem,
    readonly extra: { error?: string; secondsLeft?: number } = {},
  ) {}
}

type Body = Record<string, unknown>;

interface Context {
  services: Services;
  limiter: RateLimiter;
  me: string;
  body: Body;
}

/** What an action hands back: the game, and the seat rows that were written for it. */
interface Saved {
  row: CardGameRow;
  seats: SeatWrite[];
}

/** Makes the request handler. Keep one per server, so the rate limits are remembered. */
export function cardGameHandler(services: Services) {
  const limiter = new RateLimiter(() => services.now());

  return async function handle(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get('Origin'));
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    const refuse = (refused: Refused) => {
      const [status, error] = MESSAGES[refused.problem];
      return reply(status, { error, problem: refused.problem, ...refused.extra });
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

    const token = bearerToken(request);
    const me = token ? await services.userIdFor(token) : null;
    if (!me) return refuse(new Refused('sign-in'));
    if (!limiter.allow(me, MAX_REQUESTS_PER_MINUTE)) return refuse(new Refused('too-many'));

    const parsed = await readJsonBody(request);
    const body = typeof parsed === 'object' && parsed !== null ? (parsed as Body) : null;
    const action = ACTIONS[String(body?.action)];
    if (!body || !action) return refuse(new Refused('bad-request'));

    try {
      const saved = await action({ services, limiter, me, body });
      // Only ever my own seat: what I'm allowed to know.
      return reply(200, { seat: mySeat(saved, me) });
    } catch (error) {
      if (error instanceof Refused) {
        // Logs say what went wrong, never who.
        if (!['changed', 'not-yet', 'not-found', 'illegal'].includes(error.problem)) {
          console.warn(`card-game: refused ${String(body.action)} (${error.problem})`);
        }
        return refuse(error);
      }
      console.error(`card-game: ${String(body.action)} failed${error instanceof Error ? ` (${error.message.slice(0, 80)})` : ''}`);
      return refuse(new Refused('failed'));
    }
  };
}

/** My seat row from what was just saved. The log isn't sent back (the page keeps its own). */
function mySeat(saved: Saved, me: string): SeatRow | null {
  const seat = saved.seats.find((s) => s.player === me);
  if (seat) return { ...seat, log: [] };
  // I've just left the waiting room: I have no seat any more, but I'm told how it went.
  const info = publicInfo(saved.row);
  return { game: saved.row.id, player: me, seat: -1, version: info.version, status: info.status, info, view: null, events: [], log: [] };
}

const ACTIONS: Record<string, (c: Context) => Promise<Saved>> = {
  create,
  join,
  cancel: leave,
  leave,
  start,
  'peek-done': (c) => withRetries(c, (row, seat) => playAs(c, row, seat, { type: 'peek-done' })),
  draw: (c) => turn(c, drawAction(c.body)),
  swap: (c) => turn(c, swapAction(c.body)),
  throw: (c) => turn(c, { type: 'throw' }),
  knock: (c) => turn(c, { type: 'knock' }),
  next: (c) => withRetries(c, (row, seat) => readyForNext(c, row, seat)),
  'times-up': timesUp,
  rematch,
};

// ---------------------------------------------------------------------------
// Saving: the game, plus every seat's own view
// ---------------------------------------------------------------------------

const seatsOf = (g: Pick<CardGameRow, 'seat1' | 'seat2' | 'seat3' | 'seat4'>): (string | null)[] => [g.seat1, g.seat2, g.seat3, g.seat4];
const seatPatch = (seats: (string | null)[]) => ({ seat1: seats[0] ?? null, seat2: seats[1] ?? null, seat3: seats[2] ?? null, seat4: seats[3] ?? null });
const iso = (ms: number) => new Date(ms).toISOString();

/** The players by seat: four slots while waiting, exactly one per player once dealt. */
const playersOf = (row: CardGameRow) => (row.game ? seatsOf(row).slice(0, row.game.players) : seatsOf(row));

export function publicInfo(row: CardGameRow): PublicInfo {
  return {
    code: row.status === 'waiting' ? row.code : null,
    inLobby: row.in_lobby,
    host: row.host,
    players: playersOf(row),
    wanted: row.wanted,
    settings: row.settings,
    status: row.status,
    version: row.version,
    expiresAt: row.expires_at,
    deadline: row.deadline,
    ready: row.ready,
    ending: row.ending,
    places: row.places,
    counts: row.counts,
    rematchGame: row.rematch_game,
  };
}

/** Saves a change (the version goes up by one) and every seat row with it. */
async function commit(services: Services, row: CardGameRow, patch: Partial<CardGameRow>, events: GameEvent[] = []): Promise<Saved> {
  const next: CardGameRow = { ...row, ...patch, version: row.version + 1 };
  const seats = seatRows(next.id, publicInfo(next), next.game, events);
  const saved = await services.write(row.version, next, seats);
  if (saved === 'changed') throw new Refused('changed');
  if (typeof saved === 'string') throw new Refused('failed');
  return { row: saved, seats };
}

/** The changes to save after the engine has played. */
function afterPlay(services: Services, row: CardGameRow, game: Game, events: GameEvent[]): Partial<CardGameRow> {
  const now = services.now();
  const patch: Partial<CardGameRow> = { game, last_action_at: iso(now) };
  if (game.phase === 'over') {
    const outcome = outcomeOf(game);
    return {
      ...patch,
      status: 'finished',
      ending: 'finished',
      deadline: null,
      ready: null,
      finished_at: iso(now),
      places: outcome.places,
      won: outcome.won,
      out_of_game: [...game.out],
      counts: outcome.counts,
      stats: outcome.stats,
    };
  }
  const previous = row.deadline ? Date.parse(row.deadline) : null;
  const deadline = deadlineAfter(game, events, now, previous);
  if (events.some((e) => e.kind === 'round-end')) patch.ready = game.out.map(() => false);
  if (events.some((e) => e.kind === 'deal')) patch.ready = null;
  return { ...patch, deadline: deadline === null ? null : iso(deadline) };
}

/** Plays one action with the rules engine. Its messages are written for students. */
function runEngine(services: Services, game: Game, actor: Actor, action: Action): { game: Game; events: GameEvent[] } {
  try {
    return play(game, actor, action, services.dice);
  } catch (error) {
    if (error instanceof RuleError) throw new Refused('illegal', { error: error.message });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Checks shared by the actions
// ---------------------------------------------------------------------------

async function mustBeAllowed(services: Services, player: string, forPlaying: boolean, others: string[] = []): Promise<PlayerStatus> {
  const status = await services.playerStatus(player, others);
  if (!status?.school) throw new Refused('sign-in');
  if (status.hidden) throw new Refused('hidden');
  if (forPlaying && !status.multiplayerEnabled) throw new Refused('paused');
  return status;
}

const gameId = (body: Body) => {
  if (typeof body.gameId !== 'string' || body.gameId.length > 64) throw new Refused('bad-request');
  return body.gameId;
};

async function loadMyGame(services: Services, me: string, id: string): Promise<{ row: CardGameRow; seat: number }> {
  const row = await services.loadGame(id);
  const seat = row ? playersOf(row).indexOf(me) : -1;
  if (!row || seat < 0) throw new Refused('not-yours');
  return { row, seat };
}

function mustBePlaying(row: CardGameRow, seat: number): Game {
  if (row.status === 'waiting') throw new Refused('not-started');
  if (row.status !== 'playing' || !row.game) throw new Refused('over');
  if (row.game.out[seat]) throw new Refused('out');
  return row.game;
}

const otherPlayers = (row: CardGameRow, me: string) => playersOf(row).filter((p): p is string => p !== null && p !== me);

/**
 * Students the teacher has hidden (or who have been deleted) can't keep playing: they're out,
 * the next time anyone in the game does something. Returns the saved game if anything changed.
 */
async function putOutGone(services: Services, row: CardGameRow, status: PlayerStatus): Promise<Saved | null> {
  let game = row.game!;
  const events: GameEvent[] = [];
  playersOf(row).forEach((player, seat) => {
    if (game.phase === 'over' || game.out[seat]) return;
    if (player !== null && !status.gone.includes(player)) return;
    const played = play(game, seat, { type: 'leave' }, () => 1);
    game = played.game;
    events.push(...played.events);
  });
  if (events.length === 0) return null;
  return commit(services, row, afterPlay(services, row, game, events), events);
}

/**
 * Actions anyone may do at any moment (finishing the peek, pressing Next) shouldn't fail just
 * because someone else's tap got there first: load the game again and have another go.
 */
async function withRetries(c: Context, act: (row: CardGameRow, seat: number) => Promise<Saved>): Promise<Saved> {
  const id = gameId(c.body);
  for (let tries = 0; ; tries++) {
    const { row, seat } = await loadMyGame(c.services, c.me, id);
    try {
      return await act(row, seat);
    } catch (error) {
      if (!(error instanceof Refused && error.problem === 'changed') || tries >= 2) throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Waiting room
// ---------------------------------------------------------------------------

async function create({ services, me, body }: Context): Promise<Saved> {
  const settings = parseSettings(body.settings);
  if (!settings || !isWanted(body.players)) throw new Refused('bad-request');
  const status = await mustBeAllowed(services, me, true);
  if (status.createdLastHour >= MAX_CREATES_PER_HOUR) throw new Refused('too-many');
  return newWaitingGame(services, me, body.players, settings, body.lobby === true);
}

async function newWaitingGame(services: Services, me: string, wanted: number, settings: Settings, inLobby: boolean): Promise<Saved> {
  // One waiting game each: a new one replaces the old one.
  const waiting = await services.findWaitingHostedBy(me);
  if (waiting) await commit(services, waiting, { status: 'cancelled' }).catch(() => null);
  for (let tries = 0; tries < 5; tries++) {
    const code = makeCode(() => services.random());
    if (await services.codeTaken(code)) continue;
    const row: CardGameRow = {
      id: services.newId(),
      code,
      in_lobby: inLobby,
      host: me,
      ...seatPatch([me]),
      wanted,
      settings,
      status: 'waiting',
      game: null,
      ready: null,
      version: 0,
      expires_at: iso(services.now() + WAITING_GAME_MS),
      started_at: null,
      deadline: null,
      last_action_at: null,
      finished_at: null,
      ending: null,
      places: null,
      won: null,
      out_of_game: null,
      counts: null,
      stats: null,
      rematch_game: null,
    };
    const seats = seatRows(row.id, publicInfo(row), null, []);
    const inserted = await services.write(null, row, seats);
    if (inserted === 'code-taken') continue;
    if (inserted === 'already-waiting' || inserted === 'changed') throw new Refused('changed');
    if (inserted === 'failed') throw new Refused('failed');
    return { row: inserted, seats };
  }
  throw new Refused('failed');
}

async function join({ services, limiter, me, body }: Context): Promise<Saved> {
  let row: CardGameRow | null;
  if (body.code !== undefined) {
    if (!limiter.allow(`code:${me}`, MAX_CODE_TRIES_PER_MINUTE)) throw new Refused('too-many-codes');
    const code = normaliseCode(body.code);
    row = code ? await services.findWaitingByCode(code) : null;
    if (!row) throw new Refused('not-found');
  } else {
    row = await services.loadGame(gameId(body));
    // From the lobby: only games posted there can be joined without the code.
    if (!row || !row.in_lobby) throw new Refused('not-found');
  }
  await mustBeAllowed(services, me, true);
  return joinWaiting(services, me, row);
}

/** Takes the first empty seat in a waiting game, and starts it if that fills it. */
async function joinWaiting(services: Services, me: string, first: CardGameRow): Promise<Saved> {
  let row: CardGameRow | null = first;
  for (let tries = 0; tries < 4 && row; tries++) {
    if (playersOf(row).includes(me)) return { row, seats: seatRows(row.id, publicInfo(row), row.game, []) };
    if (row.status === 'playing' || row.status === 'finished') throw new Refused('full');
    if (row.status !== 'waiting' || Date.parse(row.expires_at) <= services.now()) throw new Refused('expired');
    // The host might have been hidden since they made it. Don't say so, just don't let anyone in.
    const host = row.host && (await services.playerStatus(row.host));
    if (!host || !host.school || host.hidden) throw new Refused('expired');
    const seats = seatsOf(row);
    const empty = seats.indexOf(null);
    if (empty < 0 || empty >= row.wanted) throw new Refused('full');
    seats[empty] = me;
    try {
      if (seats.filter(Boolean).length === row.wanted) return await startGame(services, row, seats as string[], seatPatch(seats));
      return await commit(services, row, seatPatch(seats));
    } catch (error) {
      if (!(error instanceof Refused && error.problem === 'changed')) throw error;
    }
    // Someone else joined at the same moment: look again.
    row = await services.loadGame(row.id);
  }
  throw new Refused('changed');
}

/** Deals the first round. Players keep their waiting-room seats; the engine picks who starts. */
async function startGame(services: Services, row: CardGameRow, seats: (string | null)[], extra: Partial<CardGameRow> = {}): Promise<Saved> {
  const players = seats.filter((p): p is string => p !== null);
  const { game, events } = newGame(players.length, row.settings, services.dice);
  const now = services.now();
  const started: CardGameRow = { ...row, ...extra, ...seatPatch(players), status: 'playing', started_at: iso(now), code: null };
  return commit(services, row, { ...started, ...afterPlay(services, { ...started, deadline: null }, game, events) }, events);
}

async function leave({ services, me, body }: Context): Promise<Saved> {
  const id = gameId(body);
  for (let tries = 0; ; tries++) {
    const { row, seat } = await loadMyGame(services, me, id);
    try {
      if (row.status === 'waiting') {
        if (row.host === me) return await commit(services, row, { status: 'cancelled' });
        return await commit(services, row, seatPatch(seatsOf(row).filter((p) => p !== me)));
      }
      if (row.status !== 'playing' || !row.game || row.game.out[seat]) return { row, seats: seatRows(row.id, publicInfo(row), row.game, []) };
      // Leaving part-way: you're out, and the game goes on for everyone else (or ends, if only one is left).
      const played = runEngine(services, row.game, seat, { type: 'leave' });
      return await commit(services, row, afterPlay(services, row, played.game, played.events), played.events);
    } catch (error) {
      if (!(error instanceof Refused && error.problem === 'changed') || tries >= 2) throw error;
    }
  }
}

/** The host starts early, with at least 2 players. (A full game starts by itself.) */
async function start({ services, me, body }: Context): Promise<Saved> {
  const { row } = await loadMyGame(services, me, gameId(body));
  if (row.host !== me) throw new Refused('not-host');
  if (row.status === 'playing') return { row, seats: seatRows(row.id, publicInfo(row), row.game, []) }; // a second tap
  if (row.status !== 'waiting') throw new Refused('over');
  const status = await mustBeAllowed(services, me, true, otherPlayers(row, me));
  // Anyone hidden since they joined is quietly left out.
  const players = seatsOf(row).filter((p): p is string => p !== null && !status.gone.includes(p));
  if (players.length < 2) throw new Refused('need-players');
  return startGame(services, row, players);
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

function drawAction(body: Body): Action | null {
  return body.from === 'stack' || body.from === 'discard' ? { type: 'draw', from: body.from } : null;
}

function swapAction(body: Body): Action | null {
  return isSlot(body.slot) ? { type: 'swap', slot: body.slot } : null;
}

/** Plays an action for a seat, after putting out anyone who's gone. */
async function playAs(c: Context, row: CardGameRow, seat: number, action: Action): Promise<Saved> {
  const game = mustBePlaying(row, seat);
  const status = await mustBeAllowed(c.services, c.me, true, otherPlayers(row, c.me));
  const after = await putOutGone(c.services, row, status);
  if (after) throw new Refused('changed');
  const played = runEngine(c.services, game, seat, action);
  return commit(c.services, row, afterPlay(c.services, row, played.game, played.events), played.events);
}

/** A move on your own turn. The page says which version it's looking at, so a double tap can't play twice. */
async function turn(c: Context, action: Action | null): Promise<Saved> {
  if (!action) throw new Refused('bad-request');
  const { row, seat } = await loadMyGame(c.services, c.me, gameId(c.body));
  mustBePlaying(row, seat);
  if (c.body.version !== row.version) throw new Refused('changed');
  return playAs(c, row, seat, action);
}

/** Between rounds: I've seen the scores. When everyone still in has pressed Next, deal. */
async function readyForNext(c: Context, row: CardGameRow, seat: number): Promise<Saved> {
  const game = mustBePlaying(row, seat);
  if (game.phase !== 'round-over') throw new Refused('changed');
  await mustBeAllowed(c.services, c.me, true);
  const ready = (row.ready ?? game.out.map(() => false)).map((r, s) => r || s === seat);
  if (!allReady(game, ready)) {
    if (row.ready?.[seat]) return { row, seats: seatRows(row.id, publicInfo(row), game, []) };
    return commit(c.services, row, { ready });
  }
  const played = runEngine(c.services, game, 'system', { type: 'next-round' });
  return commit(c.services, row, afterPlay(c.services, row, played.game, played.events), played.events);
}

/**
 * The clock ran out: the peek ends, a turn is skipped, or the next round is dealt. Any
 * player's page can ask (server functions can't wake themselves up); the server checks the
 * clock itself, so nobody can hurry anyone.
 */
async function timesUp({ services, me, body }: Context): Promise<Saved> {
  const { row } = await loadMyGame(services, me, gameId(body));
  if (row.status !== 'playing' || !row.game) throw new Refused('over');
  const status = await mustBeAllowed(services, me, true, otherPlayers(row, me));
  const after = await putOutGone(services, row, status);
  if (after) return after;
  const left = Date.parse(row.deadline ?? '') + GRACE_MS - services.now();
  if (!(left <= 0)) throw new Refused('not-yet', { secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1000) : 60 });
  const action = timesUpAction(row.game);
  if (!action) throw new Refused('over');
  const played = runEngine(services, row.game, 'system', action);
  return commit(services, row, afterPlay(services, row, played.game, played.events), played.events);
}

// ---------------------------------------------------------------------------
// After the game
// ---------------------------------------------------------------------------

/**
 * The first to press Rematch starts a new waiting game (same size and length) linked to this
 * one. Everyone else's Rematch joins it, and it starts by itself when everyone is in.
 */
async function rematch(context: Context, tries = 0): Promise<Saved> {
  const { services, me, body } = context;
  const { row } = await loadMyGame(services, me, gameId(body));
  if (row.status !== 'finished') throw new Refused('bad-request');
  await mustBeAllowed(services, me, true);
  if (row.rematch_game) {
    const next = await services.loadGame(row.rematch_game);
    if (!next) throw new Refused('rematch-gone');
    if (playersOf(next).includes(me)) return { row: next, seats: seatRows(next.id, publicInfo(next), next.game, []) };
    if (next.status !== 'waiting') throw new Refused('rematch-gone');
    return joinWaiting(services, me, next);
  }
  const wanted = Math.max(2, playersOf(row).filter(Boolean).length);
  const next = await newWaitingGame(services, me, wanted, row.settings, false);
  try {
    await commit(services, row, { rematch_game: next.row.id });
    return next;
  } catch (error) {
    if (!(error instanceof Refused && error.problem === 'changed')) throw error;
  }
  // Someone else's Rematch got there first: drop this one and join theirs.
  await commit(services, next.row, { status: 'cancelled' }).catch(() => null);
  if (tries >= 2) throw new Refused('changed');
  return rematch(context, tries + 1);
}
