/**
 * Non-maths games (James, 3 Nov 2026): a class switch that turns off the dashboard's "Non-maths games" (chess, checkers, 101,
 * Power Clash) for that class. On unless a teacher turned it off.
 *
 * Only on the website: the cards hide and those games' pages say they are off, including games already going (they wait,
 * and carry on when the switch is back on). If the settings can't be read, the games stay open: a broken connection must
 * never lock a class out. Teachers are never stopped, so they can still try a game.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { findGame } from '../games/registry';
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** Is this game one of the non-maths ones? Unknown ids are not. */
export const isNonMathsGame = (gameId: string) => findGame(gameId)?.group === 'no-maths';

/**
 * Are the non-maths games open for the person signed in? null while loading. Teachers: always true. A pupil's class row
 * comes from the settings every page already shares, so this costs no extra request.
 */
export function useNonMathsGamesOpen(): boolean | null {
  const { profile } = useAuth();
  const teacher = profile?.role === 'teacher';
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    if (!profile || teacher) return;
    let current = true;
    readSettings(['non_maths_games']).then(
      (row) => current && setOpen(row?.non_maths_games !== false),
      () => current && setOpen(true),
    );
    return () => {
      current = false;
    };
  }, [profile, teacher]);
  return teacher ? true : open;
}

// ---------------------------------------------------------------------------
// The teacher's switch
// ---------------------------------------------------------------------------

export async function fetchNonMathsGames(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['non_maths_games'], classId);
  if (!row) throw new Error('We couldn’t load this setting.');
  return row.non_maths_games !== false;
}

export async function saveNonMathsGames(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_non_maths_games', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
