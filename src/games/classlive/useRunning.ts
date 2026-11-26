/**
 * The Class Live and Showdown games running now in other classes, for the teacher's picker (James, 26 Nov 2026 NZ:
 * one live game at a time; shared/classlive/limits.ts). Asked every 15 s while the picker shows;
 * anything that fails (preview, signed out) counts as nothing running, and the server still checks on open.
 */
import { useEffect, useState } from 'react';
import { readOpenGames, type OpenGame } from '../../../shared/classlive/limits';
import { supabase } from '../../lib/supabase';

export function useRunningGames(on: boolean): OpenGame[] {
  const [games, setGames] = useState<OpenGame[]>([]);
  useEffect(() => {
    if (!on) return;
    let stop = false;
    const read = () => {
      void supabase.rpc('classlive_games_running').then(
        ({ data, error }) => { if (!stop) setGames(error ? [] : readOpenGames(data)); },
        () => undefined,
      );
    };
    read();
    const id = window.setInterval(read, 15_000);
    return () => { stop = true; window.clearInterval(id); };
  }, [on]);
  return games;
}
