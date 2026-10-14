import type { BotGameReport, Outcome, Reason } from '../../shared/chess/botGame';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

export interface SavedGame {
  id: string;
  game: string;
  bot_level: string;
  result: Outcome;
  reason: Reason;
  finished_at: string;
}

export interface GameStats {
  game: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
}

/** The sign-in token, kept handy so a game can still be saved while the page is closing. */
let latestToken: string | null = null;

export async function refreshSaveToken(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  latestToken = data.session?.access_token ?? null;
}

function send(report: BotGameReport, token: string, keepalive: boolean) {
  return fetch(`${SUPABASE_URL}/functions/v1/save-bot-game`, {
    method: 'POST',
    keepalive,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(report),
  });
}

/** Sends a finished game to the server, which checks it and saves it. */
export async function saveBotGame(report: BotGameReport): Promise<void> {
  await refreshSaveToken();
  if (!latestToken) throw new FriendlyError('Please sign in again to save your games.');
  let response: Response;
  try {
    response = await send(report, latestToken, false);
  } catch {
    throw new FriendlyError("We couldn't reach the server to save this game.");
  }
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new FriendlyError(body?.error ?? "We couldn't save this game.");
}

/** Records a game the student walked away from. Works even while the page is closing. */
export function saveAbandonedGame(report: BotGameReport): void {
  if (!latestToken) return;
  send(report, latestToken, true).catch(() => {
    // Nothing more we can do while the page is going away.
  });
}

export async function fetchRecentGames(limit = 5): Promise<SavedGame[]> {
  const { data, error } = await supabase
    .from('bot_games')
    .select('id, game, bot_level, result, reason, finished_at')
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error || !data) throw new FriendlyError("We couldn't load your games.");
  return data as SavedGame[];
}

export async function fetchMyStats(): Promise<GameStats[]> {
  const { data, error } = await supabase.rpc('my_bot_game_stats');
  if (error || !data) throw new FriendlyError("We couldn't load your stats.");
  return data as GameStats[];
}
