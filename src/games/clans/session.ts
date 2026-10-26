/**
 * The clan's state in the browser for this test stage (nothing is saved; a refresh starts again).
 * Plain functions on plain data, so the screens only draw and the rules stay in shared/clans.
 */
import type { Action, ShownFight } from '../../../shared/clans/actions';
import { CONFIG } from '../../../shared/clans/config';
import { empireNewDay } from '../../../shared/clans/empire';
import { MAX_ROLLS, draftMember, makeClan, rollAgain, startingDrafts, type Draft } from '../../../shared/clans/create';
import { dayReset, depthHint, type DepthHint } from '../../../shared/clans/character';
import type { FightState } from '../../../shared/clans/fight';
import { fightSeed, payFight, type FightSummary } from '../../../shared/clans/play';
import { CLASSES, RACES } from '../../../shared/clans/gamedata';
import type { Clan, Member } from '../../../shared/clans/types';
import type { VillageView } from '../../../shared/clans/village';
import { addEarned, fameFor, measures, NO_STATS, reached, type ClanStats, type Earned } from '../../../shared/clans/rewards';
import { DEFAULT_PRACTICAL_SETTINGS, type PracticalSettings } from '../../../shared/maths/practical';

export { MAX_ROLLS, draftMember, makeClan, rollAgain, startingDrafts, type Draft };
export const RACE_NAMES = RACES.map((r) => r.name);
export const CLASS_NAMES = CLASSES.map((c) => c.name);

/** How a screen hands back a changed session. `action` is what the server needs to do the same thing; screens that have none (test buttons) leave it out. */
export type Change = (s: Session, action?: Action) => void;

/** Everything that changes while you play. */
export interface Session {
  clan: Clan;
  fightsLeft: number;
  /** Counts up so each fight gets its own seed. */
  fightNo: number;
  baseSeed: number;
  /** Counts up so each raid and Friendly War gets its own seed. */
  raidNo: number;
  day: number;
  depth: number;
  settings: PracticalSettings;
  /** Items a member has looked at closely, as "member|item" (shows the real bonuses; lets you compare). */
  examined: string[];
  /** For James's testing only: try this quest number instead of today's. */
  questPick?: number;
  /** With a server: the mine fight in progress, and the village news. */
  fight?: ShownFight | null;
  news?: string[];
  /** The class village: chest, building levels, this week's votes. On the test page it is a pretend one. */
  village?: VillageView | null;
  /** What raiders did to this clan lately, for it to read. */
  notes?: string[];
  /** The teacher's switch for raids on classmates. */
  raidsOn?: boolean;
  /** Test page only: pretend classmates that are resting behind a shield after a raid. */
  pretendShield?: string[];
  /** Test page only: how many raids on pretend classmates were made today. */
  pretendRaids?: number;
  /** Fame (never goes down; a new season starts it again from 0), the fame season, and the mine fights a day the teacher gives. */
  fame?: number;
  season?: number;
  fightsPerDay?: number;
  /** The ids of the achievements earned so far. */
  achievements?: string[];
  /** Test page only: the lifetime counts the achievements are measured by (the server keeps them with the clan). */
  stats?: ClanStats;
}

/** The pretend village the test page starts with: a few classmates have already given and voted. */
export const pretendVillage = (): VillageView => ({
  name: 'Room 12 (pretend)', chest: 120, levels: { trainingHall: 0, smithy: 0, church: 0 }, week: 1, votes: { smithy: 3, church: 2 }, myVote: null, clans: 5,
});

export const newSession = (clan: Clan, baseSeed: number, settings: PracticalSettings = DEFAULT_PRACTICAL_SETTINGS): Session => ({
  clan, fightsLeft: CONFIG.fightsPerDay, fightNo: 0, baseSeed, raidNo: 0, day: 1, depth: 0, settings, examined: [],
  fame: 0, season: 1, fightsPerDay: CONFIG.fightsPerDay, achievements: [], stats: NO_STATS,
  village: pretendVillage(), news: ['The class built the Smithy (level 1)! (pretend)'], notes: [], raidsOn: true, pretendShield: [], pretendRaids: 0,
});

export const averageLevel = (clan: Clan) => clan.members.reduce((t, m) => t + m.level, 0) / Math.max(1, clan.members.length);

export const hintFor = (s: Session): DepthHint => depthHint(s.depth, averageLevel(s.clan));

/** The seed for the next fight. */
export const nextSeed = (s: Session) => fightSeed(s.baseSeed, s.fightNo);

export type { FightSummary };

/**
 * Test page only (the server does this in the database): add what something earned to the clan's fame and lifetime counts, and
 * work out which achievements that reaches. Fame never goes down.
 */
export function earn(s: Session, e: Partial<Earned>): Session {
  const stats = addEarned(s.stats ?? NO_STATS, e);
  const next = { ...s, fame: (s.fame ?? 0) + fameFor(e), stats };
  const ids = reached(measures(next.clan, stats));
  return { ...next, achievements: [...new Set([...(s.achievements ?? []), ...ids])] };
}

/** Write a finished fight onto the clan. Returns a new session and what happened, for the results screen. */
export function finishFight(s: Session, fight: FightState, boss = false): { session: Session; summary: FightSummary; fame: number } {
  const clan = structuredClone(s.clan);
  const summary = payFight(clan, fight);
  const won = summary.result === 'won';
  const earned: Partial<Earned> = { wins: won && !boss ? 1 : 0, bosses: won && boss ? 1 : 0 };
  const paid = earn({ ...s, clan, fightsLeft: Math.max(0, s.fightsLeft - 1), fightNo: s.fightNo + 1 }, earned);
  return { session: paid, summary, fame: fameFor(earned) };
}

/** "Skip a day" for James's testing: everyone heals, fights come back. */
export function skipDay(s: Session): Session {
  const clan = structuredClone(s.clan);
  dayReset(clan);
  empireNewDay(clan);
  return { ...s, clan, fightsLeft: s.fightsPerDay ?? CONFIG.fightsPerDay, day: s.day + 1, pretendShield: [], pretendRaids: 0 };
}

/** The stats a card shows by default: HP, attack, defence and one star (the member's best stat). */
export function headline(m: Member) {
  const entries = Object.entries(m.stats) as [string, number][];
  const [bestName, bestValue] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { hp: m.maxHp, attack: m.stats.strength, defence: m.stats.armor, star: { name: bestName, value: bestValue } };
}
