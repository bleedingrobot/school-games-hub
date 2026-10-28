/**
 * Archery Challenge's settings drawer on the Games table (docs/ARCHERY-PLAN.md, section 7, Stage 7). The on/off switch is in the
 * table row; here are classmate fights (on to start: James, 22 Oct 2026), the points, and a small summary of the class's week
 * (counts only).
 */
import { useEffect, useState } from 'react';
import { DUEL_POINTS, DUEL_WIN_POINTS, FIGHT_POINTS, ROUND_POINTS, WIN_POINTS } from '../../shared/archery/points';
import { POINT_AT } from '../../shared/archery/speed';
import { fetchArcherySummary, saveArcheryDuels, type ArcherySummary } from '../data/archery';
import { useArcheryClassSwitch, useArcheryDuels } from '../games/archery/teacher';
import { SettingToggle } from '../teacher/Settings';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ArcherySettings({ classId }: { classId: string }) {
  const on = useArcheryClassSwitch(classId);
  const duels = useArcheryDuels(classId);
  const [summary, setSummary] = useState<ArcherySummary | null>(null);

  useEffect(() => {
    let current = true;
    setSummary(null);
    // The summary is a bonus: if it can't be read, the switch still works.
    fetchArcherySummary(classId).then((s) => current && setSummary(s), () => undefined);
    return () => {
      current = false;
    };
  }, [classId]);

  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Classmate fights"
        about="Students can challenge someone in their own class who has the game open, for a one-round fight, one turn each, through the school’s server. A fight someone leaves gives nobody points. Off stops any fights being played (everyone gets their unused arrows back) and leaves fights against the bots."
        value={duels.value}
        loadFailed={duels.failed}
        save={(next) => saveArcheryDuels(next, classId)}
      />
      {on.value === false && <p className="panel__empty">Archery Challenge is off for this class, so this only matters once it’s on.</p>}
      <p>
        Points: finishing a bot fight {FIGHT_POINTS} ({WIN_POINTS} for a win), finishing a fight against a classmate {DUEL_POINTS} (
        {DUEL_WIN_POINTS} for a win), and {ROUND_POINTS} for {POINT_AT} or more right in a speed round, all inside the daily points cap.
      </p>
      {summary && (
        <>
          <h3>This week</h3>
          <ul aria-label="Archery Challenge this week">
            <li>
              {summary.played} of {plural(summary.pupils, 'pupil')} played in the last 7 days.
            </li>
            <li>
              {plural(summary.botFights, 'fight')} against the bots and {plural(summary.duels, 'fight')} between classmates finished.
            </li>
            <li>{plural(summary.rounds, 'speed round')} in the last day.</li>
          </ul>
        </>
      )}
    </div>
  );
}
