import { createElement } from 'react';
import { nzDate, seasonOf } from '../../../shared/lord/engine';
import { fetchLordEnabled, fetchLordSchoolSeason, fetchLordSettings, type LordSchoolSeason, type LordSettings } from '../../data/lord';
import { useSetting } from '../../teacher/useSetting';

/**
 * Dragon Maths on the teacher's Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class: the on/off switch in
 * the On column, and where the season is in the Maths column ("Season 3, 12 days left"). Forest fights, the topics, the
 * school's season box and the class report are in its Settings (src/pages/TeacherLord.tsx). The server checks the switch on
 * every request.
 *
 * Seasons have one date for the whole school (migration 20261028000400, docs/DRAGON-SCHOOL-SEASON.md). Until that migration
 * is live, `fetchLordSchoolSeason` says `live: false` and everything here works from the class's own date, as before.
 */
export function useLordClassSwitch(classId: string) {
  return useSetting(() => fetchLordEnabled(classId), [classId]);
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Where a class's own season is (before the school season is live). Seasons run 35 days back to back from the first day of
 * season 1. While the game is switched off the clock waits (`pausedSince`), so the season is shown as it stood that day;
 * switching on carries it on from there.
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

/** Where the school's season is: "Season 3, 12 days left", "Season 3, holiday pause", "Season 1 starts in 5 days". */
export function schoolSeasonText(season: LordSchoolSeason): string {
  if (!season.number) {
    if (season.startsIn !== null) return `Season 1 starts in ${days(season.startsIn)}`;
    return 'Starts when switched on';
  }
  if (season.pausedSince) return `Season ${season.number}, holiday pause`;
  return `Season ${season.number}, ${season.daysLeft === 0 ? 'last day' : `${days(season.daysLeft ?? 0)} left`}`;
}

/** The Maths column: the school's season once it's live, else the class's own. Null while loading. */
export function useLordSummary(classId: string): string | null {
  const school = useSetting(() => fetchLordSchoolSeason(), []);
  const settings = useSetting(() => fetchLordSettings(classId), [classId]);
  if (school.value?.live) return schoolSeasonText(school.value.season);
  if (settings.failed || school.failed) return 'Couldn’t load';
  if (!school.value) return null;
  return settings.value && seasonText(settings.value, nzDate(new Date()));
}

const GAME = 'A fantasy adventure with a few forest fights a day and maths to help win them. Every 5 weeks a new season starts and everyone begins again.';
/** Behind the switch's "?" once the school season is live. */
export const LORD_ABOUT_SCHOOL = `${GAME} Off hides Dragon Maths from this class only; the school's seasons carry on. A school admin can pause the seasons for the holidays.`;
/** Behind the switch's "?" before it is: each class's own clock. */
export const LORD_ABOUT_CLASS = `${GAME} Off closes the village gates: nothing is saved and the season clock is paused (for the holidays). On again carries the season on where it left off.`;

/** The switch's "?": what Off does depends on whether the school season is live yet. */
function LordSwitchAbout() {
  const school = useSetting(() => fetchLordSchoolSeason(), []);
  if (!school.value && !school.failed) return GAME;
  return school.value?.live ? LORD_ABOUT_SCHOOL : LORD_ABOUT_CLASS;
}

export const LORD_ABOUT = createElement(LordSwitchAbout);
