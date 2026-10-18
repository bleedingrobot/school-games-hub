/**
 * The multiplayer server function: the referee for games between two students.
 *
 * The browser only ever *asks*: "make this move", "I resign", "join the game with this
 * code". This works out who's asking from their sign-in token (never from the request),
 * checks it against the rules in shared/multiplayer.ts, and only then saves the change.
 *
 * Every save says "only if the game's version is still N". If two requests arrive at
 * once, the database lets one through and the other is refused, so there are no double
 * moves and nothing sneaks in after a game has ended.
 */
import {
  checkMove,
  CLAIM_WIN_AFTER_MS,
  countsForPoints,
  drawOfferBlock,
  isGameKind,
  makeCode,
  MOVES_BETWEEN_DRAW_OFFERS,
  normaliseCode,
  otherSide,
  replayGame,
  type GameKind,
  type Side,
} from '../../../shared/multiplayer';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';

/** One row of the mp_games table. */
export interface GameRow {
  id: string;
  game: GameKind;
  code: string | null;
  in_lobby: boolean;
  created_by: string | null;
  first_player: string | null;
  second_player: string | null;
  status: 'waiting' | 'playing' | 'finished' | 'cancelled' | 'expired';
  moves: string[];
  version: number;
  created_at: string;
  expires_at: string;
  started_at: string | null;
  turn_started_at: string | null;
  draw_offer: Side | null;
  first_draw_offers: number;
  second_draw_offers: number;
  first_offer_ply: number | null;
  second_offer_ply: number | null;
  winner: Side | null;
  reason: string | null;
  counts_for_points: boolean | null;
  finished_at: string | null;
  first_wants_rematch: boolean;
  second_wants_rematch: boolean;
  rematch_game: string | null;
}

export type NewGame = Pick<GameRow, 'game' | 'code' | 'in_lobby' | 'created_by' | 'first_player' | 'second_player' | 'status' | 'expires_at'> &
  Partial<Pick<GameRow, 'started_at' | 'turn_started_at'>>;

export interface PlayerStatus {
  /** Has a profile and a school account. */
  school: boolean;
  hidden: boolean;
  multiplayerEnabled: boolean;
  createdLastHour: number;
  /** Which school the player belongs to. A game is only ever shared inside one school. */
  schoolId: number | null;
}

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Milliseconds since 1970, by the server's clock. Tests use a fake clock. */
  now(): number;
  random(): number;
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  playerStatus(player: string): Promise<PlayerStatus | null>;
  loadGame(id: string): Promise<GameRow | null>;
  findWaitingByCode(code: string): Promise<GameRow | null>;
  findWaitingCreatedBy(player: string): Promise<GameRow | null>;
  /** 'code-taken' if another waiting game has that code; 'already-waiting' if the creator already has one. */
  insertGame(row: NewGame): Promise<GameRow | 'code-taken' | 'already-waiting' | 'failed'>;
  /** Saves the change only if the game is still at `version`. Null if it had changed (or the save failed). */
  updateGame(id: string, version: number, patch: Partial<GameRow>): Promise<GameRow | null>;
}

/** Waiting games disappear after this long if nobody joins. */
export const WAITING_GAME_MS = 10 * 60 * 1000;
/** Most games a student can start in an hour. */
export const MAX_CREATES_PER_HOUR = 20;
/** Requests one student can send in a minute, and wrong codes they can try. */
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
  | 'not-your-turn'
  | 'illegal'
  | 'over'
  | 'changed'
  | 'too-many'
  | 'too-many-codes'
  | 'not-yet'
  | 'own-game'
  | 'full'
  | 'expired'
  | 'no-offer'
  | 'draw-limit'
  | 'draw-wait'
  | 'no-opponent'
  | 'failed';

/** What students see. Friendly, and nothing technical. */
const MESSAGES: Record<Problem, [status: number, text: string]> = {
  'sign-in': [401, 'Please sign in again.'],
  'bad-request': [400, 'Something went wrong. Please try again.'],
  paused: [403, 'Your teacher has paused games against friends for now.'],
  hidden: [403, 'Playing friends isn’t available for you right now. Ask your teacher.'],
  'not-found': [404, 'We couldn’t find a game with that code. Check it and try again.'],
  'not-yours': [403, 'That isn’t your game.'],
  'not-started': [409, 'Your friend hasn’t joined yet.'],
  'not-your-turn': [409, 'It’s not your turn yet.'],
  illegal: [400, 'That move isn’t allowed.'],
  over: [409, 'This game has already finished.'],
  changed: [409, 'The game changed just then. Have another look.'],
  'too-many': [429, 'Slow down a little! Try again in a minute.'],
  'too-many-codes': [429, 'That’s a lot of codes. Wait a minute, then try again.'],
  'not-yet': [409, 'You can claim the win once they’ve had 2 minutes.'],
  'own-game': [409, 'That’s your own game! Give the code to a friend.'],
  full: [409, 'Someone else has already joined that game.'],
  expired: [410, 'That game stopped waiting. Ask your friend to make a new one.'],
  'no-offer': [409, 'There’s no draw offer to answer.'],
  'draw-limit': [409, 'You’ve offered all the draws you can in this game.'],
  'draw-wait': [409, `Make ${MOVES_BETWEEN_DRAW_OFFERS} more moves before offering another draw.`],
  'no-opponent': [409, 'Your opponent can’t play a rematch right now.'],
  failed: [500, 'Something went wrong. Please try again.'],
};

class Refused {
  constructor(
    readonly problem: Problem,
    readonly extra: object = {},
  ) {}
}

/** Counts requests per student in this server's memory. A soft limit: each server copy counts separately. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private now: () => number) {}
  /** Records a request and says whether it's within `limit` per minute. */
  allow(key: string, limit: number): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.hits.clear();
    return true;
  }
}

type Body = Record<string, unknown>;

/** Makes the request handler. Keep one per server, so the rate limits are remembered. */
export function multiplayerHandler(services: Services) {
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
        if (!['not-your-turn', 'changed', 'not-yet', 'not-found'].includes(error.problem)) {
          console.warn(`multiplayer: refused ${String(body.action)} (${error.problem})`);
        }
        return refuse(error);
      }
      console.error(`multiplayer: ${String(body.action)} failed`);
      return refuse(new Refused('failed'));
    }
  };
}

interface Context {
  services: Services;
  limiter: RateLimiter;
  me: string;
  body: Body;
}

const ACTIONS: Record<string, (c: Context) => Promise<GameRow>> = {
  create,
  join,
  cancel,
  move,
  resign,
  'offer-draw': offerDraw,
  'answer-draw': answerDraw,
  'claim-win': claimWin,
  rematch,
};

// ---------------------------------------------------------------------------
// Checks shared by the actions
// ---------------------------------------------------------------------------

/** Can this student play right now? `forPlaying` also checks the teacher's switch. */
async function mustBeAllowed(services: Services, player: string, forPlaying: boolean): Promise<PlayerStatus> {
  const status = await services.playerStatus(player);
  if (!status?.school) throw new Refused('sign-in');
  if (status.hidden) throw new Refused('hidden');
  if (forPlaying && !status.multiplayerEnabled) throw new Refused('paused');
  return status;
}

async function loadMyGame(services: Services, me: string, id: unknown): Promise<{ game: GameRow; side: Side }> {
  if (typeof id !== 'string' || id.length > 64) throw new Refused('bad-request');
  const game = await services.loadGame(id);
  if (!game) throw new Refused('not-yours');
  if (game.first_player === me) return { game, side: 'first' };
  if (game.second_player === me) return { game, side: 'second' };
  throw new Refused('not-yours');
}

function mustBePlaying(game: GameRow) {
  if (game.status === 'waiting') throw new Refused('not-started');
  if (game.status !== 'playing') throw new Refused('over');
}

async function save(services: Services, game: GameRow, patch: Partial<GameRow>): Promise<GameRow> {
  const saved = await services.updateGame(game.id, game.version, { ...patch, version: game.version + 1 });
  if (!saved) throw new Refused('changed');
  return saved;
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

/** The changes that end a game. */
function ending(services: Services, game: GameRow, winner: Side | null, reason: string, plies = game.moves.length) {
  return {
    status: 'finished' as const,
    winner,
    reason,
    counts_for_points: countsForPoints(plies, reason),
    finished_at: iso(services.now()),
    draw_offer: null,
  };
}

// ---------------------------------------------------------------------------
// Starting and joining
// ---------------------------------------------------------------------------

async function create({ services, me, body }: Context): Promise<GameRow> {
  if (!isGameKind(body.game)) throw new Refused('bad-request');
  const choice = body.side;
  if (choice !== 'first' && choice !== 'second' && choice !== 'random') throw new Refused('bad-request');
  const status = await mustBeAllowed(services, me, true);
  if (status.createdLastHour >= MAX_CREATES_PER_HOUR) throw new Refused('too-many');

  // One waiting game each: a new one replaces the old one.
  await cancelWaitingGame(services, me);

  const side: Side = choice === 'random' ? (services.random() < 0.5 ? 'first' : 'second') : choice;
  for (let tries = 0; tries < 5; tries++) {
    const inserted = await services.insertGame({
      game: body.game,
      code: makeCode(() => services.random()),
      in_lobby: body.lobby === true,
      created_by: me,
      first_player: side === 'first' ? me : null,
      second_player: side === 'second' ? me : null,
      status: 'waiting',
      expires_at: iso(services.now() + WAITING_GAME_MS),
    });
    if (inserted === 'code-taken') continue;
    if (inserted === 'already-waiting') throw new Refused('changed');
    if (inserted === 'failed') throw new Refused('failed');
    return inserted;
  }
  throw new Refused('failed');
}

async function cancelWaitingGame(services: Services, me: string) {
  const waiting = await services.findWaitingCreatedBy(me);
  if (waiting) await services.updateGame(waiting.id, waiting.version, { status: 'cancelled', version: waiting.version + 1 });
}

async function join({ services, limiter, me, body }: Context): Promise<GameRow> {
  let game: GameRow | null;
  if (body.code !== undefined) {
    if (!limiter.allow(`code:${me}`, MAX_CODE_TRIES_PER_MINUTE)) throw new Refused('too-many-codes');
    const code = normaliseCode(body.code);
    game = code ? await services.findWaitingByCode(code) : null;
    if (!game) throw new Refused('not-found');
  } else {
    // From the lobby: only games that were posted there can be joined without the code.
    if (typeof body.gameId !== 'string' || body.gameId.length > 64) throw new Refused('bad-request');
    game = await services.loadGame(body.gameId);
    if (!game || !game.in_lobby) throw new Refused('not-found');
  }
  const status = await mustBeAllowed(services, me, true);
  // A game made at another school looks exactly like a code that doesn't exist: nothing is shared between schools.
  const maker = game.created_by ? await services.playerStatus(game.created_by) : null;
  if (maker && maker.schoolId !== status.schoolId) throw new Refused('not-found');

  if (game.created_by === me) throw new Refused('own-game');
  if (game.status === 'playing' || game.status === 'finished') throw new Refused('full');
  if (game.status !== 'waiting' || Date.parse(game.expires_at) <= services.now()) throw new Refused('expired');
  // The creator might have been hidden since they made it. Don't say so, just don't let anyone in.
  const creator = game.created_by && (await services.playerStatus(game.created_by));
  if (!creator || !creator.school || creator.hidden) throw new Refused('expired');

  const now = iso(services.now());
  const joined = await services.updateGame(game.id, game.version, {
    first_player: game.first_player ?? me,
    second_player: game.second_player ?? me,
    status: 'playing',
    started_at: now,
    turn_started_at: now,
    version: game.version + 1,
  });
  if (!joined) throw new Refused('full');
  // You're playing now, so any game you were waiting on is no longer needed.
  await cancelWaitingGame(services, me);
  return joined;
}

async function cancel({ services, me, body }: Context): Promise<GameRow> {
  const { game } = await loadMyGame(services, me, body.gameId);
  if (game.created_by !== me) throw new Refused('not-yours');
  // Someone joined just before: nothing to cancel, so hand back the started game.
  if (game.status !== 'waiting') return game;
  const cancelled = await services.updateGame(game.id, game.version, { status: 'cancelled', version: game.version + 1 });
  return cancelled ?? (await services.loadGame(game.id)) ?? game;
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

async function move({ services, me, body }: Context): Promise<GameRow> {
  const { game, side } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  await mustBeAllowed(services, me, true);
  // The page says how many moves it has seen. If that's out of date, it must look again first.
  if (body.ply !== game.moves.length) throw new Refused('changed');
  const replayed = replayGame(game.game, game.moves);
  if (!replayed.ok) throw new Refused('failed');
  if (replayed.toMove !== side) throw new Refused('not-your-turn');

  const played = checkMove(game.game, game.moves, body.move);
  if (!played) throw new Refused('illegal');
  const moves = [...game.moves, played];
  const after = replayGame(game.game, moves);
  if (!after.ok) throw new Refused('failed');

  return save(services, game, {
    moves,
    turn_started_at: iso(services.now()),
    // Moving instead of answering turns a draw offer down.
    draw_offer: null,
    ...(after.ended && ending(services, game, after.ended.winner, after.ended.reason, moves.length)),
  });
}

async function resign({ services, me, body }: Context): Promise<GameRow> {
  const { game, side } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  return save(services, game, ending(services, game, otherSide(side), 'resigned'));
}

async function offerDraw({ services, me, body }: Context): Promise<GameRow> {
  const { game, side } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  await mustBeAllowed(services, me, false);
  // Both offered: that's a draw.
  if (game.draw_offer === otherSide(side)) return save(services, game, ending(services, game, null, 'agreed-draw'));
  if (game.draw_offer === side) return game;

  const made = side === 'first' ? game.first_draw_offers : game.second_draw_offers;
  const lastPly = side === 'first' ? game.first_offer_ply : game.second_offer_ply;
  const plies = game.moves.length;
  const blocked = drawOfferBlock(side, made, lastPly, plies);
  if (blocked) throw new Refused(blocked.problem);
  return save(
    services,
    game,
    side === 'first'
      ? { draw_offer: side, first_draw_offers: made + 1, first_offer_ply: plies }
      : { draw_offer: side, second_draw_offers: made + 1, second_offer_ply: plies },
  );
}

async function answerDraw({ services, me, body }: Context): Promise<GameRow> {
  const { game, side } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  if (typeof body.accept !== 'boolean') throw new Refused('bad-request');
  if (game.draw_offer !== otherSide(side)) throw new Refused('no-offer');
  if (body.accept) return save(services, game, ending(services, game, null, 'agreed-draw'));
  return save(services, game, { draw_offer: null });
}

async function claimWin({ services, me, body }: Context): Promise<GameRow> {
  const { game, side } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  const replayed = replayGame(game.game, game.moves);
  if (!replayed.ok) throw new Refused('failed');
  // You can only claim while your opponent is the one keeping everyone waiting.
  if (replayed.toMove === side) throw new Refused('not-yet', { secondsLeft: CLAIM_WIN_AFTER_MS / 1000 });
  const waited = services.now() - Date.parse(game.turn_started_at ?? game.started_at ?? '');
  if (!(waited >= CLAIM_WIN_AFTER_MS)) {
    const left = Number.isFinite(waited) ? CLAIM_WIN_AFTER_MS - waited : CLAIM_WIN_AFTER_MS;
    throw new Refused('not-yet', { secondsLeft: Math.ceil(left / 1000) });
  }
  // Walking away counts as a loss for the one who left, and earns nobody anything.
  return save(services, game, ending(services, game, side, 'abandoned'));
}

async function rematch(context: Context, tries = 0): Promise<GameRow> {
  const { services, me, body } = context;
  const { game, side } = await loadMyGame(services, me, body.gameId);
  if (game.status !== 'finished') throw new Refused('bad-request');
  if (game.rematch_game) return game;
  const mine = await mustBeAllowed(services, me, true);
  const opponent = side === 'first' ? game.second_player : game.first_player;
  const them = opponent && (await services.playerStatus(opponent));
  if (!them || !them.school || them.hidden || them.schoolId !== mine.schoolId) throw new Refused('no-opponent');

  const flag = side === 'first' ? 'first_wants_rematch' : 'second_wants_rematch';
  let asked: GameRow;
  try {
    asked = game[flag] ? game : await save(services, game, { [flag]: true });
  } catch (error) {
    // Both players pressed Rematch at the same moment: look again and try once more.
    if (error instanceof Refused && error.problem === 'changed' && tries < 2) return rematch(context, tries + 1);
    throw error;
  }
  if (!(asked.first_wants_rematch && asked.second_wants_rematch)) return asked;

  // Both want a rematch: start it straight away, with the colours swapped.
  const now = iso(services.now());
  const next = await services.insertGame({
    game: asked.game,
    code: null,
    in_lobby: false,
    created_by: me,
    first_player: asked.second_player,
    second_player: asked.first_player,
    status: 'playing',
    expires_at: now,
    started_at: now,
    turn_started_at: now,
  });
  if (typeof next === 'string') throw new Refused('failed');
  const linked = await services.updateGame(asked.id, asked.version, { rematch_game: next.id, version: asked.version + 1 });
  if (linked) return linked;
  // The other player's request got there first and started its own rematch. Drop this one.
  await services.updateGame(next.id, next.version, { status: 'cancelled', version: next.version + 1 });
  return (await services.loadGame(asked.id)) ?? asked;
}
