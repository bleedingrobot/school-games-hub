/**
 * The space-game server function: the referee for Wormholes & Black Holes with classmates.
 *
 * The browser only ever asks: "roll", "use my Booster", "jump through the gate", "join the
 * game with this code". This works out who's asking from their sign-in token (never from the
 * request), rolls the dice itself with secure randomness, runs the shared rules engine
 * (shared/space/live.ts), flies any bots and autopilot rockets, and saves the new state
 * "only if the version is still N", so a double tap can't roll twice.
 *
 * Bot games don't come here: they're played in the browser and saved by save-bot-game.
 */
import { makeCode, normaliseCode } from '../../../shared/multiplayer';
import type { FactAnswer, FactStats } from '../../../shared/maths/leitner';
import type { Question } from '../../../shared/maths/skillPack';
import { solveQuestion, TimesTables } from '../../../shared/maths/skillPacks/timesTables';
import { canCharge, MAX_PLAYERS, MIN_PLAYERS, placesFor, SpaceRuleError, type SpaceAction, type SpaceEvent, type SpaceState } from '../../../shared/space/engine';
import { pickSpaceQuestion, type MathsQuestionSettings } from '../../../shared/space/mathsQuestion';
import { isItemKind } from '../../../shared/space/items';
import {
  autopilotSeats,
  deadlineAfter,
  isReaction,
  launchLive,
  parseLiveSetup,
  playerAction,
  seatsThatCount,
  takeControls,
  timeOut,
  type LiveGame,
  type LiveSetup,
  type LoggedAction,
  type Played,
  type SeatInfo,
} from '../../../shared/space/live';
import type { MathsSwitch } from '../../../shared/space/mathsSwitch';
import { diceFrom, shuffled } from '../../../shared/space/random';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';
import { RateLimiter } from '../_shared/limits';

/** One row of the space_games table. */
export interface SpaceGameRow {
  id: string;
  code: string | null;
  in_lobby: boolean;
  host: string | null;
  seat1: string | null;
  seat2: string | null;
  seat3: string | null;
  seat4: string | null;
  status: 'waiting' | 'playing' | 'finished' | 'cancelled' | 'expired';
  setup: LiveSetup;
  rockets: number | null;
  seat_info: SeatInfo[] | null;
  state: SpaceState | null;
  events: SpaceEvent[];
  actions: LoggedAction[];
  version: number;
  created_at: string;
  expires_at: string;
  started_at: string | null;
  turn_deadline: string | null;
  last_action_at: string | null;
  finished_at: string | null;
  ending: 'docked' | 'mission-clock' | 'abandoned' | null;
  places: number[] | null;
  counts: boolean[] | null;
  reactions: { last: { seat: number; emoji: string; id: number } | null; sent: number[]; at: number[] };
  rematch_game: string | null;
}

export type NewSpaceGame = Pick<SpaceGameRow, 'code' | 'in_lobby' | 'host' | 'seat1' | 'status' | 'setup' | 'expires_at'>;

export interface PlayerStatus {
  /** Has a profile and a school account. */
  school: boolean;
  hidden: boolean;
  multiplayerEnabled: boolean;
  reactionsEnabled: boolean;
  createdLastHour: number;
  /** Which school the player belongs to. A game is only ever shared inside one school. */
  schoolId: number | null;
  /** Which of the other players asked about are hidden, or don't exist any more. */
  gone: string[];
}

export type ReactionResult = 'ok' | 'too-soon' | 'too-many' | 'not-playing' | 'not-allowed';

/** A question the server asked a student (Mission Control maths). The answer is in it: never sent to browsers. */
export interface StoredQuestion {
  /** moment: the game version it was asked at. charge: the turns the student had finished. */
  stamp: number;
  question: Question;
  /** Milliseconds since 1970. */
  askedAt: number;
  answered: boolean;
}

export type QuestionKind = 'moment' | 'charge';

/** Everything this needs from Supabase, passed in so the tests can stand in for it. */
export interface Services {
  /** Milliseconds since 1970, by the server's clock. */
  now(): number;
  /** Secure random numbers from 0 up to (not including) 1: the dice. */
  random(): number;
  userIdFor(token: string): Promise<string | null>;
  playerStatus(player: string, others?: string[]): Promise<PlayerStatus | null>;
  loadGame(id: string): Promise<SpaceGameRow | null>;
  findWaitingByCode(code: string): Promise<SpaceGameRow | null>;
  /** True if a chess or checkers game is waiting with this code, so it can't be used here. */
  friendCodeTaken(code: string): Promise<boolean>;
  findWaitingHostedBy(player: string): Promise<SpaceGameRow | null>;
  insertGame(row: NewSpaceGame): Promise<SpaceGameRow | 'code-taken' | 'already-waiting' | 'failed'>;
  /** Saves the change only if the game is still at `version`. Null if it had changed. */
  updateGame(id: string, version: number, patch: Partial<SpaceGameRow>): Promise<SpaceGameRow | null>;
  addReaction(id: string, seat: number, emoji: string): Promise<ReactionResult>;
  /** The teacher's Mission Control maths switch. */
  mathsSwitch(player: string): Promise<MathsSwitch>;
  /** A student's times-table records and the teacher's question settings, to pick the next question from. */
  loadMathsContext(player: string): Promise<{ facts: FactStats[]; settings: MathsQuestionSettings } | null>;
  loadQuestion(game: string, seat: number, kind: QuestionKind): Promise<StoredQuestion | null>;
  /** Keeps this as the seat's question of that kind (replacing an older one). */
  saveQuestion(game: string, seat: number, kind: QuestionKind, stamp: number, question: Question): Promise<void>;
  /** Marks the question answered. False if it already was (so a double tap counts once). */
  claimQuestion(game: string, seat: number, kind: QuestionKind): Promise<boolean>;
  /** Removes a question once it's been dealt with. */
  dropQuestion(game: string, seat: number, kind: QuestionKind): Promise<void>;
  /** Adds one answer to the student's times-table records. `once` makes a retry count once. */
  recordAnswer(player: string, once: string, answer: FactAnswer): Promise<void>;
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
  | 'not-your-turn'
  | 'autopilot'
  | 'not-host'
  | 'need-players'
  | 'illegal'
  | 'over'
  | 'changed'
  | 'too-many'
  | 'too-many-codes'
  | 'not-yet'
  | 'full'
  | 'expired'
  | 'rematch-gone'
  | 'reactions-off'
  | 'maths-off'
  | 'reaction-wait'
  | 'reaction-limit'
  | 'failed';

/** What students see. Friendly, and nothing technical. */
const MESSAGES: Record<Problem, [status: number, text: string]> = {
  'sign-in': [401, 'Please sign in again.'],
  'bad-request': [400, 'Something went wrong. Please try again.'],
  paused: [403, 'Your teacher has paused games against friends for now.'],
  hidden: [403, 'Playing friends isn’t available for you right now. Ask your teacher.'],
  'not-found': [404, 'We couldn’t find a game with that code. Check it and try again.'],
  'not-yours': [403, 'That isn’t your game.'],
  'not-started': [409, 'The host hasn’t launched yet.'],
  'not-your-turn': [409, 'It’s not your turn yet.'],
  autopilot: [409, 'Autopilot is flying your rocket. Tap “Take the controls” first.'],
  'not-host': [403, 'Only the person who started the game can do that.'],
  'need-players': [409, 'You need at least 2 players to launch. Share the code!'],
  illegal: [400, 'You can’t do that right now.'],
  over: [409, 'This game has already finished.'],
  changed: [409, 'The game changed just then. Have another look.'],
  'too-many': [429, 'Slow down a little! Try again in a minute.'],
  'too-many-codes': [429, 'That’s a lot of codes. Wait a minute, then try again.'],
  'not-yet': [409, 'There’s still time on the clock.'],
  full: [409, 'That game is full, or it has already launched.'],
  expired: [410, 'That game stopped waiting. Ask your friend to make a new one.'],
  'rematch-gone': [409, 'That rematch has already launched or stopped waiting.'],
  'reactions-off': [403, 'Reactions are switched off.'],
  'maths-off': [403, 'Your teacher has switched Mission Control maths off.'],
  'reaction-wait': [429, 'Wait a few seconds before sending another.'],
  'reaction-limit': [429, 'That’s all the reactions for this game.'],
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
export function spaceGameHandler(services: Services) {
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
      const result = await action({ services, limiter, me, body });
      return reply(200, result instanceof WithGame ? { game: result.game, ...result.extra } : { game: result });
    } catch (error) {
      if (error instanceof Refused) {
        // Logs say what went wrong, never who.
        if (!['not-your-turn', 'changed', 'not-yet', 'not-found', 'illegal', 'reaction-wait'].includes(error.problem)) {
          console.warn(`space-game: refused ${String(body.action)} (${error.problem})`);
        }
        return refuse(error);
      }
      console.error(`space-game: ${String(body.action)} failed${error instanceof Error ? ` (${error.message.slice(0, 80)})` : ''}`);
      return refuse(new Refused('failed'));
    }
  };
}

/** A reply that carries more than the game: for the student who asked only (e.g. their question). */
class WithGame {
  constructor(
    readonly game: SpaceGameRow,
    readonly extra: Record<string, unknown>,
  ) {}
}

const ACTIONS: Record<string, (c: Context) => Promise<SpaceGameRow | WithGame>> = {
  create,
  join,
  cancel: leave,
  leave,
  launch,
  roll: (c) => playerTurn(c, { kind: 'roll' }),
  'use-item': (c) => playerTurn(c, itemAction(c.body)),
  choose: (c) => playerTurn(c, chooseAction(c.body)),
  question: askQuestion,
  answer: answerQuestion,
  'times-up': timesUp,
  'take-controls': takeTheControls,
  rematch,
  react,
};

// ---------------------------------------------------------------------------
// Checks shared by the actions
// ---------------------------------------------------------------------------

const seatsOf = (g: SpaceGameRow): (string | null)[] => [g.seat1, g.seat2, g.seat3, g.seat4];
const seatPatch = (seats: (string | null)[]) => ({ seat1: seats[0] ?? null, seat2: seats[1] ?? null, seat3: seats[2] ?? null, seat4: seats[3] ?? null });
const iso = (ms: number) => new Date(ms).toISOString();

async function mustBeAllowed(services: Services, player: string, forPlaying: boolean, others: string[] = []): Promise<PlayerStatus> {
  const status = await services.playerStatus(player, others);
  if (!status?.school) throw new Refused('sign-in');
  if (status.hidden) throw new Refused('hidden');
  if (forPlaying && !status.multiplayerEnabled) throw new Refused('paused');
  return status;
}

async function loadMyGame(services: Services, me: string, id: unknown): Promise<{ game: SpaceGameRow; seat: number }> {
  if (typeof id !== 'string' || id.length > 64) throw new Refused('bad-request');
  const game = await services.loadGame(id);
  const seat = game ? seatsOf(game).indexOf(me) : -1;
  if (!game || seat < 0) throw new Refused('not-yours');
  return { game, seat };
}

function mustBePlaying(game: SpaceGameRow) {
  if (game.status === 'waiting') throw new Refused('not-started');
  if (game.status !== 'playing' || !game.state || !game.seat_info) throw new Refused('over');
}

const liveGame = (row: SpaceGameRow): LiveGame => ({ state: row.state!, seats: row.seat_info! });

async function save(services: Services, game: SpaceGameRow, patch: Partial<SpaceGameRow>): Promise<SpaceGameRow> {
  const saved = await services.updateGame(game.id, game.version, { ...patch, version: game.version + 1 });
  if (!saved) throw new Refused('changed');
  return saved;
}

/** The changes to save after the engine (and any bots) have played. */
function afterPlay(services: Services, players: (string | null)[], played: Played): Partial<SpaceGameRow> {
  const now = services.now();
  const { game } = played;
  const patch: Partial<SpaceGameRow> = {
    state: game.state,
    seat_info: game.seats,
    events: played.events,
    actions: played.actions,
    last_action_at: iso(now),
    turn_deadline: null,
  };
  if (played.everyoneLeft) {
    return { ...patch, status: 'finished', ending: 'abandoned', counts: game.seats.map(() => false), finished_at: iso(now) };
  }
  if (game.state.phase === 'over') {
    return {
      ...patch,
      status: 'finished',
      ending: game.state.ending,
      places: game.state.places ?? placesFor(game.state),
      counts: seatsThatCount(game, players.slice(0, game.seats.length)),
      finished_at: iso(now),
    };
  }
  const deadline = deadlineAfter(game, played.events, now);
  return { ...patch, turn_deadline: deadline === null ? null : iso(deadline) };
}

/**
 * Students the teacher has hidden (or who have been deleted) can't keep playing: autopilot
 * flies their rockets from now on. Returns the saved game if anything changed.
 */
async function autopilotGone(services: Services, row: SpaceGameRow, status: PlayerStatus): Promise<SpaceGameRow | null> {
  const seats = seatsOf(row);
  const info = row.seat_info!;
  const gone = info
    .map((_, i) => i)
    .filter((i) => !info[i].bot && !info[i].autopilot && (seats[i] === null || status.gone.includes(seats[i]!)));
  if (gone.length === 0) return null;
  const played = autopilotSeats(liveGame(row), gone, diceFrom(services.random), services.random);
  if (!played) return null;
  return save(services, row, afterPlay(services, seatsOf(row), played));
}

const otherPlayers = (row: SpaceGameRow, me: string) => seatsOf(row).filter((p): p is string => p !== null && p !== me);

// ---------------------------------------------------------------------------
// Waiting room
// ---------------------------------------------------------------------------

async function create({ services, me, body }: Context): Promise<SpaceGameRow> {
  const setup = parseLiveSetup(body.setup);
  if (!setup) throw new Refused('bad-request');
  const status = await mustBeAllowed(services, me, true);
  if (status.createdLastHour >= MAX_CREATES_PER_HOUR) throw new Refused('too-many');
  // The teacher's switch: Off refuses a maths game, On makes every game a maths game.
  const mathsSwitch = await services.mathsSwitch(me);
  if (mathsSwitch === 'off' && setup.settings.maths) throw new Refused('maths-off');
  return newWaitingGame(services, me, withMathsSwitch(setup, mathsSwitch), body.lobby === true);
}

/** The setup as the teacher's switch allows it. */
const withMathsSwitch = (setup: LiveSetup, mathsSwitch: MathsSwitch): LiveSetup =>
  mathsSwitch === 'choose' || setup.settings.maths === (mathsSwitch === 'on') ? setup : { ...setup, settings: { ...setup.settings, maths: mathsSwitch === 'on' } };

async function newWaitingGame(services: Services, me: string, setup: LiveSetup, inLobby: boolean): Promise<SpaceGameRow> {
  // One waiting game each: a new one replaces the old one.
  const waiting = await services.findWaitingHostedBy(me);
  if (waiting) await services.updateGame(waiting.id, waiting.version, { status: 'cancelled', version: waiting.version + 1, events: [], actions: [] });
  for (let tries = 0; tries < 5; tries++) {
    const code = makeCode(() => services.random());
    if (await services.friendCodeTaken(code)) continue;
    const inserted = await services.insertGame({
      code,
      in_lobby: inLobby,
      host: me,
      seat1: me,
      status: 'waiting',
      setup,
      expires_at: iso(services.now() + WAITING_GAME_MS),
    });
    if (inserted === 'code-taken') continue;
    if (inserted === 'already-waiting') throw new Refused('changed');
    if (inserted === 'failed') throw new Refused('failed');
    return inserted;
  }
  throw new Refused('failed');
}

async function join({ services, limiter, me, body }: Context): Promise<SpaceGameRow> {
  let game: SpaceGameRow | null;
  if (body.code !== undefined) {
    if (!limiter.allow(`code:${me}`, MAX_CODE_TRIES_PER_MINUTE)) throw new Refused('too-many-codes');
    const code = normaliseCode(body.code);
    game = code ? await services.findWaitingByCode(code) : null;
    if (!game) throw new Refused('not-found');
  } else {
    if (typeof body.gameId !== 'string' || body.gameId.length > 64) throw new Refused('bad-request');
    game = await services.loadGame(body.gameId);
    // From the lobby: only games posted there can be joined without the code.
    if (!game || !game.in_lobby) throw new Refused('not-found');
  }
  const status = await mustBeAllowed(services, me, true);
  await mustBeSameSchool(services, status, game.host);
  return joinWaiting(services, me, game);
}

/** A game made at another school looks exactly like a code that doesn't exist: nothing is shared between schools. */
async function mustBeSameSchool(services: Services, me: PlayerStatus, host: string | null): Promise<void> {
  const theirs = host ? await services.playerStatus(host) : null;
  if (theirs && theirs.schoolId !== me.schoolId) throw new Refused('not-found');
}

/** Takes the first empty seat in a waiting game. Already in it? Then that's fine. */
async function joinWaiting(services: Services, me: string, first: SpaceGameRow): Promise<SpaceGameRow> {
  let game: SpaceGameRow | null = first;
  for (let tries = 0; tries < 4 && game; tries++) {
    if (seatsOf(game).includes(me)) return game;
    if (game.status === 'playing' || game.status === 'finished') throw new Refused('full');
    if (game.status !== 'waiting' || Date.parse(game.expires_at) <= services.now()) throw new Refused('expired');
    // The host might have been hidden since they made it. Don't say so, just don't let anyone in.
    const host = game.host && (await services.playerStatus(game.host));
    if (!host || !host.school || host.hidden) throw new Refused('expired');
    const seats = seatsOf(game);
    const empty = seats.indexOf(null);
    if (empty < 0) throw new Refused('full');
    seats[empty] = me;
    const joined = await services.updateGame(game.id, game.version, { ...seatPatch(seats), version: game.version + 1 });
    if (joined) return joined;
    // Someone else joined at the same moment: look again.
    game = await services.loadGame(game.id);
  }
  throw new Refused('changed');
}

async function leave({ services, me, body }: Context): Promise<SpaceGameRow> {
  const { game, seat } = await loadMyGame(services, me, body.gameId);
  if (game.status === 'waiting') {
    if (game.host === me) {
      const cancelled = await services.updateGame(game.id, game.version, { status: 'cancelled', version: game.version + 1 });
      if (cancelled) return cancelled;
      throw new Refused('changed');
    }
    const seats = seatsOf(game).filter((p) => p !== me);
    return save(services, game, seatPatch(seats));
  }
  if (game.status !== 'playing' || !game.seat_info) return game;
  // Leaving part-way: autopilot flies your rocket, so the game goes on for everyone else.
  const played = autopilotSeats(liveGame(game), [seat], diceFrom(services.random), services.random);
  if (!played) return game;
  return save(services, game, afterPlay(services, seatsOf(game), played));
}

async function launch({ services, me, body }: Context): Promise<SpaceGameRow> {
  const { game } = await loadMyGame(services, me, body.gameId);
  if (game.host !== me) throw new Refused('not-host');
  if (game.status === 'playing') return game; // a second tap
  if (game.status !== 'waiting') throw new Refused('over');
  const others = otherPlayers(game, me);
  const status = await mustBeAllowed(services, me, true, others);
  // Anyone hidden since they joined is quietly left out.
  const students = seatsOf(game).filter((p): p is string => p !== null && !status.gone.includes(p));
  const bots = body.bots ?? 0;
  if (typeof bots !== 'number' || !Number.isInteger(bots) || bots < 0 || bots > MAX_PLAYERS - students.length) {
    throw new Refused('bad-request');
  }
  if (students.length < MIN_PLAYERS) throw new Refused('need-players');

  const dice = diceFrom(services.random);
  // The server shuffles the turn order.
  const entries = shuffled<string | null>(dice, [...students, ...Array.from({ length: bots }, () => null)]);
  // If the teacher changed the maths switch while this game was waiting, the switch wins.
  const setup = withMathsSwitch(game.setup, await services.mathsSwitch(me));
  const played = launchLive(setup, entries, dice, services.random);
  return save(services, game, {
    ...(setup === game.setup ? {} : { setup }),
    ...seatPatch(entries),
    rockets: entries.length,
    status: 'playing',
    started_at: iso(services.now()),
    ...afterPlay(services, entries, played),
  });
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

function itemAction(body: Body): SpaceAction | null {
  if (!isItemKind(body.item)) return null;
  const target = body.target;
  const value = body.value;
  if (target !== undefined && !(Number.isInteger(target) && (target as number) >= 0 && (target as number) < MAX_PLAYERS)) return null;
  if (value !== undefined && !(Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 6)) return null;
  return {
    kind: 'use-item',
    item: body.item,
    ...(target !== undefined ? { target: target as number } : {}),
    ...(value !== undefined ? { value: value as number } : {}),
  };
}

function chooseAction(body: Body): SpaceAction | null {
  const option = body.option;
  return Number.isInteger(option) && (option as number) >= 0 && (option as number) <= 3 ? { kind: 'choose', option: option as number } : null;
}

async function playerTurn({ services, me, body }: Context, action: SpaceAction | null): Promise<SpaceGameRow> {
  if (!action) throw new Refused('bad-request');
  const { game, seat } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  const status = await mustBeAllowed(services, me, true, otherPlayers(game, me));
  // The page says which version it's looking at. Out of date? It must look again first.
  if (body.version !== game.version) throw new Refused('changed');
  if (await autopilotGone(services, game, status)) throw new Refused('changed');
  if (game.state!.turn !== seat) throw new Refused('not-your-turn');
  if (game.seat_info![seat].autopilot) throw new Refused('autopilot');
  // A maths question is answered with the number, which the server marks: never "I got it right".
  if (action.kind === 'choose' && game.state!.phase === 'choice' && game.state!.pending?.kind === 'question') {
    throw new Refused('illegal', { error: 'Type your answer to carry on.' });
  }

  let played: Played;
  try {
    played = playerAction(liveGame(game), action, diceFrom(services.random), services.random);
  } catch (error) {
    // The rules engine's messages are written for students.
    if (error instanceof SpaceRuleError) throw new Refused('illegal', { error: error.message });
    throw error;
  }
  return save(services, game, afterPlay(services, seatsOf(game), played));
}

// ---------------------------------------------------------------------------
// Mission Control maths
// ---------------------------------------------------------------------------

/** What a student sees of a question: everything but the answer. */
function publicQuestion(q: Question) {
  const { id, skill, kind, parts, spoken, choices } = q;
  return { id, skill, kind, parts, spoken, ...(choices ? { choices } : {}) };
}

const isKind = (value: unknown): value is QuestionKind => value === 'moment' || value === 'charge';

/** Everything that must be true for this student to be asked (or to answer) a question of this kind now. */
function questionStamp(game: SpaceGameRow, seat: number, kind: QuestionKind, body: Body): number {
  if (!game.setup.settings.maths) throw new Refused('illegal', { error: 'Mission Control maths is off in this game.' });
  const info = game.seat_info![seat];
  if (info.autopilot) throw new Refused('autopilot');
  const s = game.state!;
  if (kind === 'moment') {
    if (body.version !== game.version) throw new Refused('changed');
    if (s.turn !== seat) throw new Refused('not-your-turn');
    if (s.phase !== 'choice' || s.pending?.kind !== 'question') throw new Refused('illegal');
    return game.version;
  }
  // The question after a turn: only once you've finished one, and not once you've rolled on the next.
  if (!s.rockets[seat].hasPlayed) throw new Refused('illegal', { error: 'Mission Control asks after your first turn.' });
  if (s.turn === seat && s.turnInfo.rolled) throw new Refused('not-yet');
  return info.stats.turns;
}

/** A student asks for their question (it's picked from their records and kept, so a reload shows the same one). */
async function askQuestion({ services, me, body }: Context): Promise<SpaceGameRow | WithGame> {
  if (!isKind(body.kind)) throw new Refused('bad-request');
  const { game, seat } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  await mustBeAllowed(services, me, true, otherPlayers(game, me));
  const stamp = questionStamp(game, seat, body.kind, body);
  const stored = await services.loadQuestion(game.id, seat, body.kind);
  if (stored && stored.stamp === stamp) {
    return new WithGame(game, stored.answered ? { done: true } : { question: publicQuestion(stored.question) });
  }
  const context = await services.loadMathsContext(me);
  if (!context) throw new Refused('failed');
  const pack = new TimesTables(context.facts, services.random);
  const question = pickSpaceQuestion(pack, context.settings);
  if (!question) throw new Refused('failed');
  await services.saveQuestion(game.id, seat, body.kind, stamp, question);
  return new WithGame(game, { question: publicQuestion(question) });
}

/** The student's typed answer, marked here. */
async function answerQuestion({ services, me, body }: Context): Promise<SpaceGameRow | WithGame> {
  const typed = body.answer;
  if (!isKind(body.kind) || !Number.isInteger(typed) || (typed as number) < 0 || (typed as number) > 1000) throw new Refused('bad-request');
  const { game, seat } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  await mustBeAllowed(services, me, true, otherPlayers(game, me));
  const kind: QuestionKind = body.kind;
  const stamp = questionStamp(game, seat, kind, body);
  const stored = await services.loadQuestion(game.id, seat, kind);
  if (!stored || stored.stamp !== stamp) throw new Refused('changed');
  if (stored.answered) throw new Refused('illegal', { error: 'You’ve already answered that one.' });
  const solved = solveQuestion(stored.question.parts);
  if (!solved) throw new Refused('failed');
  const right = typed === solved.answer;
  const now = services.now();
  // How long it took, as far as the server can tell: never more than the time since it was asked.
  const claimed = typeof body.ms === 'number' && Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : Infinity;
  const ms = Math.round(Math.min(claimed, now - stored.askedAt));
  const answer: FactAnswer = { key: solved.key, correct: right, ms, at: now };
  const once = `${game.id}:${seat}:${kind}:${stamp}`;
  const reply = { right, answer: solved.answer };

  if (kind === 'moment') {
    // The game is waiting on this answer: play it. The version check means it counts once.
    let played: Played;
    try {
      played = playerAction(liveGame(game), { kind: 'choose', option: right ? 1 : 0 }, diceFrom(services.random), services.random);
    } catch (error) {
      if (error instanceof SpaceRuleError) throw new Refused('illegal', { error: error.message });
      throw error;
    }
    const saved = await save(services, game, afterPlay(services, seatsOf(game), played));
    await services.recordAnswer(me, once, answer);
    await services.dropQuestion(game.id, seat, kind);
    return new WithGame(saved, reply);
  }

  // The question after a turn: counted once, then the +1 goes in when the student can use it.
  if (!(await services.claimQuestion(game.id, seat, kind))) throw new Refused('illegal', { error: 'You’ve already answered that one.' });
  await services.recordAnswer(me, once, answer);
  if (!right) return new WithGame(game, reply);
  let current: SpaceGameRow | null = game;
  for (let tries = 0; tries < 4 && current; tries++) {
    const next = chargeRight(services, current, seat);
    if (next === 'nothing') return new WithGame(current, reply);
    const saved = await services.updateGame(current.id, current.version, { ...next, version: current.version + 1 });
    if (saved) return new WithGame(saved, reply);
    // Someone moved at the same moment: look again.
    current = await services.loadGame(current.id);
    if (!current || current.status !== 'playing' || !current.state || !current.seat_info) return new WithGame(game, reply);
  }
  return new WithGame(current ?? game, reply);
}

/** What to save for a right charge answer: the +1 now if it's their turn and they haven't rolled, else keep it for their next turn. */
function chargeRight(services: Services, game: SpaceGameRow, seat: number): Partial<SpaceGameRow> | 'nothing' {
  const s = game.state!;
  if (s.turn !== seat) {
    const seats = structuredClone(game.seat_info!);
    seats[seat].charged = true;
    return { seat_info: seats, events: [], actions: [] };
  }
  if (!canCharge(s)) return 'nothing';
  const played = playerAction(liveGame(game), { kind: 'charge', right: true }, diceFrom(services.random), services.random);
  // The +1 doesn't give anyone a fresh clock.
  return { ...afterPlay(services, seatsOf(game), played), turn_deadline: game.turn_deadline };
}

/**
 * The clock ran out for whoever's turn it is. Any player's page can ask (server functions
 * can't wake themselves up); the server checks the clock itself, so nobody can hurry anyone.
 */
async function timesUp({ services, me, body }: Context): Promise<SpaceGameRow> {
  const { game } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  const status = await mustBeAllowed(services, me, true, otherPlayers(game, me));
  const after = await autopilotGone(services, game, status);
  if (after) return after;
  const deadline = Date.parse(game.turn_deadline ?? '');
  const left = deadline - services.now();
  if (!(left <= 0)) throw new Refused('not-yet', { secondsLeft: Number.isFinite(left) ? Math.ceil(left / 1000) : 30 });
  const played = timeOut(liveGame(game), diceFrom(services.random), services.random);
  return save(services, game, afterPlay(services, seatsOf(game), played));
}

async function takeTheControls({ services, me, body }: Context): Promise<SpaceGameRow> {
  const { game, seat } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  await mustBeAllowed(services, me, true);
  if (!game.seat_info![seat].autopilot) return game;
  const back = takeControls(liveGame(game), seat);
  // If it's their turn right now, give them the full time for it.
  const deadline = back.state.turn === seat ? deadlineAfter(back, [], services.now()) : null;
  return save(services, game, {
    seat_info: back.seats,
    events: [],
    actions: [],
    ...(deadline !== null ? { turn_deadline: iso(deadline) } : {}),
  });
}

// ---------------------------------------------------------------------------
// After the game
// ---------------------------------------------------------------------------

/**
 * The first to press Rematch starts a new waiting game (same board and rules) linked to this
 * one. Everyone else's Rematch joins it. The host launches it as usual.
 */
async function rematch(context: Context, tries = 0): Promise<SpaceGameRow> {
  const { services, me, body } = context;
  const { game } = await loadMyGame(services, me, body.gameId);
  if (game.status !== 'finished') throw new Refused('bad-request');
  await mustBeAllowed(services, me, true);
  if (game.rematch_game) {
    const next = await services.loadGame(game.rematch_game);
    if (!next) throw new Refused('rematch-gone');
    if (seatsOf(next).includes(me)) return next;
    if (next.status !== 'waiting') throw new Refused('rematch-gone');
    return joinWaiting(services, me, next);
  }
  // A rematch keeps the board and rules, but follows the teacher's switch as it is now.
  const next = await newWaitingGame(services, me, withMathsSwitch(game.setup, await services.mathsSwitch(me)), false);
  const linked = await services.updateGame(game.id, game.version, {
    rematch_game: next.id,
    version: game.version + 1,
    events: [],
    actions: [],
  });
  if (linked) return next;
  // Someone else's Rematch got there first: drop this one and join theirs.
  await services.updateGame(next.id, next.version, { status: 'cancelled', version: next.version + 1 });
  if (tries >= 2) throw new Refused('changed');
  return rematch(context, tries + 1);
}

/**
 * An emoji reaction: one of the six, only if the teacher has switched them on, at most one
 * every 5 seconds and 20 a game. It goes on the game row (not a chat channel), so everyone
 * sees it with the next live update, and it's never kept in the log.
 */
async function react({ services, me, body }: Context): Promise<SpaceGameRow> {
  if (!isReaction(body.emoji)) throw new Refused('bad-request');
  const { game, seat } = await loadMyGame(services, me, body.gameId);
  mustBePlaying(game);
  const status = await mustBeAllowed(services, me, false);
  if (!status.reactionsEnabled) throw new Refused('reactions-off');
  const result = await services.addReaction(game.id, seat, body.emoji);
  if (result === 'too-soon') throw new Refused('reaction-wait');
  if (result === 'too-many') throw new Refused('reaction-limit');
  if (result === 'not-playing') throw new Refused('over');
  if (result !== 'ok') throw new Refused('bad-request');
  return (await services.loadGame(game.id)) ?? game;
}
