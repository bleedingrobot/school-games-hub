/**
 * What a request earns (stage C.6 part B): fame, points and the counts the eight achievements are measured by.
 *
 * The rules make an `Earned` (counts only) for a request after the server has replayed and paid it, and keep it inside the
 * result that is saved. A database trigger turns the counts into fame, points and achievements in the same transaction as the
 * save, so a request earns once however many times it is sent. The browser can never supply one. The numbers are in
 * `CONFIG.rewards`; the same ones are in the SQL function clan_reward_rules (a test keeps them equal).
 */
import { CONFIG } from './config';
import type { Clan } from './types';

/** What one request earned, as counts. Fame and points are worked out from these. */
export interface Earned {
  /** Mine fights won (not bosses). */
  wins: number;
  /** Bosses beaten. */
  bosses: number;
  /** Friendly Wars won. */
  wars: number;
  /** Raids on computer kingdoms won. */
  kingdomRaids: number;
  /** Raids on classmates won. */
  classRaids: number;
  /** Battle Cry questions answered right. */
  cries: number;
}

export const NOTHING: Earned = { wins: 0, bosses: 0, wars: 0, kingdomRaids: 0, classRaids: 0, cries: 0 };

/** Counts for an event, or undefined if it earned nothing (so results stay small). */
export function earnedOrNone(part: Partial<Earned>): Earned | undefined {
  const e = { ...NOTHING, ...part };
  return (Object.keys(NOTHING) as (keyof Earned)[]).some((k) => e[k] > 0) ? e : undefined;
}

/** Fame for these counts. Never negative. */
export function fameFor(e: Partial<Earned>): number {
  const f = CONFIG.rewards.fame;
  return (e.wins ?? 0) * f.mineWin + (e.bosses ?? 0) * f.bossWin + (e.wars ?? 0) * f.warWin
    + (e.kingdomRaids ?? 0) * f.kingdomRaidWin + (e.classRaids ?? 0) * f.classRaidWin;
}

/**
 * Points for these counts, given how many mine wins were waiting for a whole point. Returns the points and the new waiting count
 * (0 to minesPerPoint - 1). The database does the same sum; this is for tests and the test page.
 */
export function pointsFor(e: Partial<Earned>, pending: number): { points: number; pending: number } {
  const p = CONFIG.rewards.points;
  const total = pending + (e.wins ?? 0);
  return { points: Math.floor(total / p.minesPerPoint) + (e.bosses ?? 0) * p.boss + (e.wars ?? 0) * p.war, pending: total % p.minesPerPoint };
}

/** The lifetime counts an achievement is measured by. Kept on the clan by the database (`clans.stats`). */
export interface ClanStats {
  mineWins: number;
  bossWins: number;
  warWins: number;
  kingdomRaids: number;
  classRaids: number;
  cries: number;
  villageBuilt: number;
}

export const NO_STATS: ClanStats = { mineWins: 0, bossWins: 0, warWins: 0, kingdomRaids: 0, classRaids: 0, cries: 0, villageBuilt: 0 };

/** Add what a request earned to the lifetime counts. */
export function addEarned(stats: ClanStats, e: Partial<Earned>): ClanStats {
  return {
    ...stats,
    mineWins: stats.mineWins + (e.wins ?? 0), bossWins: stats.bossWins + (e.bosses ?? 0), warWins: stats.warWins + (e.wars ?? 0),
    kingdomRaids: stats.kingdomRaids + (e.kingdomRaids ?? 0), classRaids: stats.classRaids + (e.classRaids ?? 0), cries: stats.cries + (e.cries ?? 0),
  };
}

export type AchievementMeasure = 'clan_wins' | 'clan_bosses' | 'clan_level' | 'clan_buildings' | 'clan_wars' | 'clan_village' | 'clan_cries';

export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  measure: AchievementMeasure;
  goal: number;
  /** One kind sentence for the clan page. */
  how: string;
}

/** The achievements. The same ids, names, measures and goals are in the migration (a test keeps them equal). */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'cq-first-win', name: 'First win', emoji: '⚔️', measure: 'clan_wins', goal: 1, how: 'Win a fight in the Mines.' },
  { id: 'cq-first-boss', name: 'Boss beaten', emoji: '👹', measure: 'clan_bosses', goal: 1, how: 'Beat a boss deep in the Mines.' },
  { id: 'cq-level-10', name: 'Level 10', emoji: '🛡️', measure: 'clan_level', goal: 10, how: 'Get a clan member to level 10.' },
  { id: 'cq-level-20', name: 'Level 20', emoji: '🏅', measure: 'clan_level', goal: 20, how: 'Get a clan member to level 20.' },
  { id: 'cq-buildings-5', name: 'Five buildings', emoji: '🏰', measure: 'clan_buildings', goal: 5, how: 'Have five different buildings in your village.' },
  { id: 'cq-first-war', name: 'Friendly War win', emoji: '🤝', measure: 'clan_wars', goal: 1, how: 'Win a Friendly War.' },
  { id: 'cq-village', name: 'Village builders', emoji: '🔨', measure: 'clan_village', goal: 1, how: 'Take a building to level 3.' },
  { id: 'cq-cries-50', name: 'Loud and right', emoji: '📣', measure: 'clan_cries', goal: 50, how: 'Get 50 Battle Cry questions right.' },
  // The database sets stats.villageBuilt to 2 when a clan's whole village is at top level (cq-village needs 1, which a level-3 building gives).
  { id: 'cq-master-builder', name: 'Master Builder', emoji: '🏰', measure: 'clan_village', goal: 2, how: 'Take every building in your village to its top level.' },
];

/** How far along each measure is, from the clan and its lifetime counts. */
export function measures(clan: Clan, stats: ClanStats): Record<AchievementMeasure, number> {
  const levels = clan.empire?.version === 2 ? Object.values(clan.empire.levels) : [];
  return {
    clan_wins: stats.mineWins + stats.bossWins,
    clan_bosses: stats.bossWins,
    clan_level: clan.members.reduce((best, m) => Math.max(best, m.level), 0),
    clan_buildings: levels.filter((n) => n > 0).length,
    clan_wars: stats.warWins,
    clan_village: stats.villageBuilt,
    clan_cries: stats.cries,
  };
}

/** The ids of the achievements these measures have reached. */
export function reached(m: Record<AchievementMeasure, number>): string[] {
  return ACHIEVEMENTS.filter((a) => m[a.measure] >= a.goal).map((a) => a.id);
}
