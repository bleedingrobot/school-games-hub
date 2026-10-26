/**
 * The class's "Skip button" switch (docs/QUESTION-SKIPS-PLAN.md, stage S.3): On, 3 per game, or Off.
 *
 * The question box doesn't read settings itself. The website reads the switch from the settings row every page already
 * shares (classSettings.ts, so it costs no extra request) and hands it to the box's rule in src/maths/questionLog.ts.
 * Teachers are never limited. The skips used start again on every new page, so "3 per game" means 3 per visit to a game.
 * If the settings can't be read, the rule stays as it was (On to start): a broken connection never takes a button away.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { resetSkips, setSkipMode, type SkipMode } from '../maths/questionLog';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

export const SKIP_MODES: readonly SkipMode[] = ['on', 'limited', 'off'];

/** Anything that isn't a known mode is On (as before the switch). */
export function parseSkipMode(value: unknown): SkipMode {
  return SKIP_MODES.includes(value as SkipMode) ? (value as SkipMode) : 'on';
}

export async function fetchSkipMode(classId?: string | null): Promise<SkipMode> {
  const row = await readSettings(['question_skips'], classId);
  if (!row) throw new FriendlyError('We couldn’t load this setting.');
  return parseSkipMode(row.question_skips);
}

export async function saveSkipMode(mode: SkipMode, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_question_skips', { mode, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t save that. Please try again.');
}

/**
 * Keeps the question box's skip rule in step with the signed-in student's class. Used once, in the app's routes. On each
 * new page the skips used start again and the switch is read again (from the shared, remembered settings row).
 */
export function useSkipRuleSync(): void {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const student = !!profile && profile.role !== 'teacher';

  useEffect(() => {
    resetSkips();
    if (!student) {
      setSkipMode('on');
      return;
    }
    let current = true;
    readSettings(['question_skips']).then(
      (row) => {
        if (current && row) setSkipMode(parseSkipMode(row.question_skips));
      },
      () => {
        // Couldn't read it: keep the rule as it was.
      },
    );
    return () => {
      current = false;
    };
  }, [student, pathname, profile?.id]);
}
