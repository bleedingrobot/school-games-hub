/**
 * The Dragon Maths season road: four stops (Forest, Masters, Dragon week, New season) that show a pupil where the season is,
 * what comes next and how long they have. Pure: built from the season clock and SEASON_DAYS, plus the hero's level for the
 * pupil's own line. Shown in the game's village and in the "This season" strip on the home page.
 *
 * The stops are a pace guide (docs/LORD-PLAN.md, section 7: a steady player reaches the dragon in week 4 or 5). The dragon
 * can be faced any day once a hero is ready; dragon week is the last chance before everyone starts again.
 */
import { MAX_LEVEL, SEASON_DAYS, expNeeded } from './data';
import { seasonOf } from './engine';

export type LordStageId = 'forest' | 'masters' | 'dragon' | 'new';
export interface LordStage { id: LordStageId; name: string; from: number; to: number; when: string; say: string; note: string; state: 'done' | 'now' | 'next' }
export interface LordRoad {
  stages: LordStage[];
  headline: { before: string; strong: string; after: string };
  /** The pupil's own line ("You're level 7: 5 more masters to the dragon."), or '' with no hero. */
  mine: string;
  /** 0 to 1 along the whole road, from the first stop to the last. */
  fill: number;
  /** One sentence for screen readers. */
  label: string;
}

/** Where the season is: `day` 1 to SEASON_DAYS. */
export interface LordClock { number: number; day: number }

/** The last week of the season. Masters take the two weeks before it. */
export const DRAGON_WEEK_FROM = SEASON_DAYS - 6;
export const MASTERS_FROM = DRAGON_WEEK_FROM - 14;

const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** What the hero needs: level and whether the Red Dragon is ready for them (the caller works that out with canFaceDragon). */
export interface RoadHero { level: number; ready: boolean }

export function lordSeasonRoad(clock: LordClock, hero: RoadHero | null): LordRoad {
  const d = Math.max(1, Math.min(SEASON_DAYS, clock.day));
  const defs: Omit<LordStage, 'state'>[] = [
    {
      id: 'forest', name: 'Forest', from: 1, to: MASTERS_FROM - 1, when: `Days 1–${MASTERS_FROM - 1}`, say: 'Fight monsters, find gold',
      note: 'Use your forest fights every day you can. Buy a better sword and armour, and beat your first masters.',
    },
    {
      id: 'masters', name: 'Masters', from: MASTERS_FROM, to: DRAGON_WEEK_FROM - 1, when: `Days ${MASTERS_FROM}–${DRAGON_WEEK_FROM - 1}`, say: 'Beat your masters to level 12',
      note: `Each master you beat takes you up a level. Reach level ${MAX_LEVEL} and the way to the Red Dragon opens. Ready sooner? Go sooner!`,
    },
    {
      id: 'dragon', name: 'Dragon week', from: DRAGON_WEEK_FROM, to: SEASON_DAYS, when: `Days ${DRAGON_WEEK_FROM}–${SEASON_DAYS}`, say: 'Last chance to beat the Red Dragon',
      note: 'The last week of the season. Face the Red Dragon once a day. Beat it to win a star and a place in the Hall of Heroes.',
    },
    {
      id: 'new', name: 'New season', from: SEASON_DAYS + 1, to: SEASON_DAYS + 1, when: 'Day 1 again', say: 'Fresh start · stars stay',
      note: 'Every hero starts again at level 1 and can pick a new class. Your stars, achievements and the Hall of Heroes stay forever.',
    },
  ];
  const nowIndex = d >= DRAGON_WEEK_FROM ? 2 : d >= MASTERS_FROM ? 1 : 0;
  const stages: LordStage[] = defs.map((s, i) => ({ ...s, state: i < nowIndex ? 'done' : i === nowIndex ? 'now' : 'next' }));

  const left = SEASON_DAYS - d + 1;
  const toDragonWeek = DRAGON_WEEK_FROM - d;
  let headline: LordRoad['headline'];
  if (d === SEASON_DAYS) headline = { before: '', strong: 'Last day of the season!', after: ' Tomorrow every hero starts again. Your stars stay forever.' };
  else if (d >= DRAGON_WEEK_FROM) headline = { before: '', strong: 'Dragon week!', after: ` ${plural(left)} left to beat the Red Dragon this season.` };
  else headline = { before: '', strong: plural(toDragonWeek), after: ` until dragon week. ${plural(left)} left in this season.` };

  let mine = '';
  if (hero) {
    const masters = MAX_LEVEL - hero.level;
    if (hero.ready) mine = 'You are ready: the Red Dragon is waiting. One try a day.';
    else if (masters <= 0) mine = `You are level ${MAX_LEVEL}! Win in the forest to get ready for the Red Dragon.`;
    else mine = `You are level ${hero.level}: ${masters === 1 ? '1 more master' : `${masters} more masters`} to the dragon.`;
  }

  const stageFrom = [1, MASTERS_FROM, DRAGON_WEEK_FROM, SEASON_DAYS + 1];
  const span = stageFrom[nowIndex + 1] - stageFrom[nowIndex];
  const fill = Math.max(0, Math.min(nowIndex === 2 ? 0.97 : 1, (nowIndex + (d - stageFrom[nowIndex]) / span) / 3));
  const next = stages[nowIndex + 1];
  const label = `Season ${clock.number}, day ${d} of ${SEASON_DAYS}. Now: ${stages[nowIndex].name}. Next: ${next.name} in ${plural(next.from - d)}.`;
  return { stages, headline, mine, fill, label };
}

/** The home page's Dragon Maths season: where the school's season is today, and the pupil's hero (null with no hero yet). */
export interface HomeLordSeason { clock: LordClock; hero: RoadHero | null }

/**
 * Reads my_moves_left()'s `lordSeason` ({ start, on }) and the hero's `level` and `exp` from its `lord` line. Null when Dragon Maths is
 * off for the pupil (or on holiday pause), there is no school date yet, the first season hasn't started, or anything is odd.
 * `today` is the New Zealand date (nzDate).
 */
export function readLordSeason(raw: unknown, lord: unknown, today: string): HomeLordSeason | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { start, on } = raw as { start?: unknown; on?: unknown };
  if (on !== true || typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  const s = seasonOf(start, today);
  if (!s.started || s.number <= 0) return null;
  const l = (typeof lord === 'object' && lord !== null ? lord : {}) as { level?: unknown; exp?: unknown };
  const level = typeof l.level === 'number' && Number.isInteger(l.level) && l.level >= 1 ? Math.min(l.level, MAX_LEVEL) : null;
  const exp = typeof l.exp === 'number' ? l.exp : 0;
  // The same rule as canFaceDragon (engine.ts), from just the level and experience.
  const hero = level === null ? null : { level, ready: level >= MAX_LEVEL && exp >= expNeeded(MAX_LEVEL - 1) };
  return { clock: { number: s.number, day: s.dayOfSeason }, hero };
}
