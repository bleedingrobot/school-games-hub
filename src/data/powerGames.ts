/**
 * Talking to the server about Power Clash games with a classmate.
 *
 * Reading uses the database directly (the rules there only let a student read the games
 * they're in). Every change goes to the "power-clash" server function, which runs the rules
 * and saves the result. The page never changes a game itself. Nothing is hidden in this game,
 * so the whole row is the same for both players.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { LiveGame } from '../../shared/power-clash/live';
import type { PowerClashStats } from '../../shared/power-clash/solo';
import type { GameEvent, PowerId } from '../../shared/power-clash/types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { MultiplayerError, RETRY_AFTER_MS, stillOpen, type LiveStatus } from './multiplayer';
import { FriendlyError } from './profile';

/** One classmates game: a row of the power_games table. */
export interface PowerGame {
  id: string;
  code: string | null;
  in_lobby: boolean;
  host: string | null;
  /** From the start: seat1 plays X and seat2 plays O. While waiting: in the order they joined. */
  seat1: string | null;
  seat2: string | null;
  first_player: string | null;
  /** Each seat's three powers; null until picked. */
  loadouts: [PowerId[] | null, PowerId[] | null];
  status: 'waiting' | 'playing' | 'finished' | 'cancelled' | 'expired';
  game: LiveGame | null;
  /** What the last change did, for the screen to animate. */
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

export const seatsOf = (g: Pick<PowerGame, 'seat1' | 'seat2'>): (string | null)[] => [g.seat1, g.seat2];

export interface PowerLobbyGame {
  id: string;
  creator_name: string;
  creator_avatar: unknown;
  created_at: string;
}

export type PowerAction =
  | { action: 'create'; lobby: boolean }
  | { action: 'join'; code: string }
  | { action: 'join'; gameId: string }
  | { action: 'cancel' | 'leave' | 'times-up' | 'rematch'; gameId: string }
  | { action: 'set-powers'; gameId: string; powers: PowerId[] }
  | { action: 'place'; gameId: string; version: number; square: number }
  | { action: 'use-power'; gameId: string; version: number; power: PowerId; targets: number[] }
  | { action: 'skip'; gameId: string; version: number }
  | { action: 'next'; gameId: string; round: number };

/** Refusals that, after a retry, just mean "your first try worked": look again quietly. */
const ALREADY_DONE = ['over', 'changed', 'not-your-turn', 'started'];

/**
 * Asks the server to do something. Returns the game as it is afterwards. Like the other
 * games, a request that hits a Wi-Fi drop or a Supabase hiccup is tried once more after a
 * second: moves carry the version they were made at, so the server never plays one twice.
 */
export async function askPower(request: PowerAction): Promise<PowerGame> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new MultiplayerError('Please sign in again.', 'sign-in');

  let reply = await send(request, token);
  const retried = reply === 'offline' || reply.status >= 502;
  if (retried) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
    reply = await send(request, token);
  }
  if (reply === 'offline') {
    throw new MultiplayerError('We couldn’t reach the server. Check the Wi-Fi and try again.', 'offline');
  }
  const body = (await reply.json().catch(() => null)) as {
    game?: PowerGame;
    error?: string;
    problem?: string;
    secondsLeft?: number;
  } | null;
  if (reply.ok && body?.game) return body.game;
  const problem = body?.problem ?? 'failed';
  if (retried && ALREADY_DONE.includes(problem)) {
    throw new MultiplayerError('The game changed just then. Have another look.', 'changed');
  }
  throw new MultiplayerError(body?.error ?? 'Something went wrong. Please try again.', problem, body?.secondsLeft);
}

async function send(request: PowerAction, token: string): Promise<Response | 'offline'> {
  try {
    return await fetch(`${SUPABASE_URL}/functions/v1/power-clash`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
  } catch {
    return 'offline';
  }
}

const COLUMNS =
  'id, code, in_lobby, host, seat1, seat2, first_player, loadouts, status, game, events, version, created_at, expires_at, ' +
  'started_at, deadline, last_action_at, finished_at, ending, leaver, won, counts, stats, rematch_game';
/** For lists: everything but the big parts. */
const LIST_COLUMNS =
  'id, code, in_lobby, host, seat1, seat2, loadouts, status, version, created_at, expires_at, started_at, finished_at, ending, ' +
  'leaver, won, counts, rematch_game';

export async function fetchPowerGame(id: string): Promise<PowerGame | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from('power_games').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new FriendlyError('We couldn’t load this game.');
  return data as PowerGame | null;
}

/** My Power Clash games that are waiting or still being played, newest first. */
export async function fetchMyOpenPowerGames(): Promise<PowerGame[]> {
  const { data, error } = await supabase
    .from('power_games')
    .select(LIST_COLUMNS)
    .in('status', ['waiting', 'playing'])
    .order('created_at', { ascending: false })
    .limit(10);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  return stillOpen(data as unknown as PowerGame[]);
}

/** My finished Power Clash games, newest first. */
export async function fetchRecentPowerGames(limit = 5): Promise<PowerGame[]> {
  const { data, error } = await supabase
    .from('power_games')
    .select(LIST_COLUMNS)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  return data as unknown as PowerGame[];
}

export async function fetchPowerLobby(): Promise<PowerLobbyGame[]> {
  const { data, error } = await supabase.rpc('power_lobby_games');
  if (error || !data) throw new FriendlyError('We couldn’t load the lobby.');
  return data as PowerLobbyGame[];
}

/** Matches finished with a classmate, and how many were won. */
export async function fetchMyPowerStats(): Promise<{ played: number; won: number }> {
  const { data, error } = await supabase.rpc('my_power_game_stats').maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load your stats.');
  return data as { played: number; won: number };
}

/**
 * Listens for changes to one game, and for who's here. Changes come on one channel; "who's
 * here" comes on a private one only the game's players can use (presence only, no messages).
 */
export function watchPowerGame(
  id: string,
  me: string,
  handlers: {
    onGame: (game: PowerGame) => void;
    onLive: (status: LiveStatus) => void;
    onPresent: (playerIds: string[] | null) => void;
  },
): { stop(): void } {
  const changes: RealtimeChannel = supabase
    .channel(`power-row:${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'power_games', filter: `id=eq.${id}` }, (payload) =>
      handlers.onGame(payload.new as PowerGame),
    )
    .subscribe((status) => {
      handlers.onLive(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'connecting' : 'down');
    });

  const here: RealtimeChannel = supabase.channel(`power-game:${id}`, {
    config: { private: true, presence: { key: me, enabled: true } },
  });
  here
    .on('presence', { event: 'sync' }, () => handlers.onPresent(Object.keys(here.presenceState())))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void here.track({ here: true });
      else handlers.onPresent(null);
    });

  return {
    stop() {
      void supabase.removeChannel(changes);
      void supabase.removeChannel(here);
    },
  };
}
