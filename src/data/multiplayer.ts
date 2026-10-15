/**
 * Talking to the server about games against friends.
 *
 * Reading uses the database directly (the rules there only let a student read the games
 * they're playing in). Every change goes to the "multiplayer" server function, which
 * checks it and saves it. The page never changes a game itself.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameKind, Side } from '../../shared/multiplayer';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

/** One game between two students: a row of the mp_games table. */
export interface FriendGame {
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
  winner: Side | null;
  reason: string | null;
  counts_for_points: boolean | null;
  finished_at: string | null;
  first_wants_rematch: boolean;
  second_wants_rematch: boolean;
  rematch_game: string | null;
}

export interface LobbyGame {
  id: string;
  game: GameKind;
  creator_name: string;
  creator_avatar: unknown;
  /** The side you'd play if you joined. */
  open_side: Side;
  created_at: string;
}

export interface PlayerCard {
  id: string;
  display_name: string;
  avatar: unknown;
}

/** A refusal from the server, with its reason code (e.g. 'not-yet') for the page to act on. */
export class MultiplayerError extends FriendlyError {
  constructor(
    message: string,
    readonly problem: string,
    readonly secondsLeft?: number,
  ) {
    super(message);
  }
}

export type Action =
  | { action: 'create'; game: GameKind; side: Side | 'random'; lobby: boolean }
  | { action: 'join'; code: string }
  | { action: 'join'; gameId: string }
  | { action: 'cancel' | 'resign' | 'offer-draw' | 'claim-win' | 'rematch'; gameId: string }
  | { action: 'move'; gameId: string; move: string; ply: number }
  | { action: 'answer-draw'; gameId: string; accept: boolean };

/** How long to wait before trying a request again after the network or the server hiccups. */
export const RETRY_AFTER_MS = 1000;

/** Refusals that, after a retry, just mean "your first try worked": look again quietly. */
const ALREADY_DONE = ['over', 'changed', 'no-offer'];

/**
 * Asks the server to do something. Returns the game as it is afterwards.
 *
 * On patchy school Wi-Fi, or when Supabase hiccups while starting the function up (it
 * happened a few times on 15 Oct 2026), the request is tried once more after a second.
 * That's safe: every move says which move number it is, so the server never plays it
 * twice, and the other actions do nothing the second time. If the first try did get
 * through, the second gets "already done", which is treated as "look at the game again".
 */
export async function ask(request: Action): Promise<FriendGame> {
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
    game?: FriendGame;
    error?: string;
    problem?: string;
    secondsLeft?: number;
  } | null;
  if (reply.ok && body?.game) return body.game;
  const problem = body?.problem ?? 'failed';
  if (retried && request.action === 'join' && (problem === 'not-found' || problem === 'full')) {
    // The first try may have joined: if so, that's the game to go to.
    const joined = await recentlyJoined();
    if (joined) return joined;
  }
  if (retried && ALREADY_DONE.includes(problem)) {
    throw new MultiplayerError('The game changed just then. Have another look.', 'changed');
  }
  throw new MultiplayerError(body?.error ?? 'Something went wrong. Please try again.', problem, body?.secondsLeft);
}

async function send(request: Action, token: string): Promise<Response | 'offline'> {
  try {
    return await fetch(`${SUPABASE_URL}/functions/v1/multiplayer`, {
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

/** A game I started playing in the last minute, if there is one. */
async function recentlyJoined(): Promise<FriendGame | null> {
  try {
    const games = await fetchMyOpenGames();
    const now = Date.now();
    return games.find((g) => g.status === 'playing' && g.started_at && now - Date.parse(g.started_at) < 60_000) ?? null;
  } catch {
    return null;
  }
}

const COLUMNS =
  'id, game, code, in_lobby, created_by, first_player, second_player, status, moves, version, created_at, expires_at, ' +
  'started_at, turn_started_at, draw_offer, first_draw_offers, second_draw_offers, winner, reason, counts_for_points, ' +
  'finished_at, first_wants_rematch, second_wants_rematch, rematch_game';

export async function fetchFriendGame(id: string): Promise<FriendGame | null> {
  const { data, error } = await supabase.from('mp_games').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new FriendlyError('We couldn’t load this game.');
  return data as FriendGame | null;
}

/** My games that are waiting for a friend or still being played, newest first. */
export async function fetchMyOpenGames(): Promise<FriendGame[]> {
  const { data, error } = await supabase
    .from('mp_games')
    .select(COLUMNS)
    .in('status', ['waiting', 'playing'])
    .order('created_at', { ascending: false })
    .limit(10);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  const now = Date.now();
  // A waiting game past its time is on its way out; don't offer it.
  return (data as unknown as FriendGame[]).filter((g) => g.status === 'playing' || Date.parse(g.expires_at) > now);
}

export async function fetchRecentFriendGames(limit = 5): Promise<FriendGame[]> {
  const { data, error } = await supabase
    .from('mp_games')
    .select(COLUMNS)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  return data as unknown as FriendGame[];
}

export async function fetchLobby(): Promise<LobbyGame[]> {
  const { data, error } = await supabase.rpc('lobby_games');
  if (error || !data) throw new FriendlyError('We couldn’t load the lobby.');
  return data as LobbyGame[];
}

/** Is playing friends switched on? (The teacher can switch it off for everyone.) */
export async function fetchMultiplayerEnabled(): Promise<boolean> {
  const { data, error } = await supabase.from('app_settings').select('multiplayer_enabled').maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load the lobby.');
  return data.multiplayer_enabled as boolean;
}

export interface FriendStats {
  game: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
}

export async function fetchFriendStats(): Promise<FriendStats[]> {
  const { data, error } = await supabase.rpc('my_friend_game_stats');
  if (error || !data) throw new FriendlyError('We couldn’t load your stats.');
  return data as FriendStats[];
}

/** Names and avatars for these players. Hidden players are left out. */
export async function fetchPlayerCards(ids: string[]): Promise<Map<string, PlayerCard>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, display_name, avatar').in('id', wanted);
  if (error || !data) return new Map();
  return new Map((data as PlayerCard[]).map((p) => [p.id, p]));
}

/** How far the server's clock is ahead of this device's, in milliseconds. */
export async function fetchClockOffset(): Promise<number> {
  const sent = Date.now();
  const { data, error } = await supabase.rpc('server_time');
  const received = Date.now();
  if (error || typeof data !== 'string') return 0;
  return Date.parse(data) - (sent + received) / 2;
}

export type LiveStatus = 'connecting' | 'live' | 'down';

export interface GameWatch {
  stop(): void;
}

/**
 * Listens for changes to one game, and for whether the other player is here.
 * The game's changes come on one channel; "who's here" comes on a private one that only
 * the two players can use.
 */
export function watchGame(
  id: string,
  me: string,
  handlers: {
    onGame: (game: FriendGame) => void;
    onLive: (status: LiveStatus) => void;
    /** Who's here, or null while we can't tell (the channel isn't connected). */
    onPresent: (playerIds: string[] | null) => void;
  },
): GameWatch {
  const changes: RealtimeChannel = supabase
    .channel(`mp-row:${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mp_games', filter: `id=eq.${id}` }, (payload) =>
      handlers.onGame(payload.new as FriendGame),
    )
    .subscribe((status) => {
      handlers.onLive(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'connecting' : 'down');
    });

  const here: RealtimeChannel = supabase.channel(`mp-game:${id}`, {
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
