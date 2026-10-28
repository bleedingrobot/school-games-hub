/**
 * Everything for Today's "Needs you" apart from students waiting to join (docs/TEACHER-VIEW-PLAN.md, section 4.2 and stage 5):
 * each game's alerts (saves or requests it turned down this week) and students skipping a lot of their questions. Counts and
 * made-up names only: Today may be on a projector.
 */
import { useEffect, useState } from 'react';
import { fetchClassOverview } from '../data/classOverview';
import { ALL_GAMES } from '../games/registry';
import type { GameDefinition, TeacherAlert } from '../games/types';
import { HIGH_SKIP_SHARE } from '../pages/TeacherQuestionSkips';
import { shortCache } from './shortCache';

/** Below this many questions in 7 days, a student's skip share says too little to flag. */
export const SKIP_ALERT_MIN_SHOWN = 5;

export const classOverview = (classId: string) => shortCache(`overview:${classId}`, () => fetchClassOverview(classId));

export function useClassAlerts(classId: string, games: GameDefinition[] = ALL_GAMES): TeacherAlert[] {
  const [alerts, setAlerts] = useState<TeacherAlert[]>([]);
  useEffect(() => {
    let current = true;
    setAlerts([]);
    const withAlerts = games.filter((g) => g.teacher?.alerts);
    const skips = classOverview(classId).then((students): TeacherAlert[] => {
      const n = students.filter((s) => !s.hidden && s.shown >= SKIP_ALERT_MIN_SHOWN && s.skipped / s.shown >= HIGH_SKIP_SHARE).length;
      if (n === 0) return [];
      const percent = Math.round(HIGH_SKIP_SHARE * 100);
      return [
        {
          id: 'skips',
          text: `${n} student${n === 1 ? '' : 's'} skipped ${percent}% or more of their questions this week`,
          section: 'students?sort=skipped',
        },
      ];
    });
    // A game that can't be asked just adds nothing: its own report still shows everything.
    void Promise.allSettled([skips, ...withAlerts.map((g) => g.teacher!.alerts!(classId))]).then((settled) => {
      if (!current) return;
      setAlerts(settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])));
    });
    return () => {
      current = false;
    };
  }, [classId, games]);
  return alerts;
}
