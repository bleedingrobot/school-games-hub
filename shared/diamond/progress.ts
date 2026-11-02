/**
 * A pupil's Diamond Drop progress, as pure functions (docs/DIAMOND-PLAN.md, sections 3.4 and 6): which levels they may
 * start today (one new level a day, by the New Zealand date), adding up a level's stars, coins and Gem Book entries,
 * boosts, and what New Season clears and keeps. The server runs exactly these before saving.
 */
import {
  ACHIEVEMENTS, ACHIEVEMENT_NEEDS, BOOSTS, GEMS, LAST_LEVEL, POINTS, REPLAY_COIN_SHARE,
  type AchievementMeasure, type BoostId, type GemId, type Slot,
} from './config';
import type { LevelResult } from './engine';
import { WORKSHOP_ITEMS } from './workshopItems';

/** The New Zealand date ('YYYY-MM-DD') of a moment. Days roll over at New Zealand midnight. */
export function nzDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((x) => x.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export interface GemPage {
  count: number;
  /** New Zealand date of the first catch this season. */
  first: string;
}

export interface Player {
  // ---- This season (New Season clears these) ----
  /** The deepest level passed (0 = none yet). */
  deepest: number;
  /** New Zealand date the deepest level was first passed. */
  newLevelDate: string | null;
  coins: number;
  /** Best stars on each level (index 0 = level 1). */
  stars: number[];
  gemBook: Partial<Record<GemId, GemPage>>;
  /** A free boost from a mystery sack, for the next level played. */
  freeBoost: BoostId | null;
  // ---- Kept for good ----
  /** Workshop upgrades bought or earned. */
  owned: string[];
  /** The upgrade worn in each slot. */
  worn: Partial<Record<Slot, string>>;
  /** Totals for achievements (which survive New Season). */
  lifetime: {
    plays: number;
    gems: number;
    grips: number;
    found: number;
    kinds: GemId[];
    bestLevel: number;
    bestStars: number;
  };
}

export function newPlayer(): Player {
  return {
    deepest: 0, newLevelDate: null, coins: 0, stars: Array(LAST_LEVEL).fill(0), gemBook: {}, freeBoost: null,
    owned: [], worn: {}, lifetime: { plays: 0, gems: 0, grips: 0, found: 0, kinds: [], bestLevel: 0, bestStars: 0 },
  };
}

/** Does this pupil get the guided first go (they have never played a level)? */
export const needsStarter = (p: Player) => p.lifetime.plays === 0;

export interface LevelsOpen {
  /** Levels already passed, open to replay. */
  replays: number[];
  /** The next new level (null once level 10 is passed). */
  next: number | null;
  /** Can the next level be tried today? */
  nextOpen: boolean;
}

/**
 * Which levels a pupil may start now. Passed levels are always open. The next one is open unless a new level was
 * already passed today (New Zealand date): then it opens tomorrow. Tries at today's level are unlimited.
 */
export function levelsOpen(p: Player, now: Date): LevelsOpen {
  const replays = Array.from({ length: p.deepest }, (_, i) => i + 1);
  const next = p.deepest < LAST_LEVEL ? p.deepest + 1 : null;
  return { replays, next, nextOpen: next !== null && p.newLevelDate !== nzDate(now) };
}

export function canStart(p: Player, level: number, now: Date): boolean {
  if (!Number.isInteger(level) || level < 1 || level > LAST_LEVEL) return false;
  if (level <= p.deepest) return true;
  const open = levelsOpen(p, now);
  return level === open.next && open.nextOpen;
}

export function boostPrice(id: BoostId, level: number): number {
  const b = BOOSTS.find((x) => x.id === id)!;
  return b.base + b.perLevel * level;
}

/**
 * Boosts for the level about to start: at most one of each, the sack's free boost costs nothing, and the rest must be
 * affordable. Gives the player after paying, or why not.
 */
export function takeBoosts(p: Player, level: number, ids: readonly BoostId[]): { ok: true; player: Player; cost: number } | { ok: false; reason: 'twice' | 'unknown' | 'coins' } {
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'twice' };
  if (ids.some((id) => !BOOSTS.some((b) => b.id === id))) return { ok: false, reason: 'unknown' };
  let cost = 0;
  let freeUsed = false;
  for (const id of ids) {
    if (!freeUsed && id === p.freeBoost) { freeUsed = true; continue; }
    cost += boostPrice(id, level);
  }
  if (cost > p.coins) return { ok: false, reason: 'coins' };
  return { ok: true, cost, player: { ...p, coins: p.coins - cost, freeBoost: freeUsed ? null : p.freeBoost } };
}

/** Achievement measures (counts_fn in Stage 4). */
export function measures(p: Player): Record<AchievementMeasure | 'diamond_gems' | 'diamond_level', number> {
  return {
    diamond_gems: p.lifetime.gems,
    diamond_grips: p.lifetime.grips,
    diamond_level: p.lifetime.bestLevel,
    diamond_kinds: p.lifetime.kinds.filter((k) => k !== 'heartDiamond').length,
    diamond_found: p.lifetime.found,
    diamond_stars: p.lifetime.bestStars,
  };
}

/** The hub achievements a change of progress has just earned (for the level end's celebration). */
export function newAchievements(before: Player, after: Player): (typeof ACHIEVEMENTS)[number][] {
  const was = measures(before);
  const now = measures(after);
  return ACHIEVEMENTS.filter((a) => was[a.measure] < a.goal && now[a.measure] >= a.goal);
}

/** Workshop upgrades this pupil has earned but doesn't have yet. */
export function newlyEarned(p: Player): string[] {
  const m = measures(p);
  return WORKSHOP_ITEMS.filter((it) => it.earnedBy && m[it.earnedBy] >= ACHIEVEMENT_NEEDS[it.earnedBy] && !p.owned.includes(it.id)).map((it) => it.id);
}

export interface Applied {
  player: Player;
  /** Coins kept (full for a new level passed; a share otherwise). */
  coins: number;
  /** Hub points earned (first pass, new stars, the diamond). */
  points: number;
  /** A new level passed for the first time. */
  newLevel: boolean;
  /** Workshop upgrades just earned. */
  earned: string[];
}

/**
 * Add a finished level to the pupil's progress. The caller has checked `canStart` when the level began; a pass only
 * moves the pupil deeper if it was the next level and it was still open (so two passes in one day can't both count).
 */
export function applyResult(before: Player, r: LevelResult, now: Date): Applied {
  const today = nzDate(now);
  const p: Player = {
    ...before,
    stars: [...before.stars],
    gemBook: { ...before.gemBook },
    lifetime: { ...before.lifetime, kinds: [...before.lifetime.kinds] },
    owned: [...before.owned],
  };
  let points = 0;
  let newLevel = false;
  if (r.passed && r.level === before.deepest + 1 && levelsOpen(before, now).nextOpen) {
    p.deepest = r.level;
    p.newLevelDate = today;
    newLevel = true;
    points += POINTS.firstPass;
  }
  // Full coins only for passing a new level; replays and tries that fall short keep a share (so falling short on purpose isn't a coin farm).
  const coins = newLevel ? r.coins : Math.floor(r.coins * REPLAY_COIN_SHARE);
  p.coins += coins;
  // Stars count only on levels passed (a level beyond the deepest that didn't count earns none).
  if (r.level <= p.deepest && r.stars > p.stars[r.level - 1]) {
    points += (r.stars - p.stars[r.level - 1]) * POINTS.newStar;
    p.stars[r.level - 1] = r.stars;
  }
  if (r.diamond) {
    if (p.lifetime.found === 0) points += POINTS.diamond;
    p.lifetime.found++;
  }
  for (const g of GEMS) {
    const n = r.caught[g.id] ?? 0;
    if (!n) continue;
    const page = p.gemBook[g.id];
    p.gemBook[g.id] = { count: (page?.count ?? 0) + n, first: page?.first ?? today };
    p.lifetime.gems += n;
    if (!p.lifetime.kinds.includes(g.id)) p.lifetime.kinds.push(g.id);
  }
  p.lifetime.grips += r.held;
  p.lifetime.plays++;
  p.lifetime.bestLevel = Math.max(p.lifetime.bestLevel, p.deepest);
  p.lifetime.bestStars = Math.max(p.lifetime.bestStars, p.stars.reduce((a, b) => a + b, 0));
  if (r.freeBoost && !p.freeBoost) p.freeBoost = r.freeBoost;
  const earned = newlyEarned(p);
  p.owned.push(...earned);
  return { player: p, coins, points, newLevel, earned };
}

/** New Season: back to level 1 with no coins, stars or Gem Book. Workshop upgrades, what's worn and achievement totals stay. */
export function newSeason(p: Player): Player {
  const fresh = newPlayer();
  return { ...fresh, owned: [...p.owned], worn: { ...p.worn }, lifetime: { ...p.lifetime, kinds: [...p.lifetime.kinds] } };
}
