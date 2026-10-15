/**
 * Talking to the server about 101 games with classmates.
 *
 * The whole game (the stack, everyone's cards) is in a table no student can read. Each
 * player reads only their own seat row (card_game_seats), which holds what they may know:
 * see shared/card101/live.ts. Every change goes to the "card-game" server function, which
 * shuffles, referees and writes every seat row. The page never changes a game itself.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SeatRow } from '../../shared/card101/live';
import type { Slot } from '../../shared/card101/cards';
import type { Target } from '../../shared/card101/engine';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { MultiplayerError, RETRY_AFTER_MS, type LiveStatus } from './multiplayer';
import { FriendlyError } from './profile';

export type { SeatRow };

export interface CardLobbyGame {
  id: string;
  creator_name: string;
  creator_avatar: unknown;
  players: number;
  wanted: number;
  target: number;
  created_at: string;
}

export type CardAction =
  | { action: 'create'; players: number; settings: { target: Target }; lobby: boolean }
  | { action: 'join'; code: string }
  | { action: 'join'; gameId: string }
  | { action: 'cancel' | 'leave' | 'start' | 'peek-done' | 'next' | 'times-up' | 'rematch'; gameId: string }
  | { action: 'draw'; gameId: string; version: number; from: 'stack' | 'discard' }
  | { action: 'swap'; gameId: string; version: number; slot: Slot }
  | { action: 'throw' | 'knock'; gameId: string; version: number };

/** Refusals that, after a retry, just mean "your first try worked": look again quietly. */
const ALREADY_DONE = ['over', 'changed', 'illegal'];

/**
 * Asks the server to do something. Returns my seat row afterwards. Like the other games, a
 * request that hits a Wi-Fi drop or a Supabase hiccup is tried once more after a second:
 * moves carry the version they were made at, so the server never plays one twice.
 */
export async function askCard(request: CardAction): Promise<SeatRow> {
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
    seat?: SeatRow;
    error?: string;
    problem?: string;
    secondsLeft?: number;
  } | null;
  if (reply.ok && body?.seat) return body.seat;
  const problem = body?.problem ?? 'failed';
  if (retried && ALREADY_DONE.includes(problem)) {
    throw new MultiplayerError('The game changed just then. Have another look.', 'changed');
  }
  throw new MultiplayerError(body?.error ?? 'Something went wrong. Please try again.', problem, body?.secondsLeft);
}

async function send(request: CardAction, token: string): Promise<Response | 'offline'> {
  try {
    return await fetch(`${SUPABASE_URL}/functions/v1/card-game`, {
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

const COLUMNS = 'game, player, seat, version, status, info, view, events, log';
/** For lists: no cards. */
const LIST_COLUMNS = 'game, player, seat, version, status, info, updated_at';

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/** My seat in a game (only my own row is readable), or null if I'm not in it. */
export async function fetchMySeat(gameId: string, me: string): Promise<SeatRow | null> {
  if (!isUuid(gameId)) return null;
  const { data, error } = await supabase.from('card_game_seats').select(COLUMNS).eq('game', gameId).eq('player', me).maybeSingle();
  if (error) throw new FriendlyError('We couldn’t load this game.');
  return data as SeatRow | null;
}

export type SeatSummary = Omit<SeatRow, 'view' | 'events' | 'log'> & { updated_at: string };

/** My 101 games that are waiting or still being played, newest first. */
export async function fetchMyOpenCardGames(): Promise<SeatSummary[]> {
  const { data, error } = await supabase
    .from('card_game_seats')
    .select(LIST_COLUMNS)
    .in('status', ['waiting', 'playing'])
    .order('updated_at', { ascending: false })
    .limit(10);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  const now = Date.now();
  return (data as SeatSummary[]).filter((s) => s.status === 'playing' || Date.parse(s.info.expiresAt) > now);
}

/** My finished 101 games with classmates, newest first. */
export async function fetchRecentCardGames(limit = 5): Promise<SeatSummary[]> {
  const { data, error } = await supabase
    .from('card_game_seats')
    .select(LIST_COLUMNS)
    .eq('status', 'finished')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  return data as SeatSummary[];
}

export async function fetchCardLobby(): Promise<CardLobbyGame[]> {
  const { data, error } = await supabase.rpc('card_lobby_games');
  if (error || !data) throw new FriendlyError('We couldn’t load the lobby.');
  return data as CardLobbyGame[];
}

/** 101 games finished with classmates, and wins. */
export async function fetchMyCardStats(): Promise<{ played: number; won: number }> {
  const { data, error } = await supabase.rpc('my_card_game_stats').maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load your stats.');
  return data as { played: number; won: number };
}

/**
 * Listens for changes to my seat in one game, and for who's here. Realtime only ever sends
 * me my own seat row (the database's row rule); "who's here" comes on a private channel only
 * the game's players can use (presence only, no messages).
 */
export function watchCardGame(
  id: string,
  me: string,
  handlers: {
    onSeat: (seat: SeatRow) => void;
    onLive: (status: LiveStatus) => void;
    onPresent: (playerIds: string[] | null) => void;
  },
): { stop(): void } {
  const changes: RealtimeChannel = supabase
    .channel(`card-seat:${id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'card_game_seats', filter: `game=eq.${id}` },
      (payload) => {
        const row = payload.new as SeatRow | undefined;
        if (row?.player === me) handlers.onSeat(row);
      },
    )
    .subscribe((status) => {
      handlers.onLive(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'connecting' : 'down');
    });

  const here: RealtimeChannel = supabase.channel(`card-game:${id}`, {
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
