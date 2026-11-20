/**
 * Dragon Maths live arena clashes: talking to the server (shared/lord/clashServer.ts, migration
 * 20261117000200_lord_live_arena.sql). "I'm here" and the cheers are database functions a pupil may call; everything that
 * plays the clash goes to the `lord` server function; both screens hear each change through Realtime on the clash row.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ClashMove } from '../../shared/lord/clash';
import type { ClashRow } from '../../shared/lord/clashServer';
import type { AskTicket } from '../../shared/lord/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { readClassBits } from '../components/SchoolPlayerList';
import { fetchClockOffset, type LiveStatus } from './multiplayer';

export type { ClashRow, LiveStatus };

export interface ClashClassmate {
  id: string;
  name: string;
  avatar: unknown;
  busy: boolean;
  /** In my class; otherwise className says which class they're in. */
  sameClass: boolean;
  className: string | null;
  /** I starred them (stage 8: only I can see it). */
  starred?: boolean;
}

export interface ClashAsk {
  clash: number;
  from: string;
  deadline: string;
}

export type Here = { off: true } | { off: false; online: ClashClassmate[]; asks: ClashAsk[]; clash: ClashRow | null };

/** "I'm here", and who else is. Null if it couldn't reach the server. */
export async function sayHere(): Promise<Here | null> {
  try {
    const { data, error } = await supabase.rpc('lord_here');
    if (error || !data || typeof data !== 'object') return null;
    const d = data as { off?: boolean; online?: ClashClassmate[]; asks?: ClashAsk[]; clash?: ClashRow | null };
    if (d.off) return { off: true };
    return { off: false, online: Array.isArray(d.online) ? d.online.map((o) => ({ ...o, ...readClassBits(o as unknown as Record<string, unknown>) })) : [], asks: Array.isArray(d.asks) ? d.asks : [], clash: d.clash ?? null };
  } catch {
    return null;
  }
}

export type ClashRequest =
  | { action: 'clash-challenge'; other: string }
  | { action: 'clash-answer'; clash: number; accept: boolean }
  | { action: 'clash-pick'; clash: number; round: number; move: ClashMove; proof: AskTicket | null }
  | { action: 'clash-times-up' | 'clash-leave'; clash: number };

/** What a clash request came to: the clash as it now is, and words for the pupil when it was turned down. */
export type ClashResult = { ok: true; clash: ClashRow | null } | { ok: false; message: string; code?: string; clash?: ClashRow };

/** Sends one clash request to the server function. Tried once more after a second if the network hiccups. */
export async function sendClash(request: ClashRequest): Promise<ClashResult> {
  const once = async (): Promise<ClashResult | 'offline'> => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return { ok: false, message: 'Please sign in again.' };
      const response = await fetch(`${SUPABASE_URL}/functions/v1/lord`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (response.status >= 502) return 'offline';
      const body = (await response.json().catch(() => null)) as { clash?: ClashRow; error?: string; code?: string } | null;
      if (response.ok) return { ok: true, clash: body?.clash ?? null };
      return { ok: false, message: body?.error ?? 'That couldn’t be done just now.', code: body?.code, clash: body?.clash };
    } catch {
      return 'offline';
    }
  };
  let out = await once();
  if (out === 'offline') {
    await new Promise((r) => setTimeout(r, 1000));
    out = await once();
  }
  return out === 'offline' ? { ok: false, message: 'We couldn’t reach the server. Check the Wi-Fi and try again.', code: 'offline' } : out;
}

export type Cheer = 'good-fight' | 'well-played' | 'again';

/** One cheer at the end of a clash. */
export async function sendCheer(clash: number, cheer: Cheer): Promise<ClashRow | null> {
  const { data, error } = await supabase.rpc('lord_clash_cheer', { clash, cheer });
  return error || !data ? null : (data as ClashRow);
}

/** Hears every change to this pupil's clashes (sent or received). Returns the way to stop. */
export function watchClashes(me: string, onRow: (row: ClashRow) => void, onLive: (status: LiveStatus) => void): () => void {
  const heard = (payload: { new?: unknown }) => {
    const row = payload.new as ClashRow | undefined;
    if (row && Number.isSafeInteger(Number(row.id))) onRow(row);
  };
  const channel: RealtimeChannel = supabase
    .channel(`lord-clashes:${me}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lord_clashes', filter: `seat_a=eq.${me}` }, heard)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lord_clashes', filter: `seat_b=eq.${me}` }, heard)
    .subscribe((status) => onLive(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'connecting' : 'down'));
  return () => void supabase.removeChannel(channel);
}

/** Everything the game needs for clashes: the school's server here, or a pretend one in the preview. */
export interface ClashApi {
  here(): Promise<Here | null>;
  send(request: ClashRequest): Promise<ClashResult>;
  cheer(clash: number, cheer: Cheer): Promise<ClashRow | null>;
  watch(me: string, onRow: (row: ClashRow) => void, onLive: (status: LiveStatus) => void): () => void;
  clockOffset(): Promise<number>;
}

export const serverClashApi: ClashApi = { here: sayHere, send: sendClash, cheer: sendCheer, watch: watchClashes, clockOffset: fetchClockOffset };
