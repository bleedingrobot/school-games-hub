import { nzDate, seasonOf } from '../../../shared/lord/engine';
import { fetchLordEnabled, fetchLordSettings, type LordSettings } from '../../data/lord';
import { useSetting } from '../../teacher/useSetting';

/**
 * Dragon Maths on the teacher's Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class: the on/off switch in
 * the On column, and where the class's season is in the Maths column ("Season 3, 12 days left"). Forest fights, the season
 * date, the topics and the class report are in its Settings (src/pages/TeacherLord.tsx). The server checks the switch on
 * every request.
 */
export function useLordClassSwitch(classId: string) {
  return useSetting(() => fetchLordEnabled(classId), [classId]);
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Where the class's season is. Seasons run 35 days back to back from the first day of season 1. While the game is switched
 * off the clock waits (`pausedSince`), so the season is shown as it stood that day; switching on carries it on from there.
 */
export function seasonText(settings: Pick<LordSettings, 'enabled' | 'seasonStart' | 'pausedSince'>, today: string): string {
  const { seasonStart, pausedSince } = settings;
  if (!seasonStart) return settings.enabled ? 'Season 1' : 'Starts when switched on';
  const paused = !settings.enabled && pausedSince ? pausedSince : null;
  const season = seasonOf(seasonStart, paused ?? today);
  if (!season.started) return paused ? 'Season 1 paused' : `Season 1 starts in ${days(season.daysLeft)}`;
  const left = season.daysLeft === 0 ? 'last day' : `${days(season.daysLeft)} left`;
  return paused ? `Season ${season.number} paused, ${left}` : `Season ${season.number}, ${left}`;
}

/** The Maths column. Null while loading. */
export function useLordSummary(classId: string): string | null {
  const settings = useSetting(() => fetchLordSettings(classId), [classId]);
  if (settings.failed) return 'Couldn’t load';
  return settings.value && seasonText(settings.value, nzDate(new Date()));
}

/** Behind the switch's "?". */
export const LORD_ABOUT =
  'A fantasy adventure with a few forest fights a day and maths to help win them. Every 5 weeks a new season starts and everyone begins again. Off closes the village gates: nothing is saved and the season clock is paused (for the holidays). On again carries the season on where it left off.';
