/**
 * Clan Quest Live Clan Duels: talking to the server (shared/clans/duelServer.ts, migration 20261117000400_clans_live_duels.sql).
 * "I'm here" and the cheers are database functions a pupil may call; everything that plays the duel goes to the `clans`
 * server function; both screens hear each change through Realtime on the duel row. The same shape as Dragon Maths' clashes.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DuelMove } from '../../shared/clans/duel';
import type { DuelRow } from '../../shared/clans/duelServer';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fetchClockOffset, type LiveStatus } from './multiplayer';

export type { DuelRow, LiveStatus };

/** A classmate's clan with Clan Quest open. `id` is the clan's hidden public id; `name` is the clan name. */
export interface DuelMate {
  id: string;
  name: string;
  busy: boolean;
}

export interface DuelAsk {
  duel: number;
  from: string;
  deadline: string;
}

export type DuelHere = { off: true } | { off: false; online: DuelMate[]; asks: DuelAsk[]; duel: DuelRow | null };

export async function sayDuelHere(): Promise<DuelHere | null> {
  try {
    const { data, error } = await supabase.rpc('clan_duel_here');
    if (error || !data || typeof data !== 'object') return null;
    const d = data as { off?: boolean; online?: DuelMate[]; asks?: DuelAsk[]; duel?: DuelRow | null };
    if (d.off) return { off: true };
    return { off: false, online: Array.isArray(d.online) ? d.online : [], asks: Array.isArray(d.asks) ? d.asks : [], duel: d.duel ?? null };
  } catch {
    return null;
  }
}

export type DuelRequest =
  | { action: 'duel-challenge'; other: string }
  | { action: 'duel-answer'; duel: number; accept: boolean }
  | { action: 'duel-pick'; duel: number; round: number; move: DuelMove }
  | { action: 'duel-times-up' | 'duel-leave'; duel: number };

export type DuelResult = { ok: true; duel: DuelRow | null } | { ok: false; message: string; code?: string; duel?: DuelRow };

export async function sendDuel(request: DuelRequest): Promise<DuelResult> {
  const once = async (): Promise<DuelResult | 'offline'> => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return { ok: false, message: 'Please sign in again.' };
      const response = await fetch(`${SUPABASE_URL}/functions/v1/clans`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (response.status >= 502) return 'offline';
      const body = (await response.json().catch(() => null)) as { duel?: DuelRow; error?: string; code?: string } | null;
      if (response.ok) return { ok: true, duel: body?.duel ?? null };
      return { ok: false, message: body?.error ?? 'That couldn’t be done just now.', code: body?.code, duel: body?.duel };
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

export type DuelCheer = 'good-fight' | 'well-played' | 'again';

export async function sendDuelCheer(duel: number, cheer: DuelCheer): Promise<DuelRow | null> {
  const { data, error } = await supabase.rpc('clan_duel_cheer', { duel, cheer });
  return error || !data ? null : (data as DuelRow);
}

export function watchDuels(me: string, onRow: (row: DuelRow) => void, onLive: (status: LiveStatus) => void): () => void {
  const heard = (payload: { new?: unknown }) => {
    const row = payload.new as DuelRow | undefined;
    if (row && Number.isSafeInteger(Number(row.id))) onRow(row);
  };
  const channel: RealtimeChannel = supabase
    .channel(`clan-duels:${me}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_duels', filter: `seat_a=eq.${me}` }, heard)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_duels', filter: `seat_b=eq.${me}` }, heard)
    .subscribe((status) => onLive(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'connecting' : 'down'));
  return () => void supabase.removeChannel(channel);
}

/** Everything the game needs for live duels: the school's server here, or a pretend one on the test page. */
export interface DuelApi {
  /** The signed-in pupil's account id (the seats in a duel row are account ids). */
  me: string;
  here(): Promise<DuelHere | null>;
  send(request: DuelRequest): Promise<DuelResult>;
  cheer(duel: number, cheer: DuelCheer): Promise<DuelRow | null>;
  watch(me: string, onRow: (row: DuelRow) => void, onLive: (status: LiveStatus) => void): () => void;
  clockOffset(): Promise<number>;
}

export const serverDuelApi = (me: string): DuelApi => ({ me, here: sayDuelHere, send: sendDuel, cheer: sendDuelCheer, watch: watchDuels, clockOffset: fetchClockOffset });
