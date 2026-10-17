import type { Outcome } from '../../shared/botGame';
import type { Card101GameReport, Card101Reason } from '../../shared/card101/save';
import type { PowerClashGameReport, PowerClashReason } from '../../shared/power-clash/save';
import type { BotGameReport, Reason as ChessReason } from '../../shared/chess/botGame';
import type { CheckersGameReport, Reason as CheckersReason } from '../../shared/checkers/botGame';
import type { SpaceGameReport, SpaceReason } from '../../shared/space/save';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

/** A finished game to send to the server, saying which game it is. */
export type SaveableReport = (BotGameReport & { game: 'chess' }) | (CheckersGameReport & { game: 'checkers' });

export type Reason = ChessReason | CheckersReason | SpaceReason | Card101Reason | PowerClashReason;

export interface SavedGame {
  id: string;
  game: string;
  bot_level: string;
  result: Outcome;
  reason: Reason;
  finished_at: string;
  /** Wormholes & Black Holes and 101 only: the student's place (null if they left early). */
  place?: number | null;
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

/** Games played from a stamped seed. */
type SeededGame = 'space' | '101' | 'power-clash';
type AnyReport = SaveableReport | SpaceGameReport | Card101GameReport | PowerClashGameReport;

function send(report: AnyReport | { game: SeededGame; start: true }, token: string, keepalive: boolean) {
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
  await saveReport(report);
}

/** Saves a finished Wormholes & Black Holes game. Says whether it earned points. */
export async function saveSpaceGame(report: SpaceGameReport): Promise<{ countsForPoints?: boolean }> {
  return (await saveReport(report)) as { countsForPoints?: boolean };
}

/** Saves a finished 101 game. Says whether it earned points. */
export async function save101Game(report: Card101GameReport): Promise<{ countsForPoints?: boolean }> {
  return (await saveReport(report)) as { countsForPoints?: boolean };
}

/** Saves a finished Power Clash match. Says whether it earned points. */
export async function savePowerClashGame(report: PowerClashGameReport): Promise<{ countsForPoints?: boolean }> {
  return (await saveReport(report)) as { countsForPoints?: boolean };
}

async function saveReport(report: AnyReport): Promise<unknown> {
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
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (response.ok) return body ?? {};
  throw new FriendlyError(body?.error ?? "We couldn't save this game.");
}

/** Records a game the student walked away from. Works even while the page is closing. */
export function saveAbandonedGame(report: AnyReport): void {
  if (!latestToken) return;
  send(report, latestToken, true).catch(() => {
    // Nothing more we can do while the page is going away.
  });
}

/** How long to wait for a seed before playing a practice game instead. */
export const SEED_WAIT_MS = 5000;

/**
 * Asks the server for a stamped seed for a Wormholes & Black Holes or 101 game. Null if it
 * can't be had (no Wi-Fi, signed out, server trouble): the game is then a practice game.
 */
export async function fetchSeed(game: SeededGame): Promise<{ seed: string; stamp: string } | null> {
  try {
    await refreshSaveToken();
    const token = latestToken;
    if (!token) return null;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SEED_WAIT_MS));
    const response = await Promise.race([send({ game, start: true }, token, false), timeout]);
    if (!response?.ok) return null;
    const body = (await response.json()) as { seed?: unknown; stamp?: unknown };
    return typeof body.seed === 'string' && typeof body.stamp === 'string' ? { seed: body.seed, stamp: body.stamp } : null;
  } catch {
    return null;
  }
}

export const fetchSpaceSeed = () => fetchSeed('space');
export const fetch101Seed = () => fetchSeed('101');
export const fetchPowerClashSeed = () => fetchSeed('power-clash');

export async function fetchRecentGames(limit = 5): Promise<SavedGame[]> {
  const { data, error } = await supabase
    .from('bot_games')
    .select('id, game, bot_level, result, reason, finished_at, place:space->place, card101Place:card101->place')
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error || !data) throw new FriendlyError("We couldn't load your games.");
  return (data as (SavedGame & { card101Place?: number | null })[]).map(({ card101Place, ...game }) =>
    game.game === '101' ? { ...game, place: card101Place ?? null } : game,
  );
}

export async function fetchMyStats(): Promise<GameStats[]> {
  const { data, error } = await supabase.rpc('my_bot_game_stats');
  if (error || !data) throw new FriendlyError("We couldn't load your stats.");
  return data as GameStats[];
}
