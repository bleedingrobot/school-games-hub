/**
 * The season timeline on Smash Quest's home screen (James, 28 Nov 2026: "some sort of timeline overview on the main page,
 * for the weekly and seasonal boss"). Smash Quest's season is the school's hub season (schools.hub_season_start and
 * hub_season_days, 35 days: 5 weeks). Each week ends with the class's Friday boss; the last Friday is the mega boss.
 * The boss fights themselves are stage B.3 (docs/BONKERS-PLAN.md); this only shows what's coming and when. Pure.
 */

/** The school's season clock as the server reads it. */
export interface SeasonClock {
  /** The first day of season 1 (YYYY-MM-DD, NZ). */
  start: string;
  /** Days in a season. */
  days: number;
}

export interface BossInfo {
  name: string;
  emoji: string;
  /** One line for the timeline. */
  blurb: string;
}

/** Fridays 1 to 4: a different boss each week. */
export const FRIDAY_BOSSES: readonly BossInfo[] = [
  { name: 'Captain Lost Property', emoji: '🧥', blurb: 'Made of every jumper nobody came back for.' },
  { name: 'The Lunchbox Lurker', emoji: '🥪', blurb: 'It ate your sandwich. And the container.' },
  { name: 'Sir Squeaks-a-Lot', emoji: '🪑', blurb: 'A chair that squeaks louder every day.' },
  { name: 'The Glitter Gremlin', emoji: '✨', blurb: 'You will find its glitter for years.' },
];

/** The last Friday: one mega boss a season, taking turns. */
export const MEGA_BOSSES: readonly BossInfo[] = [
  { name: 'The Mega Mess Monster', emoji: '🌋', blurb: 'Every mess in the school, rolled into one.' },
  { name: 'Queen Puddle-Splash', emoji: '🌧️', blurb: 'She brings the wet lunchtime. All of them.' },
  { name: 'The Infinite Homework Hydra', emoji: '🐍', blurb: 'Finish one page and two more grow back.' },
];

/** Every boss in one list: the 4 Friday bosses, then the 3 mega bosses (a boss quest's `monster` is the index). */
export const ALL_BOSSES: readonly BossInfo[] = [...FRIDAY_BOSSES, ...MEGA_BOSSES];
export const bossIndex = (b: BossInfo) => ALL_BOSSES.indexOf(b);

export type StopState = 'beaten-time' | 'today' | 'next' | 'later';

export interface BossStop {
  week: number;
  kind: 'friday' | 'mega';
  /** YYYY-MM-DD */
  date: string;
  /** Day of the season (1-based). */
  day: number;
  boss: BossInfo;
  /** 'beaten-time': its day has gone; 'today': it's today; 'next': the next one coming; 'later': after that. */
  state: StopState;
}

export interface SeasonView {
  number: number;
  /** Today's day of the season (1-based). */
  day: number;
  days: number;
  /** Which week today is in (1-based). */
  week: number;
  weeks: number;
  stops: BossStop[];
}

const DAY_MS = 86_400_000;
const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const FRIDAY = 5;

/** Today's place in the season and its boss stops; null before season 1 starts or with a broken clock. */
export function seasonView(clock: SeasonClock | null | undefined, today: string): SeasonView | null {
  if (!clock || !/^\d{4}-\d{2}-\d{2}$/.test(clock.start) || !(clock.days >= 7)) return null;
  const since = Math.round((toUtc(today) - toUtc(clock.start)) / DAY_MS);
  if (!Number.isFinite(since) || since < 0) return null;
  const number = Math.floor(since / clock.days) + 1;
  const day = (since % clock.days) + 1;
  const weeks = Math.floor(clock.days / 7);
  const seasonStart = toUtc(clock.start) + (number - 1) * clock.days * DAY_MS;
  let nextFound = false;
  const stops: BossStop[] = Array.from({ length: weeks }, (_, i) => {
    const weekStart = seasonStart + i * 7 * DAY_MS;
    // The Friday inside this week (every 7 days hold exactly one).
    const toFriday = (FRIDAY - new Date(weekStart).getUTCDay() + 7) % 7;
    const at = weekStart + toFriday * DAY_MS;
    const stopDay = i * 7 + toFriday + 1;
    const mega = i === weeks - 1;
    let state: StopState = stopDay < day ? 'beaten-time' : stopDay === day ? 'today' : 'later';
    if (state === 'later' && !nextFound) state = 'next';
    if (state === 'today' || state === 'next') nextFound = true;
    return {
      week: i + 1,
      kind: mega ? 'mega' : 'friday',
      date: fromUtc(at),
      day: stopDay,
      boss: mega ? MEGA_BOSSES[(number - 1) % MEGA_BOSSES.length] : FRIDAY_BOSSES[i % FRIDAY_BOSSES.length],
      state,
    };
  });
  return { number, day, days: clock.days, week: Math.min(weeks, Math.floor((day - 1) / 7) + 1), weeks, stops };
}

/** "Friday boss today!", "Friday boss in 2 days", "Mega boss tomorrow"… for the timeline's headline. */
export function nextBossWords(v: SeasonView): string {
  const s = v.stops.find((x) => x.state === 'today' || x.state === 'next');
  if (!s) return `New season in ${v.days - v.day + 1} day${v.days - v.day + 1 === 1 ? '' : 's'}!`;
  const who = s.kind === 'mega' ? 'Mega boss' : 'Friday boss';
  const gap = s.day - v.day;
  if (gap === 0) return `${who} today: ${s.boss.name}!`;
  return `${who} ${gap === 1 ? 'tomorrow' : `in ${gap} days`}: ${s.boss.name}`;
}
