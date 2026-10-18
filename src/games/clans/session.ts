/**
 * The clan's state in the browser for this test stage (nothing is saved; a refresh starts again).
 * Plain functions on plain data, so the screens only draw and the rules stay in shared/clans.
 */
import type { Action } from '../../../shared/clans/actions';
import { CONFIG } from '../../../shared/clans/config';
import { empireNewDay } from '../../../shared/clans/empire';
import { MAX_ROLLS, draftMember, makeClan, rollAgain, startingDrafts, type Draft } from '../../../shared/clans/create';
import { dayReset, depthHint, gainXp, type DepthHint } from '../../../shared/clans/character';
import { settle, type FightState } from '../../../shared/clans/fight';
import { CLASSES, RACES } from '../../../shared/clans/gamedata';
import type { Clan, Member } from '../../../shared/clans/types';
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
}

export const newSession = (clan: Clan, baseSeed: number, settings: PracticalSettings = DEFAULT_PRACTICAL_SETTINGS): Session => ({
  clan, fightsLeft: CONFIG.fightsPerDay, fightNo: 0, baseSeed, raidNo: 0, day: 1, depth: 0, settings, examined: [],
});

export const averageLevel = (clan: Clan) => clan.members.reduce((t, m) => t + m.level, 0) / Math.max(1, clan.members.length);

export const hintFor = (s: Session): DepthHint => depthHint(s.depth, averageLevel(s.clan));

/** The seed for the next fight. */
export const nextSeed = (s: Session) => Math.imul(s.baseSeed | 0, 0x9e3779b1) ^ Math.imul(s.fightNo + 1, 0x85ebca6b);

export interface FightSummary {
  result: FightState['result'];
  gold: number;
  followers: number;
  xp: number[];
  /** Levels gained by each member. */
  levels: number[];
}

/** Write a finished fight onto the clan. Returns a new session and what happened, for the results screen. */
export function finishFight(s: Session, fight: FightState): { session: Session; summary: FightSummary } {
  const clan = structuredClone(s.clan);
  const levels = settle(clan.members, fight, gainXp);
  clan.gold += fight.gold;
  clan.followers += fight.followers;
  return {
    session: { ...s, clan, fightsLeft: Math.max(0, s.fightsLeft - 1), fightNo: s.fightNo + 1 },
    summary: { result: fight.result, gold: fight.gold, followers: fight.followers, xp: fight.xp, levels },
  };
}

/** "Skip a day" for James's testing: everyone heals, fights come back. */
export function skipDay(s: Session): Session {
  const clan = structuredClone(s.clan);
  dayReset(clan);
  empireNewDay(clan);
  return { ...s, clan, fightsLeft: CONFIG.fightsPerDay, day: s.day + 1 };
}

/** The stats a card shows by default: HP, attack, defence and one star (the member's best stat). */
export function headline(m: Member) {
  const entries = Object.entries(m.stats) as [string, number][];
  const [bestName, bestValue] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { hp: m.maxHp, attack: m.stats.strength, defence: m.stats.armor, star: { name: bestName, value: bestValue } };
}
