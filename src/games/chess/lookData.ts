import { supabase } from '../../lib/supabase';

/** What the server says about the pupil's chess look (my_chess_looks() in 20261118003300_chess_looks.sql). */
export interface LookData {
  set: string;
  board: string;
  background: string;
  /** Everything earned, as 'set:wood', 'board:marble', 'bg:forest'. The server decides these, never the browser. */
  unlocked: string[];
  /** Unlocked but not yet shown bursting out of the treasure chest. */
  fresh: string[];
  /** How far along each unlock is, for "Win 3 more games". */
  progress: Record<string, { have: number; need: number }>;
}

export type LookKind = 'set' | 'board' | 'background';

export async function fetchLooks(): Promise<LookData> {
  const { data, error } = await supabase.rpc('my_chess_looks');
  if (error || !data) throw new Error("We couldn't load your Chess Locker.");
  return data as LookData;
}

export async function saveLook(kind: LookKind, item: string): Promise<LookData> {
  const { data, error } = await supabase.rpc('set_chess_look', { kind, item });
  if (error || !data) throw new Error(error?.message ?? "We couldn't save that.");
  return data as LookData;
}

export async function markSeen(items: string[]): Promise<void> {
  await supabase.rpc('mark_chess_looks_seen', { items });
}
