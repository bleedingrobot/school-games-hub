/**
 * Talking to the server about Wormholes & Black Holes games with classmates.
 *
 * Reading uses the database directly (the rules there only let a student read the games
 * they're in). Every change goes to the "space-game" server function, which rolls the dice,
 * runs the rules and saves the result. The page never changes a game itself.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { BoardChoice } from '../../shared/space/boards';
import type { Settings, SpaceEvent, SpaceState } from '../../shared/space/engine';
import type { LiveSetup, LoggedAction, Reaction, SeatInfo } from '../../shared/space/live';
import { parseMathsSwitch, type MathsSwitch } from '../../shared/space/mathsSwitch';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { readSettings } from './classSettings';
import { supabase } from '../lib/supabase';
import { MultiplayerError, RETRY_AFTER_MS, stillOpen, type LiveStatus } from './multiplayer';
import { FriendlyError } from './profile';

/** One classmates game: a row of the space_games table. */
export interface SpaceGame {
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

export const seatsOf = (g: Pick<SpaceGame, 'seat1' | 'seat2' | 'seat3' | 'seat4'>): (string | null)[] => [
  g.seat1,
  g.seat2,
  g.seat3,
  g.seat4,
];

export interface SpaceLobbyGame {
  id: string;
  creator_name: string;
  creator_avatar: unknown;
  players: number;
  board: BoardChoice;
  mode: Settings['mode'];
  created_at: string;
}

export type SpaceAction =
  | { action: 'create'; setup: LiveSetup; lobby: boolean }
  | { action: 'join'; code: string }
  | { action: 'join'; gameId: string }
  | { action: 'cancel' | 'leave' | 'times-up' | 'take-controls' | 'rematch'; gameId: string }
  | { action: 'launch'; gameId: string; bots: number }
  | { action: 'roll'; gameId: string; version: number }
  | { action: 'use-item'; gameId: string; version: number; item: string; target?: number; value?: number }
  | { action: 'choose'; gameId: string; version: number; option: number }
  /** Mission Control maths: ask for my question, then answer it with the number (the server marks it). */
  | { action: 'question'; gameId: string; kind: 'moment' | 'charge'; version?: number }
  | { action: 'answer'; gameId: string; kind: 'moment' | 'charge'; answer: number; ms: number; version?: number }
  | { action: 'react'; gameId: string; emoji: Reaction };

/** Refusals that, after a retry, just mean "your first try worked": look again quietly. */
const ALREADY_DONE = ['over', 'changed', 'not-your-turn', 'reaction-wait'];

/**
 * Asks the server to do something. Returns the game as it is afterwards. Like friend games,
 * a request that hits a Wi-Fi drop or a Supabase hiccup is tried once more after a second:
 * moves carry the version they were made at, so the server never plays one twice.
 */
export async function askSpace(request: SpaceAction): Promise<SpaceGame> {
  return (await askSpaceFull(request)).game;
}

/** What the server sends back for a maths question: the question (no answer), or how the answer went. */
export interface SpaceMathsReply {
  game: SpaceGame;
  /** The question to show (an `answer` is never sent with it). */
  question?: { id: number; skill: string; kind: string; parts: string[]; spoken: string; choices?: number[]; choiceLabels?: string[]; input?: 'whole' | 'decimal'; maxLength?: number };
  /** The question after a turn was already answered. */
  done?: boolean;
  /** For an answer: was it right, and what was the answer. */
  right?: boolean;
  answer?: number;
}

/** Like askSpace, but also returns whatever else the server said (a maths question, or the marking). */
export async function askSpaceFull(request: SpaceAction): Promise<SpaceMathsReply> {
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
  const body = (await reply.json().catch(() => null)) as (Partial<SpaceMathsReply> & {
    error?: string;
    problem?: string;
    secondsLeft?: number;
  }) | null;
  if (reply.ok && body?.game) return body as SpaceMathsReply;
  const problem = body?.problem ?? 'failed';
  if (retried && ALREADY_DONE.includes(problem)) {
    throw new MultiplayerError('The game changed just then. Have another look.', 'changed');
  }
  throw new MultiplayerError(body?.error ?? 'Something went wrong. Please try again.', problem, body?.secondsLeft);
}

async function send(request: SpaceAction, token: string): Promise<Response | 'offline'> {
  try {
    return await fetch(`${SUPABASE_URL}/functions/v1/space-game`, {
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
  'id, code, in_lobby, host, seat1, seat2, seat3, seat4, status, setup, rockets, seat_info, state, events, actions, version, ' +
  'created_at, expires_at, started_at, turn_deadline, last_action_at, finished_at, ending, places, counts, reactions, rematch_game';
/** For lists: everything but the big parts. */
const LIST_COLUMNS =
  'id, code, in_lobby, host, seat1, seat2, seat3, seat4, status, setup, rockets, seat_info, version, created_at, expires_at, ' +
  'started_at, finished_at, ending, places, counts, rematch_game';

export async function fetchSpaceGame(id: string): Promise<SpaceGame | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from('space_games').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new FriendlyError('We couldn’t load this game.');
  return data as SpaceGame | null;
}

/** My space games that are waiting or still being played, newest first. */
export async function fetchMyOpenSpaceGames(): Promise<SpaceGame[]> {
  const { data, error } = await supabase
    .from('space_games')
    .select(LIST_COLUMNS)
    .in('status', ['waiting', 'playing'])
    .order('created_at', { ascending: false })
    .limit(10);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  return stillOpen(data as unknown as SpaceGame[]);
}

/** My finished space games, newest first. */
export async function fetchRecentSpaceGames(limit = 5): Promise<SpaceGame[]> {
  const { data, error } = await supabase
    .from('space_games')
    .select(LIST_COLUMNS)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error || !data) throw new FriendlyError('We couldn’t load your games.');
  return data as unknown as SpaceGame[];
}

export async function fetchSpaceLobby(): Promise<SpaceLobbyGame[]> {
  const { data, error } = await supabase.rpc('space_lobby_games');
  if (error || !data) throw new FriendlyError('We couldn’t load the lobby.');
  return data as SpaceLobbyGame[];
}

/** Classmates games finished, and 1st places. */
export async function fetchMySpaceStats(): Promise<{ played: number; firsts: number }> {
  const { data, error } = await supabase.rpc('my_space_game_stats').maybeSingle();
  if (error || !data) throw new FriendlyError('We couldn’t load your stats.');
  return data as { played: number; firsts: number };
}

/** Is a teacher letting students send emoji reactions in space games? */
export async function fetchReactionsEnabled(classId?: string | null): Promise<boolean> {
  const data = await readSettings(['space_reactions_enabled'], classId);
  return data?.space_reactions_enabled === true;
}

/** What the teacher allows for Mission Control maths. If it can't be read, maths stays off. */
export async function fetchMathsSwitch(classId?: string | null): Promise<MathsSwitch> {
  const data = await readSettings(['space_maths'], classId);
  return parseMathsSwitch(data?.space_maths);
}

export interface SpaceLogEntry {
  version: number;
  events: SpaceEvent[];
}

/** What happened in a game since `afterVersion` (oldest first), at most `limit` changes. */
export async function fetchSpaceLog(id: string, afterVersion: number, limit = 40): Promise<SpaceLogEntry[]> {
  const { data, error } = await supabase
    .from('space_game_log')
    .select('version, events')
    .eq('game', id)
    .gt('version', afterVersion)
    .order('version', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as SpaceLogEntry[]).reverse();
}

/**
 * Listens for changes to one game, and for who's here. Changes come on one channel; "who's
 * here" comes on a private one only the game's players can use (presence only, no messages).
 */
export function watchSpaceGame(
  id: string,
  me: string,
  handlers: {
    onGame: (game: SpaceGame) => void;
    onLive: (status: LiveStatus) => void;
    onPresent: (playerIds: string[] | null) => void;
  },
): { stop(): void } {
  const changes: RealtimeChannel = supabase
    .channel(`space-row:${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'space_games', filter: `id=eq.${id}` }, (payload) =>
      handlers.onGame(payload.new as SpaceGame),
    )
    .subscribe((status) => {
      handlers.onLive(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'connecting' : 'down');
    });

  const here: RealtimeChannel = supabase.channel(`space-game:${id}`, {
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
