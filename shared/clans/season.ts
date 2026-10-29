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
