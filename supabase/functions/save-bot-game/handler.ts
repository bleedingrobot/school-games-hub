/**
 * The save-bot-game server function: the browser sends the moves of a finished bot game,
 * and this decides the result and saves it.
 *
 * It never trusts the browser's word for the result. It replays every move with chess.js
 * (the same rules code the website uses), works out who won, and only then saves it.
 * The bot's moves are checked for legality too; a determined student could still fake
 * the bot's moves, which is why bot games will only ever earn small, capped points.
 */
import { judgeBotGame, parseReport } from '../../../shared/chess/botGame';

/** The two things this needs from Supabase, passed in so the tests can stand in for them. */
export interface Services {
  /** Who owns this sign-in token? Null if it's missing, expired or fake. */
  userIdFor(token: string): Promise<string | null>;
  /** Saves the game. Returns 'too-many' when the daily limit is reached. */
  record(row: GameRow): Promise<'saved' | 'too-many' | 'refused'>;
}

export interface GameRow {
  player: string;
  game: 'chess';
  bot_level: string;
  player_side: string;
  moves: string[];
  result: string;
  reason: string;
  player_moves: number;
  counts_for_points: boolean;
}

/** Websites allowed to call this from a browser. */
const ALLOWED_ORIGINS = [
  'https://bleedingrobot.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    Vary: 'Origin',
  };
}

export async function handleSaveBotGame(request: Request, services: Services): Promise<Response> {
  const cors = corsHeaders(request.headers.get('Origin'));
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Not allowed.' });

  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  const player = token ? await services.userIdFor(token) : null;
  if (!player) return reply(401, { error: 'Please sign in again.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const report = parseReport(body);
  if (!report) return reply(400, { error: "That game couldn't be read." });

  const judged = judgeBotGame(report);
  // Logs say what was wrong with the game, never who sent it.
  if (!judged.ok) {
    console.warn(`save-bot-game: refused a game (${judged.problem})`);
    return reply(400, { error: "That game couldn't be checked." });
  }

  const { game } = judged;
  const saved = await services.record({
    player,
    game: 'chess',
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
