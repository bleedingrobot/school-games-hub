/**
 * The daily battle limit (James, 27 Oct 2026). The database holds the real number and counts the
 * battles saved today (monster_battle_rules and monster_battles_today in the migration
 * 20261027000200_monster_battle_cap.sql); the game adds the battles it hasn't saved yet. Once the limit
 * is reached the monsters rest: no wild battles and no trainers until tomorrow. Tower battles stay open.
 */
import type { BattleReport } from '../save/check';

/** Used when the server can't be reached. Keep it the same as monster_battle_rules(). */
export const BATTLES_PER_DAY = 12;

/** A battle counts when it asked a maths question and wasn't in a Tower (the same rule as monster_counts_for_cap). */
export const countsTowardCap = (battle: Pick<BattleReport, 'map' | 'steps'>) =>
  !battle.map.startsWith('tower-') && battle.steps.some((s) => s.q !== undefined);

const NZ = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The New Zealand day (YYYY-MM-DD) of a time, like nz_day() in the database. */
export const nzDay = (ms: number) => NZ.format(new Date(ms));

/** The day a battle was fought: when its first question was asked. */
export function battleDay(battle: Pick<BattleReport, 'steps'>): string | null {
  const at = battle.steps.find((s) => s.q)?.q?.at;
  return at === undefined ? null : nzDay(at);
}

/** Battles in this list that count toward the limit on `day`. */
export const countedOn = (battles: Pick<BattleReport, 'map' | 'steps'>[], day: string) =>
  battles.filter((b) => countsTowardCap(b) && battleDay(b) === day).length;
