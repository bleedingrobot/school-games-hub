/** Class Showdown talking to the school's `showdown` server function, with live updates through Supabase Realtime. */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { FeedEvent, PlayerView, RoomView } from '../../../shared/showdown/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../config';
import { fetchClockOffset } from '../../data/multiplayer';
import { supabase } from '../../lib/supabase';
import type { ShowdownLink } from './link';

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

export const liveShowdownLink: ShowdownLink = {
  async send(body) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/showdown`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      return { status: 503, body: { error: 'The showdown couldn’t be reached. Check the internet and try again.' } };
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (await response.json()) as Record<string, unknown>;
    } catch {
      // An empty or broken reply: the status still says what happened.
    }
    return { status: response.status, body: parsed };
  },
  watchRoom: (room, on) => listen('showdown-room', 'showdown_rooms', `id=eq.${room}`, (row) => (row.view as RoomView) ?? null, on),
  watchFeed: (room, on) => listen('showdown-feed', 'showdown_feed', `room=eq.${room}`, (row) => (row.event as FeedEvent) ?? null, on),
  watchMe: (room, me, on) =>
    listen('showdown-me', 'showdown_players', `player=eq.${me}`, (row) => (Number(row.room) === room ? (row.view as PlayerView) : null), on),
  clockOffset: () => fetchClockOffset(),
};
