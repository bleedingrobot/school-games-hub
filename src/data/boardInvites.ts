/**
 * Invites by name to the board games (docs/plans/play-anyone/PLAN.md, section D, stage 4).
 *
 * - Sending, calling off and saying no are database steps (board_invite_send / _cancel / _decline), each checking every
 *   rule: same school, not hidden, "Play other classes" for both classes, friends' games and non-maths games switched on.
 * - Yes goes to the game's own server function (`action: 'invite'`), which checks the rules again and makes a private game
 *   for just the two kids, the inviter in seat 1. It says where the game is, which the inviter hears live.
 */
import { supabase } from '../lib/supabase';
import type { InviteGame } from './hubAsks';

/** An invite I sent, as I see it change. */
export interface SentInvite {
  id: number;
  status: 'asked' | 'taking' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  path: string | null;
}

const OOPS = 'We couldn’t reach the server. Check the Wi-Fi and try again.';

/** Invites `them` to `game`. The setup is the inviter's choices (Wormholes' board and mode, 101's target). */
export async function sendInvite(
  game: InviteGame,
  them: string,
  setup?: unknown,
): Promise<{ ok: true; id: number; deadline: string } | { ok: false; message: string }> {
  try {
    const { data, error } = await supabase.rpc('board_invite_send', { game, other: them, setup: setup ?? null });
    if (error || !data || typeof data !== 'object') return { ok: false, message: OOPS };
    const r = data as { ok?: unknown; message?: unknown; id?: unknown; deadline?: unknown };
    if (r.ok === true && typeof r.id === 'number' && typeof r.deadline === 'string') return { ok: true, id: r.id, deadline: r.deadline };
    return { ok: false, message: typeof r.message === 'string' ? r.message : OOPS };
  } catch {
    return { ok: false, message: OOPS };
  }
}

/** Calls off my waiting invite. */
export async function cancelInvite(): Promise<void> {
  await supabase.rpc('board_invite_cancel');
}

/** Says yes: the game's own server makes the game. Where it is, or why not in the pupil's words. */
export async function acceptInvite(game: InviteGame, invite: number): Promise<{ path: string } | { problem: string }> {
  try {
    if (game === 'chess' || game === 'checkers') {
      const { ask } = await import('./multiplayer');
      return { path: `/play/${(await ask({ action: 'invite', invite, game })).id}` };
    }
    if (game === '101') {
      const { askCard } = await import('./cardGames');
      return { path: `/card-game/${(await askCard({ action: 'invite', invite })).game}` };
    }
    if (game === 'space') {
      const { askSpace } = await import('./spaceGames');
      return { path: `/space-game/${(await askSpace({ action: 'invite', invite })).id}` };
    }
    const { askPower } = await import('./powerGames');
    return { path: `/power-game/${(await askPower({ action: 'invite', invite })).id}` };
  } catch (e) {
    return { problem: e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.' };
  }
}

const isSent = (row: unknown): row is SentInvite => {
  const r = row as { id?: unknown; status?: unknown } | null;
  return !!r && typeof r.id === 'number' && typeof r.status === 'string';
};

/** How often my waiting invite is looked at again, in case a live update is missed. */
export const SENT_CHECK_MS = 5000;

/** Hears what happens to an invite I sent: live, with a look every few seconds as well. Returns the way to stop. */
export function watchSentInvite(id: number, onChange: (invite: SentInvite) => void): () => void {
  let stopped = false;
  const tell = (row: unknown) => {
    if (!stopped && isSent(row)) onChange({ id: row.id, status: row.status, path: typeof row.path === 'string' ? row.path : null });
  };
  const look = async () => {
    const { data } = await supabase.from('board_invites').select('id, status, path').eq('id', id).maybeSingle();
    tell(data);
  };
  const channel = supabase
    .channel(`board-invite:${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'board_invites', filter: `id=eq.${id}` }, (payload: { new?: unknown }) => tell(payload.new))
    .subscribe();
  const timer = setInterval(() => void look().catch(() => {}), SENT_CHECK_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
    void supabase.removeChannel(channel);
  };
}
