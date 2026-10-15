import type { Outcome } from '../../shared/botGame';
import type { BotGameReport, Reason as ChessReason } from '../../shared/chess/botGame';
import type { CheckersGameReport, Reason as CheckersReason } from '../../shared/checkers/botGame';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

/** A finished game to send to the server, saying which game it is. */
export type SaveableReport = (BotGameReport & { game: 'chess' }) | (CheckersGameReport & { game: 'checkers' });

export type Reason = ChessReason | CheckersReason;

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

function send(report: SaveableReport, token: string, keepalive: boolean) {
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

/** How long to wait before trying a save again after the network or the server hiccups. */
export const RETRY_AFTER_MS = 1000;

/**
 * Sends a finished game to the server, which checks it and saves it. After a Wi-Fi blip or
 * a server hiccup it tries once more. That's safe: the server spots a game it has already
 * saved and doesn't save or score it twice.
 */
export async function saveBotGame(report: SaveableReport): Promise<void> {
  await refreshSaveToken();
  const token = latestToken;
  if (!token) throw new FriendlyError('Please sign in again to save your games.');
  const attempt = () => send(report, token, false).catch(() => 'offline' as const);
  let response = await attempt();
  if (response === 'offline' || response.status >= 502) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
    response = await attempt();
  }
  if (response === 'offline') throw new FriendlyError("We couldn't reach the server to save this game.");
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new FriendlyError(body?.error ?? "We couldn't save this game.");
}

/** Records a game the student walked away from. Works even while the page is closing. */
export function saveAbandonedGame(report: SaveableReport): void {
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
