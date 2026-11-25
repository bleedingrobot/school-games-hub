/** Class Live talking to the school's `classlive` server function, with live updates through Supabase Realtime. */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PlayerView, RoomView, ScreenView } from '../../../shared/classlive/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../config';
import { supabase } from '../../lib/supabase';
import type { ClassLiveLink } from './link';

/** Each change arrives the moment it's saved (Realtime checks each table's rule, so only rows this person may read arrive). */
function listen<T>(name: string, table: string, filter: string, pick: (row: Record<string, unknown>) => T | null, on: (x: T) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`${name}:${filter}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload: { new?: Record<string, unknown> }) => {
      const x = payload.new ? pick(payload.new) : null;
      if (x) on(x);
    })
    .subscribe();
  return () => void supabase.removeChannel(channel);
}

export const liveClassLiveLink: ClassLiveLink = {
  async send(body) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/classlive`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      return { status: 503, body: { error: 'Class Live couldn’t be reached. Check the internet and try again.' } };
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (await response.json()) as Record<string, unknown>;
    } catch {
      // An empty or broken reply: the status still says what happened.
    }
    return { status: response.status, body: parsed };
  },
  watchScreen: (room, on) => listen('classlive-screen', 'classlive_screens', `room=eq.${room}`, (row) => (row.screen as ScreenView) ?? null, on),
  watchRoom: (room, on) => listen('classlive-room', 'classlive_rooms', `id=eq.${room}`, (row) => (row.view as RoomView) ?? null, on),
  async move(room, x, y) {
    const { data, error } = await supabase.rpc('classlive_move', { target: room, x, y });
    if (error || !Array.isArray(data)) return null;
    return (data as unknown[]).flatMap((p) => (Array.isArray(p) && p.length === 2 ? [{ x: Number(p[0]), y: Number(p[1]) }] : []));
  },
  async ghostMove(room, x, y) {
    const { data, error } = await supabase.rpc('classlive_ghost_move', { target: room, x, y });
    if (error || !data || typeof data !== 'object' || !Array.isArray((data as { spots?: unknown }).spots)) return null;
    const d = data as { me?: { ghost?: unknown }; spots: unknown[] };
    const spots = d.spots.flatMap((p) => (Array.isArray(p) && p.length === 3 ? [[Number(p[0]), Number(p[1]), Number(p[2]) as 0 | 1 | 2 | 3] as [number, number, 0 | 1 | 2 | 3]] : []));
    return { me: { ghost: d.me?.ghost === true }, spots };
  },
  async positions(room) {
    const { data, error } = await supabase.rpc('classlive_positions', { target: room });
    if (error || !data || typeof data !== 'object') return null;
    const out: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of Object.entries(data as Record<string, { x?: unknown; y?: unknown }>)) out[id] = { x: Number(p.x), y: Number(p.y) };
    return out;
  },
  async avatars(room) {
    const { data, error } = await supabase.rpc('classlive_avatars', { target: room });
    return error || !data || typeof data !== 'object' ? null : (data as Record<string, unknown>);
  },
  watchMe: (room, me, on) =>
    listen('classlive-me', 'classlive_players', `player=eq.${me}`, (row) => (Number(row.room) === room ? (row.view as PlayerView) : null), on),
};
