/**
 * Stars (docs/plans/play-anyone/PLAN.md, section F, stage 8): star or unstar a kid, or a clan from a clan list. Private and
 * one-sided: the server keeps it for me only and tells nobody. Each gives null when it worked, or the words for why not.
 */
import { supabase } from '../lib/supabase';

const TRY_AGAIN = 'That didn’t work. Try again in a moment.';

async function ask(fn: 'lobby_star' | 'lobby_star_clan', args: Record<string, unknown>): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error || !data || typeof data !== 'object') return TRY_AGAIN;
    const r = data as { ok?: unknown; message?: unknown };
    return r.ok === true ? null : typeof r.message === 'string' ? r.message : TRY_AGAIN;
  } catch {
    return TRY_AGAIN;
  }
}

/** Star a kid by their id (Lobby, Archery, Dragon Maths). */
export const starPlayer = (p: { id: string }, on: boolean) => ask('lobby_star', { other: p.id, starred: on });
/** Star a clan by its public id (Clan duels, Village Raids). */
export const starClan = (p: { id: string }, on: boolean) => ask('lobby_star_clan', { clan: p.id, starred: on });
