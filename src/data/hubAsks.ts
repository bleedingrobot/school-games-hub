/**
 * Challenges from anywhere in the hub (docs/plans/play-anyone/PLAN.md, section D1, stage 2).
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

/** The games whose challenges can pop up anywhere in the hub, by their page id. */
export const ASK_GAMES = ['archery', 'dragon-maths', 'clan-quest'] as const;
export type AskGame = (typeof ASK_GAMES)[number];

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
  /** Hears my challenges as they change. Returns the way to stop. */
  watch(me: string, onHeard: (heard: HeardAsk) => void): () => void;
  /** How far the server's clock is ahead of this device's (ms). */
  clockOffset(): Promise<number>;
}

const isAskGame = (g: unknown): g is AskGame => typeof g === 'string' && (ASK_GAMES as readonly string[]).includes(g);

const TABLES: Record<AskGame, string> = { archery: 'archery_duels', 'dragon-maths': 'lord_clashes', 'clan-quest': 'clan_duels' };

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
    if (ask.game === 'archery') {
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
  watch(me, onHeard) {
    let channel: RealtimeChannel = supabase.channel(`hub-asks:${me}`);
    for (const game of ASK_GAMES) {
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
