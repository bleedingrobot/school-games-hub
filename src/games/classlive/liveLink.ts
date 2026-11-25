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

/**
 * Fast position calls (spots, paint, board reads) go one at a time per kind, and pause after a failure. Pads ask every
 * 0.25-0.4 s; without this, a slow database got a fresh call from every iPad before the last one finished and the pile-up
 * crashed it (26 Nov 2026, Ghost Tag with 28 pupils). A skipped call answers null, which every caller already treats as
 * "nothing new this time".
 */
const busy = new Set<string>();
const restUntil = new Map<string, number>();
const REST_MS = 2000;
export async function gated<T>(kind: string, call: () => Promise<T | null>): Promise<T | null> {
  if (busy.has(kind) || (restUntil.get(kind) ?? 0) > Date.now()) return null;
  busy.add(kind);
  try {
    const out = await call();
    if (out === null) restUntil.set(kind, Date.now() + REST_MS);
    return out;
  } catch {
    restUntil.set(kind, Date.now() + REST_MS);
    return null;
  } finally {
    busy.delete(kind);
  }
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
  move(room, x, y) {
    return gated('move', async () => {
      const { data, error } = await supabase.rpc('classlive_move', { target: room, x, y });
      if (error || !Array.isArray(data)) return null;
      return (data as unknown[]).flatMap((p) => (Array.isArray(p) && p.length === 2 ? [{ x: Number(p[0]), y: Number(p[1]) }] : []));
    });
  },
  ghostMove(room, x, y) {
    return gated('ghostMove', async () => {
      const { data, error } = await supabase.rpc('classlive_ghost_move', { target: room, x, y });
      if (error || !data || typeof data !== 'object' || !Array.isArray((data as { spots?: unknown }).spots)) return null;
      const d = data as { me?: { ghost?: unknown }; spots: unknown[] };
      const spots = d.spots.flatMap((p) => (Array.isArray(p) && p.length === 3 ? [[Number(p[0]), Number(p[1]), Number(p[2]) as 0 | 1 | 2 | 3] as [number, number, 0 | 1 | 2 | 3]] : []));
      return { me: { ghost: d.me?.ghost === true }, spots };
    });
  },
  crewMove(room, x, y) {
    return gated('crewMove', async () => {
      const { data, error } = await supabase.rpc('classlive_crew_move', { target: room, x, y });
      if (error || !data || typeof data !== 'object' || !Array.isArray((data as { spots?: unknown }).spots)) return null;
      const d = data as { me?: { glitch?: unknown; drone?: unknown }; spots: unknown[] };
      // [x, y, kind, factory name, colour]; an older database sends only the first three.
      const spots = d.spots.flatMap((p) => (Array.isArray(p) && p.length >= 3
        ? [[Number(p[0]), Number(p[1]), Number(p[2]) as 0 | 1 | 2, typeof p[3] === 'string' ? p[3].slice(0, 24) : '', Number(p[4]) || 0] as [number, number, 0 | 1 | 2, string, number]]
        : []));
      return { me: { glitch: d.me?.glitch === true, drone: d.me?.drone === true }, spots };
    });
  },
  positions(room) {
    return gated('positions', async () => {
      const { data, error } = await supabase.rpc('classlive_positions', { target: room });
      if (error || !data || typeof data !== 'object') return null;
      const out: Record<string, { x: number; y: number }> = {};
      for (const [id, p] of Object.entries(data as Record<string, { x?: unknown; y?: unknown }>)) out[id] = { x: Number(p.x), y: Number(p.y) };
      return out;
    });
  },
  async avatars(room) {
    const { data, error } = await supabase.rpc('classlive_avatars', { target: room });
    return error || !data || typeof data !== 'object' ? null : (data as Record<string, unknown>);
  },
  clashPaint(room, x, y, since) {
    return gated('clashPaint', async () => {
      const { data, error } = await supabase.rpc('classlive_clash_paint', { target: room, x, y, since });
      if (error || !data || typeof data !== 'object') return null;
      const d = data as { spots?: unknown; round?: unknown; now?: unknown; tiles?: unknown };
      return { spots: spotsOf(d.spots), round: Number(d.round) || 0, now: Number(d.now) || 0, tiles: tilesOf(d.tiles) };
    });
  },
  clashBoard(room, since) {
    return gated('clashBoard', async () => {
      const { data, error } = await supabase.rpc('classlive_clash_board', { target: room, since });
      if (error || !data || typeof data !== 'object') return null;
      const d = data as { round?: unknown; now?: unknown; tiles?: unknown };
      return { round: Number(d.round) || 0, now: Number(d.now) || 0, tiles: tilesOf(d.tiles) };
    });
  },
  watchMe: (room, me, on) =>
    listen('classlive-me', 'classlive_players', `player=eq.${me}`, (row) => (Number(row.room) === room ? (row.view as PlayerView) : null), on),
};

const spotsOf = (v: unknown) => (Array.isArray(v) ? v : []).flatMap((p) => (Array.isArray(p) && p.length === 2 ? [{ x: Number(p[0]), y: Number(p[1]) }] : []));
const tilesOf = (v: unknown): [number, number][] =>
  (Array.isArray(v) ? v : []).flatMap((p) => (Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]) ? [[p[0] as number, p[1] as number] as [number, number]] : []));
