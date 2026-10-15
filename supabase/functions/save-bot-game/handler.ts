/**
 * The save-bot-game server function: the browser sends the moves of a finished chess,
 * checkers or Wormholes & Black Holes game against bots, and this decides the result and
 * saves it. For Wormholes & Black Holes it also hands out the stamped dice seed a game is
 * played from (shared/space/save.ts explains how that works).
 *
 * It never trusts the browser's word for the result. It replays every move with the same
 * rules code the website uses (chess.js for chess, shared/checkers for checkers), works
 * out who won, and only then saves it. The bot's moves are checked for legality too; a
 * determined student could still fake the bot's moves, which is why bot games will only
 * ever earn small, capped points.
 */
import { judgeBotGame, parseReport } from '../../../shared/chess/botGame';
import { judgeCheckersGame, parseCheckersReport } from '../../../shared/checkers/botGame';
import {
  judgeSpaceGame,
  makeSeed,
  parseSpaceReport,
  seedProblem,
  stampText,
  type SpaceGameReport,
  type SpaceStats,
} from '../../../shared/space/save';
import { bearerToken, corsHeaders, readJsonBody } from '../_shared/http';

/** The two things this needs from Supabase, passed in so the tests can stand in for them. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Saves the game. Returns 'too-many' when the daily limit is reached. */
  record(row: GameRow): Promise<'saved' | 'too-many' | 'refused'>;
  /** Saves a Wormholes & Black Holes game, the same way. */
  recordSpace(row: SpaceRow): Promise<'saved' | 'too-many' | 'refused'>;
  /** Signs some text with a key only the server has (an HMAC), as URL-safe base64. Null if there's no key. */
  stamp(text: string): Promise<string | null>;
  /** The time now, in seconds. */
  nowSeconds?(): number;
  /** Random hex for new seeds. */
  randomHex?(bytes: number): string;
}

export interface GameRow {
  player: string;
  game: 'chess' | 'checkers';
  bot_level: string;
  player_side: string;
  moves: string[];
  result: string;
  reason: string;
  player_moves: number;
  counts_for_points: boolean;
}

export interface SpaceRow extends Omit<GameRow, 'game'> {
  /** The seed, setup and what happened, kept so the game can be checked again. */
  space: {
    seed: string;
    board: SpaceGameReport['board'];
    settings: SpaceGameReport['settings'];
    bots: number;
    place: number | null;
    rockets: number;
    stats: SpaceStats;
  };
}

export async function handleSaveBotGame(request: Request, services: Services): Promise<Response> {
  const cors = corsHeaders(request.headers.get('Origin'));
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

  const token = bearerToken(request);
  const player = token ? await services.userIdFor(token) : null;
  if (!player) return reply(401, { error: 'Please sign in again.' });

  const body = await readJsonBody(request);
  const asked = body as { game?: unknown; start?: unknown } | null;
  if (asked?.game === 'space' && asked.start === true) {
    // A new seed for a Wormholes & Black Holes game, stamped for this student.
    const seed = makeSeed(now(services), (services.randomHex ?? randomHex)(12));
    const stamp = await services.stamp(stampText(player, seed));
    if (!stamp) return reply(500, { error: "The game couldn't start." });
    return reply(200, { seed, stamp });
  }
  if (asked?.game === 'space') return saveSpaceGame(player, body, services, reply);

  const checked = check(body);
  if (!checked) return reply(400, { error: "That game couldn't be read." });
  const { game: gameName, report, judged } = checked;

  // Logs say what was wrong with the game, never who sent it.
  if (!judged.ok) {
    console.warn(`save-bot-game: refused a game (${judged.problem})`);
    return reply(400, { error: "That game couldn't be checked." });
  }

  const { game } = judged;
  const saved = await services.record({
    player,
    game: gameName,
    bot_level: report.level,
    player_side: report.studentColour,
    moves: report.moves,
    result: game.outcome,
    reason: game.reason,
    player_moves: game.studentMoves,
    counts_for_points: game.countsForPoints,
  });
  if (saved === 'too-many') return reply(429, { error: TOO_MANY });
  if (saved !== 'saved') return reply(500, { error: "The game couldn't be saved." });

  return reply(200, { result: game.outcome, reason: game.reason, countsForPoints: game.countsForPoints });
}

const TOO_MANY = "That's a lot of games today! Have a break and come back tomorrow.";

async function saveSpaceGame(
  player: string,
  body: unknown,
  services: Services,
  reply: (status: number, body: object) => Response,
): Promise<Response> {
  const report = parseSpaceReport(body);
  if (!report) return reply(400, { error: "That game couldn't be read." });
  const expected = await services.stamp(stampText(player, report.seed));
  const problem = seedProblem(report.seed, now(services)) ?? (expected && sameText(expected, report.stamp) ? null : 'bad stamp');
  const judged = problem ? { ok: false as const, problem } : judgeSpaceGame(report);
  if (!judged.ok) {
    console.warn(`save-bot-game: refused a space game (${judged.problem})`);
    return reply(400, { error: "That game couldn't be checked." });
  }
  const { game } = judged;
  const saved = await services.recordSpace({
    player,
    bot_level: report.level,
    player_side: game.playerSide,
    moves: report.actions,
    result: game.outcome,
    reason: game.reason,
    player_moves: game.studentTurns,
    counts_for_points: game.countsForPoints,
    space: {
      seed: report.seed,
      board: report.board,
      settings: report.settings,
      bots: report.bots,
      place: game.place,
      rockets: game.rockets,
      stats: game.stats,
    },
  });
  if (saved === 'too-many') return reply(429, { error: TOO_MANY });
  if (saved !== 'saved') return reply(500, { error: "The game couldn't be saved." });
  return reply(200, { result: game.outcome, reason: game.reason, place: game.place, countsForPoints: game.countsForPoints });
}

const now = (services: Services) => Math.floor(services.nowSeconds?.() ?? Date.now() / 1000);

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two stamps without stopping at the first difference, so timing gives nothing away. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Reads and judges a report. Reports without a "game" are chess: that's what the website
 * sent before checkers existed.
 */
function check(body: unknown) {
  const game = (body as { game?: unknown } | null)?.game ?? 'chess';
  if (game === 'chess') {
    const report = parseReport(body);
    return report && { game: 'chess' as const, report, judged: judgeBotGame(report) };
  }
  if (game === 'checkers') {
    const report = parseCheckersReport(body);
    return report && { game: 'checkers' as const, report, judged: judgeCheckersGame(report) };
  }
  return null;
}
