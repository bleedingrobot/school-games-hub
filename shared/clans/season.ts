/**
 * The season clock and the full reset at a new season. Pure: the server reads the clock from the database
 * (`clan_extras`) and passes it in; nothing here knows the date. Days are 1-based (day 1 to CONFIG.season.length).
 */
import type { ServerState } from './actions';
import { rollMember } from './character';
import { CONFIG } from './config';
import { newEmpire } from './empire';
import { slotSeed } from './create';
import type { Clan, Member } from './types';

/** The server's view of the season. `number` 0 means no season date has been set yet. */
export interface SeasonClock {
  number: number;
  /** Day of the season, 1 to CONFIG.season.length. */
  day: number;
  daysLeft: number;
  clockOn: boolean;
}

export type SeasonPhase = 'build' | 'warning' | 'monster';

const S = CONFIG.season;

/** Which part of the season a day is in. */
export const phaseOf = (day: number): SeasonPhase => (day >= S.monsterFrom ? 'monster' : day >= S.warnFrom ? 'warning' : 'build');

const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Read the clock the database sends. Anything odd (missing, wrong types) gives null. */
export function readClock(raw: unknown): SeasonClock | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!whole(r.number) || !whole(r.day) || !whole(r.daysLeft) || typeof r.clockOn !== 'boolean') return null;
  return { number: r.number, day: r.day, daysLeft: r.daysLeft, clockOn: r.clockOn };
}

/** Raids on classmates rest from day `warnFrom` to the end of the season (computer kingdoms stay open). */
export const classRaidsResting = (clock: SeasonClock | null | undefined): boolean => clock?.clockOn === true && clock.day >= S.warnFrom;

/**
 * The full reset for a new season. Returns a copy. Every member starts again at level 1 (same name, race, class and look; slot 0 leads),
 * the purse goes back to the starting gold, followers, buildings, saved builds, the day's counts and last season's monster tries and supplies go,
 * and the examined list clears. The clan may then pick its members' races and classes again (`repick`) until it says it is done.
 * Name, seed, day, fight numbers and the fights left are kept. The caller only does this when no fight is open.
 */
export function newSeasonSave(state: ServerState, season: number): ServerState {
  const copy = structuredClone(state);
  const members: Member[] = copy.clan.members.map((m, slot) => {
    const fresh = rollMember({ rng: Math.imul(slotSeed(state.seed, slot) | 0, 2654435761) + season * 7919 }, m.name, m.race, m.cls, slot === 0);
    return { ...fresh, ...(m.look ? { look: m.look } : {}) };
  });
  const { questDay: _q, monster: _m, repick: _r, ...rest } = copy.clan;
  const clan: Clan = {
    ...rest,
    members,
    gold: CONFIG.startGold,
    followers: 0,
    village: { trainingHall: 0, smithy: 0, church: 0 },
    wakesToday: 0,
    empire: { ...newEmpire(state.day), buildsSaved: 0 },
    season,
    // Until the clan plays, it may pick each member's race and class again (James, 28 Oct 2026).
    repick: season,
  };
  copy.clan = clan;
  copy.examined = [];
  return copy;
}

// ---------------------------------------------------------------------------
// The season road (the four stages on the Clan Quest home screen)
// ---------------------------------------------------------------------------

export type StageId = 'build' | 'ready' | 'monster' | 'new';
export interface SeasonStage { id: StageId; name: string; from: number; to: number; when: string; say: string; state: 'done' | 'now' | 'next' }
export interface SeasonRoad {
  stages: SeasonStage[];
  headline: { before: string; strong: string; after: string };
  /** 0 to 1 along the whole road, from the first medallion to the last. */
  fill: number;
  /** One sentence for screen readers. */
  label: string;
}

/** Did this clan beat this season's monster? (The first win is kept in the monster save as `wonDay`.) */
export const beatenThisSeason = (clan: Clan | null | undefined, season: number): boolean => clan?.monster?.season === season && clan.monster.wonDay !== undefined;

const plural = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** The four stages of a season, the headline sentence, how far along the road today is, and the screen reader sentence. Built only from CONFIG.season. */
export function seasonRoad(clock: SeasonClock, monster: { name: string; short: string }, beaten: boolean): SeasonRoad {
  const { length, warnFrom, monsterFrom } = S;
  const d = clock.day;
  const { short } = monster;
  const defs: Omit<SeasonStage, 'state'>[] = [
    { id: 'build', name: 'Build', from: 1, to: warnFrom - 1, when: `Days 1–${warnFrom - 1}`, say: 'Grow your clan and village' },
    { id: 'ready', name: 'Get ready', from: warnFrom, to: monsterFrom - 1, when: `Days ${warnFrom}–${monsterFrom - 1}`, say: 'Supplies on sale · raids rest' },
    { id: 'monster', name: 'Monster week', from: monsterFrom, to: length, when: `Days ${monsterFrom}–${length}`, say: `${short} attacks! One try a day` },
    { id: 'new', name: 'New season', from: length + 1, to: length + 1, when: 'Day 1 again', say: 'Fresh start · trophies stay' },
  ];
  const nowIndex = d >= monsterFrom ? 2 : d >= warnFrom ? 1 : 0;
  const stages: SeasonStage[] = defs.map((s, i) => ({ ...s, state: i < nowIndex ? 'done' : i === nowIndex ? 'now' : 'next' }));

  const toMonster = monsterFrom - d;
  const left = length - d + 1;
  let headline: SeasonRoad['headline'];
  if (d >= length) {
    headline = {
      before: '', strong: 'Last day of the season!',
      after: beaten ? ` You beat ${short}. Tomorrow your clan starts fresh. Your trophies stay forever.` : ` Last chance to beat ${short}. Tomorrow your clan starts fresh. Your trophies stay forever.`,
    };
  } else if (d >= monsterFrom) {
    headline = beaten
      ? { before: `You beat ${short}! `, strong: `New season in ${plural(left)}.`, after: '' }
      : { before: '', strong: 'Monster week!', after: ` ${plural(left)} left to beat ${short}. One try a day.` };
  } else if (d >= warnFrom) {
    headline = toMonster === 1
      ? { before: `${short} comes `, strong: 'tomorrow', after: '! Buy supplies in the Market and get strong.' }
      : { before: `${short} comes in `, strong: plural(toMonster), after: '! Buy supplies in the Market and get strong.' };
  } else {
    headline = { before: '', strong: plural(toMonster), after: ` until ${monster.name} comes. ${plural(warnFrom - d)} to build before supplies go on sale.` };
  }

  const stageFrom = [1, warnFrom, monsterFrom, length + 1];
  const span = stageFrom[nowIndex + 1] - stageFrom[nowIndex];
  const fill = Math.max(0, Math.min(nowIndex === 2 ? 0.97 : 1, (nowIndex + (d - stageFrom[nowIndex]) / span) / 3));
  const next = stages[nowIndex + 1];
  const label = `Season ${clock.number}, day ${d} of ${length}. Now: ${stages[nowIndex].name}. Next: ${next.name} in ${plural(next.from - d)}.`;
  return { stages, headline, fill, label };
}
