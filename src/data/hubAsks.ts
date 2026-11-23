/**
 * Challenges from anywhere in the hub (docs/plans/play-anyone/PLAN.md, section D1, stage 2), and invites by name to the
 * board games (stage 4: one table, `board_invites`, read through its own rule and heard live the same way).
 *
 * - `hub_here()` says "I'm here" for the hub (so friends can challenge me even when I'm not in their game) and tells me
 *   which games have a challenge waiting for me. Nothing about anyone else comes back.
 * - The challenges themselves come from each game's own "here" function (archery_here, lord_here, clan_duel_here), only
 *   for a game that has one waiting, and live through Realtime on the three challenge tables (only my own rows reach me).
 * - "No" goes through that game's own server step, the same one its pop-up uses.
 *
 * Each game's data module is loaded only when it's needed, so the hub page stays light.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchClockOffset } from './multiplayer';

/** The live games whose challenges can pop up anywhere in the hub, by their page id. */
export const LIVE_GAMES = ['archery', 'dragon-maths', 'clan-quest'] as const;
export type LiveGame = (typeof LIVE_GAMES)[number];
/** The board games a kid can be invited to by name (stage 4), by their game id. */
export const INVITE_GAMES = ['chess', 'checkers', '101', 'space', 'power-clash'] as const;
export type InviteGame = (typeof INVITE_GAMES)[number];
/** Everything that can ask a kid to play: the live games' challenges and the board games' invites. */
/** Class-wide games (not duel tables): a teacher opens one and the whole class is asked to join. */
export const CLASS_GAMES = ['showdown', 'classlive'] as const;
export type ClassGame = (typeof CLASS_GAMES)[number];
export const ASK_GAMES = [...LIVE_GAMES, ...INVITE_GAMES, ...CLASS_GAMES] as const;
export type AskGame = LiveGame | InviteGame | ClassGame;

/** The games the Lobby can ask about: everything but the class-wide ones. */
export type LobbyGame = Exclude<AskGame, ClassGame>;

export const isInviteGame = (g: unknown): g is InviteGame => typeof g === 'string' && (INVITE_GAMES as readonly string[]).includes(g);

export const isClassGame = (g: unknown): g is ClassGame => typeof g === 'string' && (CLASS_GAMES as readonly string[]).includes(g);

export interface HubAsk {
  game: AskGame;
  /** The fight, clash or duel id in that game. */
  id: number;
  /** Who it's from: a pupil's name, or a clan's name in Clan Quest. */
  from: string;
  deadline: string;
}

/** A change heard live: a new challenge, or one that's no longer waiting (answered, called off, run out). */
export type HeardAsk = { ask: HubAsk } | { gone: { game: AskGame; id: number } };

export interface HubAskLink {
  /** "I'm here" for the hub. The games with a challenge waiting for me, or null if the server couldn't be reached. */
  checkIn(): Promise<AskGame[] | null>;
  /** The challenges waiting for me in one game (from that game's own "here"), or null if it couldn't be read. */
  asksIn(game: AskGame): Promise<HubAsk[] | null>;
  /** Says no, through that game's own server step. */
  decline(ask: HubAsk): Promise<void>;
  /** Yes to a board game invite: the game's own server makes the game. Where it is, or why not in the pupil's words. */
  accept(ask: HubAsk): Promise<{ path: string } | { problem: string }>;
  /** Hears my challenges as they change. Returns the way to stop. */
  watch(me: string, onHeard: (heard: HeardAsk) => void): () => void;
  /** How far the server's clock is ahead of this device's (ms). */
  clockOffset(): Promise<number>;
}

const isAskGame = (g: unknown): g is AskGame => typeof g === 'string' && (ASK_GAMES as readonly string[]).includes(g);

const TABLES: Record<LiveGame, string> = { archery: 'archery_duels', 'dragon-maths': 'lord_clashes', 'clan-quest': 'clan_duels' };

/** A challenge row heard through Realtime, as an ask (or gone, once it isn't waiting any more). */
export function heardFrom(game: AskGame, row: unknown): HeardAsk | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as { id?: unknown; status?: unknown; name_a?: unknown; deadline?: unknown };
  const id = Number(r.id);
  if (!Number.isSafeInteger(id)) return null;
  if (r.status === 'asked' && typeof r.name_a === 'string' && typeof r.deadline === 'string') return { ask: { game, id, from: r.name_a, deadline: r.deadline } };
  return { gone: { game, id } };
}

export const serverHubAskLink: HubAskLink = {
  async checkIn() {
    try {
      const { data, error } = await supabase.rpc('hub_here');
      if (error || !data || typeof data !== 'object') return null;
      const waiting = (data as { waiting?: unknown }).waiting;
      return Array.isArray(waiting) ? waiting.filter(isAskGame) : [];
    } catch {
      return null;
    }
  },
  async asksIn(game) {
    if (isInviteGame(game)) {
      // Only invites sent to me can be read (the table's rule).
      const { data, error } = await supabase
        .from('board_invites')
        .select('id, game, status, name_a, deadline')
        .eq('status', 'asked')
        .eq('game', game)
        .gt('deadline', new Date(Date.now() + (await fetchClockOffset().catch(() => 0))).toISOString());
      if (error || !Array.isArray(data)) return null;
      return data.flatMap((row) => {
        const heard = heardFrom(game, row);
        return heard && 'ask' in heard ? [heard.ask] : [];
      });
    }
    if (isClassGame(game)) {
      const { data, error } = await supabase.rpc(game === 'classlive' ? 'classlive_here' : 'showdown_here');
      if (error || !Array.isArray(data)) return null;
      return data.flatMap((r: { room?: unknown; class?: unknown; until?: unknown }) =>
        Number.isSafeInteger(Number(r?.room)) && typeof r.until === 'string'
          ? [{ game, id: Number(r.room), from: typeof r.class === 'string' ? r.class : 'your class', deadline: r.until }]
          : [],
      );
    }
    if (game === 'archery') {
      const { serverDuelLink } = await import('./archery');
      const r = await serverDuelLink.here();
      if (!r) return null;
      return r.asks.map((a) => ({ game, id: a.duel, from: a.from, deadline: a.deadline }));
    }
    if (game === 'dragon-maths') {
      const { sayHere } = await import('./lordClash');
      const r = await sayHere();
      if (!r) return null;
      return r.off ? [] : r.asks.map((a) => ({ game, id: a.clash, from: a.from, deadline: a.deadline }));
    }
    const { sayDuelHere } = await import('./clanDuel');
    const r = await sayDuelHere();
    if (!r) return null;
    return r.off ? [] : r.asks.map((a) => ({ game, id: a.duel, from: a.from, deadline: a.deadline }));
  },
  async decline(ask) {
    if (isClassGame(ask.game)) return; // nothing to tell the server: it just hides
    if (isInviteGame(ask.game)) {
      await supabase.rpc('board_invite_decline', { invite: ask.id });
    } else if (ask.game === 'archery') {
      const { archeryApi, serverTransport } = await import('./archery');
      await archeryApi(serverTransport).duelAnswer(ask.id, false);
    } else if (ask.game === 'dragon-maths') {
      const { sendClash } = await import('./lordClash');
      await sendClash({ action: 'clash-answer', clash: ask.id, accept: false });
    } else {
      const { sendDuel } = await import('./clanDuel');
      await sendDuel({ action: 'duel-answer', duel: ask.id, accept: false });
    }
  },
  async accept(ask) {
    if (!isInviteGame(ask.game)) return { problem: 'That couldn’t be opened.' };
    const { acceptInvite } = await import('./boardInvites');
    return acceptInvite(ask.game, ask.id);
  },
  watch(me, onHeard) {
    let channel: RealtimeChannel = supabase.channel(`hub-asks:${me}`);
    // Board game invites sent to me: one table, the game is in the row.
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'board_invites', filter: `seat_b=eq.${me}` }, (payload: { new?: unknown }) => {
      const game = (payload.new as { game?: unknown } | undefined)?.game;
      const heard = isInviteGame(game) ? heardFrom(game, payload.new) : null;
      if (heard) onHeard(heard);
    });
    // Class Showdown and Class Live rooms in my class (the table's rule limits which rows reach me).
    for (const game of CLASS_GAMES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: `${game}_rooms` }, (payload: { new?: unknown }) => {
        const r = payload.new as { id?: unknown; state?: unknown } | undefined;
        const id = Number(r?.id);
        if (!r || !Number.isSafeInteger(id)) return;
        if (r.state === 'lobby' || r.state === 'live') onHeard({ ask: { game, id, from: 'your class', deadline: new Date(Date.now() + 3 * 3600_000).toISOString() } });
        else onHeard({ gone: { game, id } });
      });
    }
    for (const game of LIVE_GAMES) {
      // Only challenges sent to me (Realtime checks each table's rule too, so only my own rows arrive).
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLES[game], filter: `seat_b=eq.${me}` }, (payload: { new?: unknown }) => {
        const heard = heardFrom(game, payload.new);
        if (heard) onHeard(heard);
      });
    }
    channel.subscribe();
    return () => void supabase.removeChannel(channel);
  },
  clockOffset: () => fetchClockOffset(),
};
