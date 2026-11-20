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
import { readClock, type SeasonClock } from './clock';

export { readClock, type SeasonClock };

/** The server's view of the season. `number` 0 means no season date has been set yet. */

export type SeasonPhase = 'build' | 'warning' | 'monster';

const S = CONFIG.season;

/** Which part of the season a day is in. */
export const phaseOf = (day: number): SeasonPhase => (day >= S.monsterFrom ? 'monster' : day >= S.warnFrom ? 'warning' : 'build');



/**
 * The full reset for a new season. Returns a copy. Every member starts again at level 1 (same name, race, class and look; slot 0 leads),
 * the purse goes back to the starting gold, followers, buildings, saved builds, the day's counts and last season's monster tries and supplies go,
 * and everyone is back in tier 1 gear. The clan may then pick its members' races and classes again (`repick`) until it says it is done.
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
    gearVersion: 2,
    village: { trainingHall: 0, smithy: 0, church: 0 },
    wakesToday: 0,
    empire: { ...newEmpire(state.day), buildsSaved: 0 },
    season,
    // Until the clan plays, it may pick each member's race and class again (James, 28 Oct 2026).
    repick: season,
  };
  copy.clan = clan;
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
    { id: 'ready', name: 'Get ready', from: warnFrom, to: monsterFrom - 1, when: `Days ${warnFrom}–${monsterFrom - 1}`, say: 'Monster supplies on sale' },
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

// ---------------------------------------------------------------------------
// The end and start of a season (docs/plans/clans-season-end/PLAN.md, stage 1)
// ---------------------------------------------------------------------------

/** What a new season keeps and what starts again (newSeasonSave above and clan_nightly's fame reset). Shown before and after. */
export const SEASON_KEEPS: readonly { emoji: string; text: string }[] = [
  { emoji: '🛡️', text: 'Your clan’s name and your members’ names and looks' },
  { emoji: '🏆', text: 'Your achievements' },
  { emoji: '🦷', text: 'Your trophies: the Monster Tooth and Clan Banner' },
  { emoji: '👑', text: 'Your quest rewards: titles and frames' },
  { emoji: '🏛️', text: 'The Hall of Legends, for ever' },
];
export const SEASON_RESETS: readonly { emoji: string; text: string }[] = [
  { emoji: '1️⃣', text: 'Every member goes back to level 1, with starting gear' },
  { emoji: '🪙', text: 'Your gold and followers' },
  { emoji: '⭐', text: 'Fame: every clan starts at 0' },
  { emoji: '🏘️', text: 'Your buildings and village' },
  { emoji: '🧙', text: 'Races and classes: pick new ones if you like' },
];

/** The last days of a season the banner shows on. */
export const LAST_CHANCE_DAYS = 3;
/** The first days of a new season the "has begun" banner shows on. */
export const NEW_SEASON_DAYS = 3;

/**
 * A banner for the end and start of a season, or null on other days (and while the clock is off):
 * - the last three days: "Season 1 ends in 3 days!", "… ends tomorrow night!", "Last day of Season 1!";
 * - days 1 to 3 of season 2 and later: "Season 2 has begun!".
 * `beaten`: this clan already beat this season's monster (the home page doesn't know, so it passes false).
 */
export function seasonBanner(clock: SeasonClock, monster: { short: string; name: string }, beaten = false): { kind: 'last' | 'new'; title: string; text: string } | null {
  if (!clock.clockOn || clock.number <= 0 || clock.day <= 0) return null;
  const left = S.length - clock.day;
  if (left < LAST_CHANCE_DAYS) {
    const title = left === 0 ? `Last day of Season ${clock.number}! It ends tonight.`
      : left === 1 ? `Season ${clock.number} ends tomorrow night!`
      : `Season ${clock.number} ends in ${left + 1} days!`;
    const first = beaten ? `You beat ${monster.short}!` : `Last chance to beat ${monster.short}.`;
    return {
      kind: 'last', title,
      text: `${first} Then every clan starts again at level 1, but your trophies, achievements and the Hall of Legends stay forever.`,
    };
  }
  if (clock.number >= 2 && clock.day <= NEW_SEASON_DAYS) {
    return {
      kind: 'new', title: `Season ${clock.number} has begun!`,
      text: `Every clan starts again at level 1. ${monster.name} comes in monster week. Build your clan back up!`,
    };
  }
  return null;
}
