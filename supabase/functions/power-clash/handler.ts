/**
 * The Power Clash server function: the referee for Power Clash with a classmate.
 *
 * The browser only ever asks: "place on square 4", "use Freeze Ray on 7", "press Next", "join
 * the game with this code". This works out who's asking from their sign-in token (never from
 * the request), checks it's their turn, runs the shared rules engine (shared/power-clash) and
 * saves the new state "only if the version is still N", so a double tap can't play twice.
 *
 * Nothing is hidden in this game, so there is one table and one row per game: both players
 * read the whole row (the database lets only them read it) and Realtime sends them each change.
 * Each player picks their three powers in the waiting room; the match starts the moment both
 * have, and the powers can't change once it has.
 *
 * Bot games don't come here: they're played in the browser and saved by save-bot-game.
 */
import { makeCode, normaliseCode } from '../../../shared/multiplayer';
import { POWER_IDS } from '../../../shared/power-clash/engine';
import {
  deadlineAfter,
  GRACE_MS,
  isLiveGame,
  LiveRuleError,
  matchIsOver,
  newLiveGame,
  outcomeOf,
  parseLoadout,
  playerAction,
  pressNext,
  roundIsOver,
  timeOut,
  TURN_MS,
  turnSeat,
  type LiveGame,
} from '../../../shared/power-clash/live';
import type { Action, GameEvent, PowerId } from '../../../shared/power-clash/types';
import type { PowerClashStats } from '../../../shared/power-clash/solo';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** One row of the power_games table. */
export interface PowerGameRow {
  id: string;
  code: string | null;
  in_lobby: boolean;
  host: string | null;
  seat1: string | null;
  seat2: string | null;
  first_player: string | null;
  loadouts: [PowerId[] | null, PowerId[] | null];
  status: 'waiting' | 'playing' | 'finished' | 'cancelled' | 'expired';
  game: LiveGame | null;
  events: GameEvent[];
  version: number;
  created_at: string;
  expires_at: string;
  started_at: string | null;
  deadline: string | null;
  last_action_at: string | null;
  finished_at: string | null;
  ending: 'finished' | 'abandoned' | null;
  leaver: string | null;
  won: boolean[] | null;
  counts: boolean[] | null;
  stats: PowerClashStats[] | null;
  rematch_game: string | null;
}

/** What a new game needs from the server; the database fills in the rest. */
export type NewPowerGame = Pick<PowerGameRow, 'code' | 'in_lobby' | 'host' | 'seat1' | 'status' | 'expires_at' | 'first_player' | 'loadouts'>;

export interface PlayerStatus {
  /** Has a profile and a school account. */
  school: boolean;
  hidden: boolean;
  multiplayerEnabled: boolean;
  createdLastHour: number;
  /** Which school the player belongs to. A game is only ever shared inside one school. */
  schoolId: number | null;
  /** Which of the other players asked about are hidden, or don't exist any more. */
  gone: string[];
}

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Milliseconds since 1970, by the server's clock. */
  now(): number;
  /** Secure random numbers from 0 up to (not including) 1: game codes, and who plays X. */
  random(): number;
  userIdFor(token: string): Promise<string | null>;
  playerStatus(player: string, others?: string[]): Promise<PlayerStatus | null>;
  loadGame(id: string): Promise<PowerGameRow | null>;
  findWaitingByCode(code: string): Promise<PowerGameRow | null>;
  /** True if any game (chess, checkers, space, 101 or Power Clash) is waiting with this code. */
  codeTaken(code: string): Promise<boolean>;
  findWaitingHostedBy(player: string): Promise<PowerGameRow | null>;
  insertGame(row: NewPowerGame): Promise<PowerGameRow | 'code-taken' | 'already-waiting' | 'failed'>;
  /** Saves the change only if the game is still at `version`. Null if it had changed. */
  updateGame(id: string, version: number, patch: Partial<PowerGameRow>): Promise<PowerGameRow | null>;
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
  | 'started'
  | 'not-your-turn'
  | 'illegal'
  | 'over'
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
  started: [409, 'The match has already started, so the powers can’t change now.'],
  'not-your-turn': [409, 'It’s not your turn yet.'],
  illegal: [400, 'You can’t do that right now.'],
  over: [409, 'This game has already finished.'],
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

/** Makes the request handler. Keep one per server, so the rate limits are remembered. */
export function powerClashHandler(services: Services) {
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
      const game = await action({ services, limiter, me, body });
      return reply(200, { game });
    } catch (error) {
      if (error instanceof Refused) {
        // Logs say what went wrong, never who.
        if (!['not-your-turn', 'changed', 'not-yet', 'not-found', 'illegal'].includes(error.problem)) {
          console.warn(`power-clash: refused ${String(body.action)} (${error.problem})`);
        }
        return refuse(error);
      }
      console.error(`power-clash: ${String(body.action)} failed${error instanceof Error ? ` (${error.message.slice(0, 80)})` : ''}`);
      return refuse(new Refused('failed'));
    }
  };
}

const ACTIONS: Record<string, (c: Context) => Promise<PowerGameRow>> = {
  create,
  join,
  cancel: leave,
  leave,
  'set-powers': setPowers,
  place: (c) => playerTurn(c, placeAction(c.body)),
  'use-power': (c) => playerTurn(c, powerAction(c.body)),
  skip: (c) => playerTurn(c, { type: 'skip' }),
  next,
  'times-up': timesUp,
  rematch,
};

// ---------------------------------------------------------------------------
// Checks shared by the actions
// ---------------------------------------------------------------------------

const seatsOf = (g: Pick<PowerGameRow, 'seat1' | 'seat2'>): (string | null)[] => [g.seat1, g.seat2];
const iso = (ms: number) => new Date(ms).toISOString();

async function mustBeAllowed(services: Services, player: string, forPlaying: boolean, others: string[] = []): Promise<PlayerStatus> {
  const status = await services.playerStatus(player, others);
  if (!status?.school) throw new Refused('sign-in');
  if (status.hidden) throw new Refused('hidden');
  if (forPlaying && !status.multiplayerEnabled) throw new Refused('paused');
  return status;
}

async function loadMyGame(services: Services, me: string, id: unknown): Promise<{ game: PowerGameRow; seat: number }> {
  if (typeof id !== 'string' || id.length > 64) throw new Refused('bad-request');
  const game = await services.loadGame(id);
  const seat = game ? seatsOf(game).indexOf(me) : -1;
  if (!game || seat < 0) throw new Refused('not-yours');
  return { game, seat };
}

function mustBePlaying(row: PowerGameRow): LiveGame {
  if (row.status === 'waiting') throw new Refused('not-started');
  if (row.status !== 'playing' || !isLiveGame(row.game)) throw new Refused('over');
  return row.game;
}

async function save(services: Services, row: PowerGameRow, patch: Partial<PowerGameRow>): Promise<PowerGameRow> {
  const saved = await services.updateGame(row.id, row.version, { ...patch, version: row.version + 1 });
  if (!saved) throw new Refused('changed');
  return saved;
}

/** Plays the rules engine's step; its messages are written for students. */
function rules<T>(step: () => T): T {
  try {
    return step();
  } catch (error) {
    if (error instanceof LiveRuleError) throw new Refused('illegal', { error: error.message });
    throw error;
  }
}

/** The changes to save after the engine has played. `real` is a move or button press (not a time-out). */
function afterPlay(services: Services, row: PowerGameRow, game: LiveGame, events: GameEvent[], opts: { real: boolean; restart?: boolean }): Partial<PowerGameRow> {
  const now = services.now();
  const patch: Partial<PowerGameRow> = { game, events, ...(opts.real ? { last_action_at: iso(now) } : {}) };
  if (matchIsOver(game)) {
    const outcome = outcomeOf(game, 'finished');
    return {
      ...patch,
      status: 'finished',
      ending: 'finished',
      deadline: null,
      finished_at: iso(now),
      won: outcome.won,
      counts: outcome.counts,
      stats: outcome.stats,
    };
  }
  const previous = row.deadline ? Date.parse(row.deadline) : null;
  const deadline = deadlineAfter(game, events, now, previous, opts.restart ?? true);
  return { ...patch, deadline: deadline === null ? null : iso(deadline) };
}

/** The game ends as abandoned: nobody earns anything, and the other player is told who left. */
function abandonedPatch(services: Services, game: LiveGame, leaver: string | null): Partial<PowerGameRow> {
  const outcome = outcomeOf(game, 'abandoned');
  return {
    game,
    events: [],
    status: 'finished',
    ending: 'abandoned',
    leaver,
    deadline: null,
    finished_at: iso(services.now()),
    won: outcome.won,
    counts: outcome.counts,
    stats: outcome.stats,
  };
}

/**
 * A student the teacher has hidden (or who has been deleted) can't keep playing: the game
 * ends as abandoned the next time the other player does something. Returns the saved game if so.
 */
async function endIfGone(services: Services, row: PowerGameRow, me: string): Promise<PowerGameRow | null> {
  const others = seatsOf(row).filter((p): p is string => p !== null && p !== me);
  const status = await mustBeAllowed(services, me, true, others);
  const empty = seatsOf(row).some((p) => p === null);
  const gone = seatsOf(row).find((p) => p !== null && status.gone.includes(p)) ?? null;
  if (!empty && gone === null) return null;
  if (!isLiveGame(row.game)) return null;
  return save(services, row, abandonedPatch(services, row.game, gone));
}

// ---------------------------------------------------------------------------
// Waiting room
// ---------------------------------------------------------------------------

async function create({ services, me, body }: Context): Promise<PowerGameRow> {
  const status = await mustBeAllowed(services, me, true);
  if (status.createdLastHour >= MAX_CREATES_PER_HOUR) throw new Refused('too-many');
  return newWaitingGame(services, me, body.lobby === true, null, null);
}

async function newWaitingGame(
  services: Services,
  me: string,
  inLobby: boolean,
  firstPlayer: string | null,
  myPowers: PowerId[] | null,
): Promise<PowerGameRow> {
  // One waiting game each: a new one replaces the old one.
  const waiting = await services.findWaitingHostedBy(me);
  if (waiting) await services.updateGame(waiting.id, waiting.version, { status: 'cancelled', version: waiting.version + 1, events: [] });
  for (let tries = 0; tries < 5; tries++) {
    const code = makeCode(() => services.random());
    if (await services.codeTaken(code)) continue;
    const inserted = await services.insertGame({
      code,
      in_lobby: inLobby,
      host: me,
      seat1: me,
      status: 'waiting',
      expires_at: iso(services.now() + WAITING_GAME_MS),
      first_player: firstPlayer,
      loadouts: [myPowers, null],
    });
    if (inserted === 'code-taken') continue;
    if (inserted === 'already-waiting') throw new Refused('changed');
    if (inserted === 'failed') throw new Refused('failed');
    return inserted;
  }
  throw new Refused('failed');
}

async function join({ services, limiter, me, body }: Context): Promise<PowerGameRow> {
  let row: PowerGameRow | null;
  if (body.code !== undefined) {
    if (!limiter.allow(`code:${me}`, MAX_CODE_TRIES_PER_MINUTE)) throw new Refused('too-many-codes');
    const code = normaliseCode(body.code);
    row = code ? await services.findWaitingByCode(code) : null;
    if (!row) throw new Refused('not-found');
  } else {
    if (typeof body.gameId !== 'string' || body.gameId.length > 64) throw new Refused('bad-request');
    row = await services.loadGame(body.gameId);
    // From the lobby: only games posted there can be joined without the code.
    if (!row || !row.in_lobby) throw new Refused('not-found');
  }
  const status = await mustBeAllowed(services, me, true);
  await mustBeSameSchool(services, status, row.host);
  return joinWaiting(services, me, row, null);
}

/** A game made at another school looks exactly like a code that doesn't exist: nothing is shared between schools. */
async function mustBeSameSchool(services: Services, me: PlayerStatus, host: string | null): Promise<void> {
  const theirs = host ? await services.playerStatus(host) : null;
  if (theirs && theirs.schoolId !== me.schoolId) throw new Refused('not-found');
}

/**
 * Takes the empty seat in a waiting game. Already in it? Then that's fine. `powers` are the
 * joiner's powers if they already have some (a rematch keeps last game's), which starts the
 * match straight away if the host has theirs too.
 */
async function joinWaiting(services: Services, me: string, first: PowerGameRow, powers: PowerId[] | null): Promise<PowerGameRow> {
  let row: PowerGameRow | null = first;
  for (let tries = 0; tries < 4 && row; tries++) {
    if (seatsOf(row).includes(me)) return row;
    if (row.status === 'playing' || row.status === 'finished') throw new Refused('full');
    if (row.status !== 'waiting' || Date.parse(row.expires_at) <= services.now()) throw new Refused('expired');
    // The host might have been hidden since they made it. Don't say so, just don't let anyone in.
    const host = row.host && (await services.playerStatus(row.host));
    if (!host || !host.school || host.hidden) throw new Refused('expired');
    if (row.seat2 !== null) throw new Refused('full');
    const loadouts: PowerGameRow['loadouts'] = [row.loadouts[0], powers];
    const joined: PowerGameRow = { ...row, seat2: me, loadouts };
    try {
      if (loadouts[0] && loadouts[1]) return await startMatch(services, row, joined);
      return await save(services, row, { seat2: me, loadouts });
    } catch (error) {
      if (!(error instanceof Refused && error.problem === 'changed')) throw error;
    }
    // Someone else joined at the same moment: look again.
    row = await services.loadGame(row.id);
  }
  throw new Refused('changed');
}

/** Both players have their powers: deal the first round. Last game's O (if any) plays X; otherwise it's a coin toss. */
async function startMatch(services: Services, row: PowerGameRow, ready: PowerGameRow): Promise<PowerGameRow> {
  const [a, b] = [ready.seat1!, ready.seat2!];
  const [loadA, loadB] = [ready.loadouts[0]!, ready.loadouts[1]!];
  const aPlaysX = ready.first_player === a ? true : ready.first_player === b ? false : services.random() < 0.5;
  const [x, o] = aPlaysX ? [a, b] : [b, a];
  const [powersX, powersO] = aPlaysX ? [loadA, loadB] : [loadB, loadA];
  const game = newLiveGame(powersX, powersO);
  const now = services.now();
  return save(services, row, {
    seat1: x,
    seat2: o,
    loadouts: [powersX, powersO],
    status: 'playing',
    code: null,
    game,
    events: [],
    started_at: iso(now),
    last_action_at: iso(now),
    deadline: iso(now + TURN_MS),
  });
}

async function leave({ services, me, body }: Context): Promise<PowerGameRow> {
  for (let tries = 0; ; tries++) {
    const { game: row } = await loadMyGame(services, me, body.gameId);
    try {
      if (row.status === 'waiting') {
        if (row.host === me) return await save(services, row, { status: 'cancelled', events: [] });
        return await save(services, row, { seat2: null, loadouts: [row.loadouts[0], null] });
      }
      if (row.status !== 'playing' || !isLiveGame(row.game)) return row;
      // Leaving part-way: the game ends, nobody earns anything, and the other player is told.
      return await save(services, row, abandonedPatch(services, row.game, me));
    } catch (error) {
      if (!(error instanceof Refused && error.problem === 'changed') || tries >= 2) throw error;
    }
  }
}

/** Picks (or changes) my three powers, until the match starts. It starts when both have picked. */
async function setPowers({ services, me, body }: Context): Promise<PowerGameRow> {
  const powers = parseLoadout(body.powers);
  if (!powers) throw new Refused('bad-request');
  for (let tries = 0; ; tries++) {
    const { game: row, seat } = await loadMyGame(services, me, body.gameId);
    if (row.status === 'playing') throw new Refused('started');
    if (row.status !== 'waiting') throw new Refused('over');
    await mustBeAllowed(services, me, true);
    const loadouts: PowerGameRow['loadouts'] = seat === 0 ? [powers, row.loadouts[1]] : [row.loadouts[0], powers];
    try {
      if (row.seat1 && row.seat2 && loadouts[0] && loadouts[1]) {
        return await startMatch(services, row, { ...row, loadouts });
      }
      return await save(services, row, { loadouts });
    } catch (error) {
      if (!(error instanceof Refused && error.problem === 'changed') || tries >= 2) throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

const square = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 8;

function placeAction(body: Body): Action | null {
  return square(body.square) ? { type: 'place', square: body.square } : null;
}

function powerAction(body: Body): Action | null {
  const power = body.power;
  if (!POWER_IDS.includes(power as PowerId)) return null;
  const targets = body.targets ?? [];
  if (!Array.isArray(targets) || targets.length > 2 || !targets.every(square)) return null;
  return { type: 'use-power', power: power as PowerId, targets: targets as number[] };
}

/** A move on your own turn. The page says which version it's looking at, so a double tap can't play twice. */
async function playerTurn({ services, me, body }: Context, action: Action | null): Promise<PowerGameRow> {
  if (!action) throw new Refused('bad-request');
  const { game: row, seat } = await loadMyGame(services, me, body.gameId);
  const game = mustBePlaying(row);
  if (body.version !== row.version) throw new Refused('changed');
  if (await endIfGone(services, row, me)) throw new Refused('changed');
  if (!roundIsOver(game) && !matchIsOver(game) && turnSeat(game) !== seat) throw new Refused('not-your-turn');
  const played = rules(() => playerAction(game, seat, action, () => services.random()));
  return save(services, row, afterPlay(services, row, played.game, played.events, { real: true }));
}

/**
 * Between rounds: I've seen the result. When both players have pressed Next, the next round
 * starts. If the round it names has already moved on (or the match is over), this just hands
 * back the game as it is, so a late tap does nothing.
 */
async function next({ services, me, body }: Context): Promise<PowerGameRow> {
  for (let tries = 0; ; tries++) {
    const { game: row, seat } = await loadMyGame(services, me, body.gameId);
    const game = mustBePlaying(row);
    if (!roundIsOver(game) || matchIsOver(game) || (body.round !== undefined && body.round !== game.match.round)) return row;
    if (await endIfGone(services, row, me)) throw new Refused('changed');
    try {
      const pressed = rules(() => pressNext(game, seat));
      if (game.ready[seat] && !pressed.advanced) return row;
      return await save(services, row, afterPlay(services, row, pressed.game, pressed.events, { real: true, restart: pressed.advanced }));
    } catch (error) {
      if (!(error instanceof Refused && error.problem === 'changed') || tries >= 2) throw error;
    }
  }
}

/**
 * The clock ran out: a turn is skipped (never a loss by itself), or the next round starts.
 * Any player's page can ask (server functions can't wake themselves up); the server checks
 * the clock itself, so nobody can hurry anyone. Three missed turns in a row end the game.
 */
async function timesUp({ services, me, body }: Context): Promise<PowerGameRow> {
  const { game: row } = await loadMyGame(services, me, body.gameId);
  const game = mustBePlaying(row);
  const after = await endIfGone(services, row, me);
  if (after) return after;
  const left = Date.parse(row.deadline ?? '') + GRACE_MS - services.now();
  if (!(left <= 0)) throw new Refused('not-yet', { secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1000) : 60 });
  const out = rules(() => timeOut(game, () => services.random()));
  if (out.abandoned) {
    const leaver = out.seat === null ? null : (seatsOf(row)[out.seat] ?? null);
    return save(services, row, abandonedPatch(services, out.game, leaver));
  }
  return save(services, row, afterPlay(services, row, out.game, out.events, { real: false }));
}

// ---------------------------------------------------------------------------
// After the game
// ---------------------------------------------------------------------------

/**
 * The first to press Rematch starts a new waiting game linked to this one, with the same
 * powers, and last game's O plays X (so the other player starts). The other player's Rematch
 * joins it, and the match starts straight away.
 */
async function rematch(context: Context, tries = 0): Promise<PowerGameRow> {
  const { services, me, body } = context;
  const { game: row, seat } = await loadMyGame(services, me, body.gameId);
  if (row.status !== 'finished') throw new Refused('bad-request');
  await mustBeAllowed(services, me, true);
  const mine = row.loadouts[seat];
  if (row.rematch_game) {
    const nextGame = await services.loadGame(row.rematch_game);
    if (!nextGame) throw new Refused('rematch-gone');
    if (seatsOf(nextGame).includes(me)) return nextGame;
    if (nextGame.status !== 'waiting') throw new Refused('rematch-gone');
    return joinWaiting(services, me, nextGame, mine);
  }
  const nextGame = await newWaitingGame(services, me, false, row.seat2, mine);
  const linked = await services.updateGame(row.id, row.version, { rematch_game: nextGame.id, version: row.version + 1, events: [] });
  if (linked) return nextGame;
  // Someone else's Rematch got there first: drop this one and join theirs.
  await services.updateGame(nextGame.id, nextGame.version, { status: 'cancelled', version: nextGame.version + 1 });
  if (tries >= 2) throw new Refused('changed');
  return rematch(context, tries + 1);
}
