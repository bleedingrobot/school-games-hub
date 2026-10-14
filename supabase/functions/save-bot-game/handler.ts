/**
 * The save-bot-game server function: the browser sends the moves of a finished chess or
 * checkers game against a bot, and this decides the result and saves it.
 *
 * It never trusts the browser's word for the result. It replays every move with the same
 * rules code the website uses (chess.js for chess, shared/checkers for checkers), works
 * out who won, and only then saves it. The bot's moves are checked for legality too; a
 * determined student could still fake the bot's moves, which is why bot games will only
 * ever earn small, capped points.
 */
import { judgeBotGame, parseReport } from '../../../shared/chess/botGame';
import { judgeCheckersGame, parseCheckersReport } from '../../../shared/checkers/botGame';
import { bearerToken, corsHeaders } from '../_shared/http';

/** The two things this needs from Supabase, passed in so the tests can stand in for them. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Saves the game. Returns 'too-many' when the daily limit is reached. */
  record(row: GameRow): Promise<'saved' | 'too-many' | 'refused'>;
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

export async function handleSaveBotGame(request: Request, services: Services): Promise<Response> {
  const cors = corsHeaders(request.headers.get('Origin'));
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

  const token = bearerToken(request);
  const player = token ? await services.userIdFor(token) : null;
  if (!player) return reply(401, { error: 'Please sign in again.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
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
  if (saved === 'too-many') {
    return reply(429, { error: "That's a lot of games today! Have a break and come back tomorrow." });
  }
  if (saved !== 'saved') return reply(500, { error: "The game couldn't be saved." });

  return reply(200, { result: game.outcome, reason: game.reason, countsForPoints: game.countsForPoints });
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
