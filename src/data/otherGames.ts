/**
 * The Progress tab's "Other games" numbers (migration 20261111000800): one read for the whole class, shared by every game's
 * `progressColumns` so five columns cost one request. Remembered for a minute so switching tabs is quick.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ProgressCell } from '../games/types';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

export interface OtherGameRow {
  student: string;
  game: string;
  value: number;
  /** ISO time they last played. */
  at: string | null;
}

const KEEP_MS = 60_000;
const cache = new Map<string, { at: number; rows: Promise<OtherGameRow[]> }>();

/** Every pupil's number in each of the other games, for a class the teacher teaches. */
export function fetchOtherGames(classId: string): Promise<OtherGameRow[]> {
  const hit = cache.get(classId);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.rows;
  const rows = (async () => {
    const { data, error } = await supabase.rpc('teacher_progress_other_games', { target_class: classId });
    if (error || !Array.isArray(data)) throw new FriendlyError('We couldn’t load the other games.');
    return data as OtherGameRow[];
  })();
  cache.set(classId, { at: Date.now(), rows });
  rows.catch(() => cache.delete(classId));
  return rows;
}

/** The class's rows: null while loading, and an empty list if they couldn't be read (the columns then show "not yet"). */
export function useOtherGameRows(classId: string): OtherGameRow[] | null {
  const [state, setState] = useState<{ classId: string; rows: OtherGameRow[] } | null>(null);
  useEffect(() => {
    let current = true;
    fetchOtherGames(classId).then(
      (rows) => current && setState({ classId, rows }),
      () => current && setState({ classId, rows: [] }),
    );
    return () => {
      current = false;
    };
  }, [classId]);
  return state?.classId === classId ? state.rows : null;
}

/** One game's cells from the class's rows. */
export function cellsOf(rows: readonly OtherGameRow[], game: string, of?: number): Map<string, ProgressCell> {
  return new Map(rows.filter((r) => r.game === game).map((r) => [r.student, { value: r.value, of, lastPlayed: r.at ?? undefined }]));
}

/** The hook a game's `progressColumns.useCells` is: its cells, null while loading. */
export function useOtherGameCells(classId: string, game: string, of?: number): Map<string, ProgressCell> | null {
  const rows = useOtherGameRows(classId);
  return useMemo(() => (rows ? cellsOf(rows, game, of) : null), [rows, game, of]);
}
